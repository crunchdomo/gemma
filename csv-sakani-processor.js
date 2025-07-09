const fs = require('fs').promises;
const path = require('path');
const SakaniPortalAutomation = require('./simple-automation');

class CSVSakaniProcessor {
    constructor(config = {}) {
        this.config = {
            dataDir: config.dataDir || './guest-data',
            sakaniEmail: config.sakaniEmail || process.env.SAKANI_EMAIL,
            sakaniPassword: config.sakaniPassword || process.env.SAKANI_PASSWORD,
            sakaniProperty: config.sakaniProperty || process.env.SAKANI_PROPERTY || '3005',
            headless: config.headless !== false,
            ...config
        };
        
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            lastRun: null
        };
    }

    async init() {
        console.log('Initializing CSV Sakani Processor...');
        
        // Ensure data directory exists
        await fs.mkdir(this.config.dataDir, { recursive: true });
        
        console.log('✓ CSV Sakani Processor initialized');
        console.log(`  Data directory: ${this.config.dataDir}`);
    }

    async processPendingGuests() {
        try {
            console.log('\n=== Processing Pending Guests ===');
            
            // Get list of pending guests
            const pendingGuests = await this.getPendingGuests();
            
            if (pendingGuests.length === 0) {
                console.log('No pending guests to process');
                return { processed: 0, successful: 0, failed: 0 };
            }
            
            console.log(`Found ${pendingGuests.length} pending guests`);
            
            const results = {
                processed: pendingGuests.length,
                successful: 0,
                failed: 0,
                details: []
            };
            
            // Process each guest
            for (const guestEntry of pendingGuests) {
                const guestName = `${guestEntry.firstName} ${guestEntry.lastName}`;
                console.log(`\n--- Processing: ${guestName} ---`);
                
                try {
                    // Load full guest data
                    const guestData = await this.loadGuestData(guestEntry.dataLocation);
                    
                    if (!guestData) {
                        throw new Error('Guest data not found');
                    }
                    
                    // Load Sakani-formatted data
                    const sakaniDataPath = path.join(this.config.dataDir, guestEntry.dataLocation, 'sakani_data.json');
                    const sakaniData = JSON.parse(await fs.readFile(sakaniDataPath, 'utf-8'));
                    
                    // Submit to Sakani
                    const sakaniResult = await this.submitToSakani(sakaniData);
                    
                    if (sakaniResult.success) {
                        await this.updateGuestStatus(guestEntry.dataLocation, 'completed', 'Successfully submitted to Sakani');
                        results.successful++;
                        console.log(`✅ ${guestName} completed successfully`);
                    } else {
                        await this.updateGuestStatus(guestEntry.dataLocation, 'failed', sakaniResult.message);
                        results.failed++;
                        console.log(`❌ ${guestName} failed: ${sakaniResult.message}`);
                    }
                    
                    results.details.push({
                        guest: guestName,
                        guestId: guestEntry.dataLocation,
                        success: sakaniResult.success,
                        message: sakaniResult.message
                    });
                    
                } catch (error) {
                    console.error(`❌ Error processing ${guestName}:`, error);
                    
                    await this.updateGuestStatus(guestEntry.dataLocation, 'failed', error.message);
                    results.failed++;
                    
                    results.details.push({
                        guest: guestName,
                        guestId: guestEntry.dataLocation,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Update stats
            this.stats.totalProcessed += results.processed;
            this.stats.successful += results.successful;
            this.stats.failed += results.failed;
            this.stats.lastRun = new Date();
            
            console.log('\n=== Processing Summary ===');
            console.log(`Total: ${results.processed}`);
            console.log(`Successful: ${results.successful}`);
            console.log(`Failed: ${results.failed}`);
            
            // Save results
            await this.saveResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in processPendingGuests:', error);
            throw error;
        }
    }

    async getPendingGuests() {
        try {
            // Get all guest directories
            const entries = await fs.readdir(this.config.dataDir, { withFileTypes: true });
            const guestDirs = entries.filter(entry => 
                entry.isDirectory() && entry.name.startsWith('guest_')
            );
            
            const pendingGuests = [];
            
            for (const dir of guestDirs) {
                const guestInfoPath = path.join(this.config.dataDir, dir.name, 'guest_info.json');
                
                try {
                    const guestInfo = JSON.parse(await fs.readFile(guestInfoPath, 'utf-8'));
                    
                    if (guestInfo.status === 'pending') {
                        pendingGuests.push({
                            dataLocation: dir.name,
                            firstName: guestInfo.firstName,
                            lastName: guestInfo.lastName,
                            checkInDate: guestInfo.checkInDate,
                            submissionTime: guestInfo.submissionTime
                        });
                    }
                } catch (error) {
                    console.warn(`Could not read guest info for ${dir.name}:`, error.message);
                }
            }
            
            // Sort by submission time
            pendingGuests.sort((a, b) => 
                new Date(a.submissionTime) - new Date(b.submissionTime)
            );
            
            return pendingGuests;
            
        } catch (error) {
            console.error('Error getting pending guests:', error);
            return [];
        }
    }

    async loadGuestData(guestId) {
        try {
            const guestInfoPath = path.join(this.config.dataDir, guestId, 'guest_info.json');
            const guestInfo = JSON.parse(await fs.readFile(guestInfoPath, 'utf-8'));
            return guestInfo;
        } catch (error) {
            console.error(`Error loading guest data for ${guestId}:`, error);
            return null;
        }
    }

    async submitToSakani(sakaniData) {
        try {
            console.log(`Submitting ${sakaniData.firstName} ${sakaniData.lastName} to Sakani portal...`);
            
            const result = await SakaniPortalAutomation.submitGuest(sakaniData, {
                sakaniEmail: this.config.sakaniEmail,
                sakaniPassword: this.config.sakaniPassword,
                sakaniProperty: this.config.sakaniProperty,
                headless: this.config.headless
            });
            
            return result;
            
        } catch (error) {
            console.error('Error submitting to Sakani:', error);
            return { success: false, message: error.message };
        }
    }

    async updateGuestStatus(guestId, status, notes = '') {
        try {
            const guestInfoPath = path.join(this.config.dataDir, guestId, 'guest_info.json');
            const guestInfo = JSON.parse(await fs.readFile(guestInfoPath, 'utf-8'));
            
            guestInfo.status = status;
            guestInfo.processingNotes = notes;
            guestInfo.lastProcessed = new Date().toISOString();
            
            if (status === 'completed') {
                guestInfo.sakaniSubmittedAt = new Date().toISOString();
            }
            
            await fs.writeFile(guestInfoPath, JSON.stringify(guestInfo, null, 2));
            
            console.log(`Updated status for ${guestId} to ${status}`);
            
        } catch (error) {
            console.error(`Error updating guest status for ${guestId}:`, error);
        }
    }

    async saveResults(results) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `processing-results-${timestamp}.json`;
            const filePath = path.join(this.config.dataDir, 'logs', filename);
            
            await fs.mkdir(path.join(this.config.dataDir, 'logs'), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(results, null, 2));
            
            console.log(`📄 Results saved to ${filePath}`);
            
        } catch (error) {
            console.error('Error saving results:', error);
        }
    }

    async generateHostawayBatch() {
        try {
            console.log('\n=== Generating Hostaway Batch CSV ===');
            
            const completedGuests = await this.getCompletedGuests();
            
            if (completedGuests.length === 0) {
                console.log('No completed guests for Hostaway batch');
                return null;
            }
            
            const csv = require('csv-writer').createObjectCsvWriter;
            const date = new Date().toISOString().split('T')[0];
            const batchPath = path.join(this.config.dataDir, 'hostaway_batches', `batch_${date}.csv`);
            
            await fs.mkdir(path.join(this.config.dataDir, 'hostaway_batches'), { recursive: true });
            
            // Collect all guest data for batch
            const batchData = [];
            
            for (const guest of completedGuests) {
                const csvPath = path.join(this.config.dataDir, guest.dataLocation, 'hostaway_import.csv');
                
                try {
                    // Read individual CSV data
                    const csvContent = await fs.readFile(csvPath, 'utf-8');
                    // Parse and add to batch (simplified - you'd need proper CSV parsing)
                    
                    const guestInfo = await this.loadGuestData(guest.dataLocation);
                    
                    batchData.push({
                        'Confirmation Code': guestInfo.guestId,
                        'Guest First Name': guestInfo.firstName,
                        'Guest Last Name': guestInfo.lastName,
                        'Guest Email': guestInfo.email,
                        'Guest Phone': guestInfo.phone || '',
                        'Guest Country': guestInfo.nationality,
                        'Property': guestInfo.propertyName,
                        'Unit': guestInfo.unitNumber,
                        'Check-in Date': guestInfo.checkInDate,
                        'Check-in Time': guestInfo.checkInTime,
                        'Check-out Date': guestInfo.checkOutDate,
                        'Check-out Time': guestInfo.checkOutTime,
                        'Number of Guests': guestInfo.totalGuests,
                        'Number of Children': guestInfo.children,
                        'Status': 'Confirmed',
                        'Notes': `Sakani submitted: ${guestInfo.sakaniSubmittedAt}`
                    });
                } catch (error) {
                    console.error(`Error processing guest ${guest.dataLocation} for batch:`, error);
                }
            }
            
            if (batchData.length > 0) {
                // Write batch CSV
                const csvWriter = csv({
                    path: batchPath,
                    header: Object.keys(batchData[0]).map(key => ({ id: key, title: key }))
                });
                
                await csvWriter.writeRecords(batchData);
                
                console.log(`✓ Hostaway batch CSV generated: ${batchPath}`);
                console.log(`  Contains ${batchData.length} guests`);
                
                // Mark guests as batched
                for (const guest of completedGuests) {
                    await this.updateGuestStatus(guest.dataLocation, 'batched', `Included in batch ${date}`);
                }
                
                return batchPath;
            }
            
            return null;
            
        } catch (error) {
            console.error('Error generating Hostaway batch:', error);
            throw error;
        }
    }

    async getCompletedGuests() {
        try {
            const entries = await fs.readdir(this.config.dataDir, { withFileTypes: true });
            const guestDirs = entries.filter(entry => 
                entry.isDirectory() && entry.name.startsWith('guest_')
            );
            
            const completedGuests = [];
            
            for (const dir of guestDirs) {
                const guestInfoPath = path.join(this.config.dataDir, dir.name, 'guest_info.json');
                
                try {
                    const guestInfo = JSON.parse(await fs.readFile(guestInfoPath, 'utf-8'));
                    
                    if (guestInfo.status === 'completed' && guestInfo.sakaniSubmittedAt) {
                        completedGuests.push({
                            dataLocation: dir.name,
                            firstName: guestInfo.firstName,
                            lastName: guestInfo.lastName,
                            completedAt: guestInfo.sakaniSubmittedAt
                        });
                    }
                } catch (error) {
                    console.warn(`Could not read guest info for ${dir.name}:`, error.message);
                }
            }
            
            return completedGuests;
            
        } catch (error) {
            console.error('Error getting completed guests:', error);
            return [];
        }
    }

    getStats() {
        return {
            ...this.stats,
            config: {
                dataDir: this.config.dataDir,
                sakaniProperty: this.config.sakaniProperty
            }
        };
    }

    async searchGuests(criteria = {}) {
        try {
            const indexPath = path.join(this.config.dataDir, 'index.json');
            let index = { guests: [] };
            
            try {
                const indexContent = await fs.readFile(indexPath, 'utf-8');
                index = JSON.parse(indexContent);
            } catch (error) {
                console.log('No index file found, searching through guest folders...');
                return await this.searchGuestFolders(criteria);
            }
            
            let results = index.guests;
            
            // Filter by criteria
            if (criteria.name) {
                const searchName = criteria.name.toLowerCase();
                results = results.filter(g => 
                    g.firstName.toLowerCase().includes(searchName) ||
                    g.lastName.toLowerCase().includes(searchName)
                );
            }
            
            if (criteria.property) {
                const searchProperty = criteria.property.toLowerCase();
                results = results.filter(g => 
                    g.propertyName && g.propertyName.toLowerCase().includes(searchProperty)
                );
            }
            
            if (criteria.unit) {
                const searchUnit = criteria.unit.toLowerCase();
                results = results.filter(g => 
                    g.unitNumber && g.unitNumber.toLowerCase().includes(searchUnit)
                );
            }
            
            if (criteria.date) {
                results = results.filter(g => 
                    g.checkInDate === criteria.date || g.checkOutDate === criteria.date
                );
            }
            
            if (criteria.status) {
                results = results.filter(g => g.status === criteria.status);
            }
            
            if (criteria.passport) {
                results = results.filter(g => 
                    g.passportNumber && g.passportNumber.includes(criteria.passport)
                );
            }
            
            return results;
            
        } catch (error) {
            console.error('Error searching guests:', error);
            return [];
        }
    }

    async searchGuestFolders(criteria = {}) {
        // Fallback search through actual folders if index is not available
        const results = [];
        
        try {
            const entries = await fs.readdir(this.config.dataDir, { withFileTypes: true });
            const guestDirs = entries.filter(entry => 
                entry.isDirectory() && entry.name.startsWith('guest_')
            );
            
            for (const dir of guestDirs) {
                const guestInfoPath = path.join(this.config.dataDir, dir.name, 'guest_info.json');
                
                try {
                    const guestInfo = JSON.parse(await fs.readFile(guestInfoPath, 'utf-8'));
                    let match = true;
                    
                    if (criteria.name && match) {
                        const searchName = criteria.name.toLowerCase();
                        match = guestInfo.firstName.toLowerCase().includes(searchName) ||
                                guestInfo.lastName.toLowerCase().includes(searchName);
                    }
                    
                    if (criteria.property && match) {
                        const searchProperty = criteria.property.toLowerCase();
                        match = guestInfo.propertyName && 
                                guestInfo.propertyName.toLowerCase().includes(searchProperty);
                    }
                    
                    if (criteria.date && match) {
                        match = guestInfo.checkInDate === criteria.date || 
                                guestInfo.checkOutDate === criteria.date;
                    }
                    
                    if (criteria.status && match) {
                        match = guestInfo.status === criteria.status;
                    }
                    
                    if (match) {
                        results.push({
                            id: guestInfo.guestId,
                            firstName: guestInfo.firstName,
                            lastName: guestInfo.lastName,
                            propertyName: guestInfo.propertyName,
                            unitNumber: guestInfo.unitNumber,
                            checkInDate: guestInfo.checkInDate,
                            checkOutDate: guestInfo.checkOutDate,
                            status: guestInfo.status,
                            dataLocation: dir.name
                        });
                    }
                } catch (error) {
                    // Skip invalid guest folders
                }
            }
            
            return results;
            
        } catch (error) {
            console.error('Error searching guest folders:', error);
            return [];
        }
    }
}

module.exports = CSVSakaniProcessor;

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'process';
    
    (async () => {
        const processor = new CSVSakaniProcessor({
            headless: process.env.NODE_ENV === 'production' || args.includes('--headless')
        });
        
        try {
            await processor.init();
            
            switch (command) {
                case 'process':
                    await processor.processPendingGuests();
                    break;
                    
                case 'batch':
                    const batchPath = await processor.generateHostawayBatch();
                    if (batchPath) {
                        console.log(`\n📋 Hostaway batch ready for import: ${batchPath}`);
                    }
                    break;
                    
                case 'stats':
                    const stats = processor.getStats();
                    console.log(JSON.stringify(stats, null, 2));
                    break;
                    
                case 'search':
                    const criteria = {};
                    
                    // Parse search arguments
                    for (let i = 1; i < args.length; i += 2) {
                        const flag = args[i];
                        const value = args[i + 1];
                        
                        if (flag && value) {
                            switch (flag) {
                                case '--name':
                                case '-n':
                                    criteria.name = value;
                                    break;
                                case '--property':
                                case '-p':
                                    criteria.property = value;
                                    break;
                                case '--unit':
                                case '-u':
                                    criteria.unit = value;
                                    break;
                                case '--date':
                                case '-d':
                                    criteria.date = value;
                                    break;
                                case '--status':
                                case '-s':
                                    criteria.status = value;
                                    break;
                                case '--passport':
                                    criteria.passport = value;
                                    break;
                            }
                        }
                    }
                    
                    console.log('\n🔍 Searching guests...');
                    const searchResults = await processor.searchGuests(criteria);
                    
                    if (searchResults.length === 0) {
                        console.log('No guests found matching criteria');
                    } else {
                        console.log(`\nFound ${searchResults.length} guest(s):\n`);
                        searchResults.forEach((guest, index) => {
                            console.log(`${index + 1}. ${guest.firstName} ${guest.lastName}`);
                            console.log(`   Property: ${guest.propertyName} - Unit ${guest.unitNumber}`);
                            console.log(`   Check-in: ${guest.checkInDate} | Check-out: ${guest.checkOutDate}`);
                            console.log(`   Status: ${guest.status}`);
                            console.log(`   ID: ${guest.id}`);
                            console.log('');
                        });
                    }
                    break;
                    
                default:
                    console.log(`Unknown command: ${command}`);
                    console.log('Available commands: process, batch, stats, search');
                    console.log('\nSearch usage:');
                    console.log('  npm run search -- --name "John"');
                    console.log('  npm run search -- --property "Seraya" --status "pending"');
                    console.log('  npm run search -- --date "2024-07-09"');
                    break;
            }
            
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    })();
}