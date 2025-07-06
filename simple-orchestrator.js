const SakaniPortalAutomation = require('./simple-automation');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class SimpleOrchestrator {
    constructor(config = {}) {
        this.config = {
            // Google Sheets configuration
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || config.spreadsheetId,
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || config.serviceAccountEmail,
            privateKey: process.env.GOOGLE_PRIVATE_KEY || config.privateKey,
            sheetName: process.env.GOOGLE_SHEET_NAME || config.sheetName || 'Guests',
            
            // Sakani configuration
            sakaniEmail: process.env.SAKANI_EMAIL || config.sakaniEmail,
            sakaniPassword: process.env.SAKANI_PASSWORD || config.sakaniPassword,
            sakaniProperty: process.env.SAKANI_PROPERTY || config.sakaniProperty || '3005',
            
            // Processing settings
            processInterval: config.processInterval || 300000, // 5 minutes
            headless: config.headless !== false, // Default true for production
            downloadPath: './downloads/passports',
            logPath: './logs',
            
            ...config
        };
        
        this.sheetsApi = null;
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            lastRun: null
        };
        
        this.isRunning = false;
    }

    async init() {
        try {
            console.log('Initializing Simple Orchestrator...');
            
            // Create directories
            await fs.mkdir(this.config.downloadPath, { recursive: true });
            await fs.mkdir(this.config.logPath, { recursive: true });
            
            // Initialize Google Sheets API
            await this.initGoogleSheets();
            
            console.log('✓ Simple Orchestrator initialized');
            
        } catch (error) {
            console.error('Failed to initialize orchestrator:', error);
            throw error;
        }
    }

    async initGoogleSheets() {
        try {
            if (!this.config.spreadsheetId || !this.config.serviceAccountEmail || !this.config.privateKey) {
                throw new Error('Google Sheets credentials are required');
            }
            
            const { google } = require('googleapis');
            
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: this.config.serviceAccountEmail,
                    private_key: this.config.privateKey.replace(/\\n/g, '\n')
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            
            this.sheetsApi = google.sheets({ version: 'v4', auth });
            
            // Test connection
            await this.sheetsApi.spreadsheets.get({
                spreadsheetId: this.config.spreadsheetId
            });
            
            console.log('✓ Google Sheets API connected');
            
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            throw error;
        }
    }

    async fetchNewGuests() {
        try {
            console.log('Fetching new guests from Google Sheets...');
            
            const response = await this.sheetsApi.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!A:U`, // All columns
            });
            
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                console.log('No data found in spreadsheet');
                return [];
            }
            
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            const newGuests = [];
            
            for (let i = 0; i < dataRows.length; i++) {
                const rowData = dataRows[i];
                const guest = this.parseGuestData(headers, rowData, i + 2);
                
                if (guest && guest.status === 'New') {
                    newGuests.push(guest);
                }
            }
            
            console.log(`Found ${newGuests.length} new guests to process`);
            return newGuests;
            
        } catch (error) {
            console.error('Error fetching guests:', error);
            throw error;
        }
    }

    parseGuestData(headers, rowData, rowNumber) {
        try {
            const data = {};
            headers.forEach((header, index) => {
                data[header] = rowData[index] || '';
            });
            
            const guest = {
                id: `row_${rowNumber}`,
                rowNumber: rowNumber,
                firstName: data['First Name'] || '',
                lastName: data['Last Name'] || '',
                email: data['Email'] || '',
                phone: data['Phone'] || '',
                nationality: data['Nationality'] || '',
                nationalityCode: data['Nationality Code'] || this.getNationalityCode(data['Nationality']),
                passportNumber: data['Passport Number'] || '',
                passportExpiry: data['Passport Expiry'] || '',
                passportFiles: data['Passport Files'] || '',
                checkInDate: data['Check-in Date'] || '',
                checkInTime: data['Check-in Time'] || '3:00PM',
                checkOutDate: data['Check-out Date'] || '',
                checkOutTime: data['Check-out Time'] || '11:00AM',
                totalGuests: parseInt(data['Total Guests']) || 1,
                children: parseInt(data['Children']) || 0,
                status: data['Status'] || 'New',
                timestamp: data['Timestamp'] || new Date().toISOString()
            };
            
            // Validate required fields
            if (!guest.firstName || !guest.lastName || !guest.passportNumber) {
                console.warn(`Incomplete guest data in row ${rowNumber}: ${guest.firstName} ${guest.lastName}`);
                return null;
            }
            
            return guest;
            
        } catch (error) {
            console.error(`Error parsing guest data in row ${rowNumber}:`, error);
            return null;
        }
    }

    async processGuests() {
        try {
            console.log('\n=== Processing New Guests ===');
            
            const guests = await this.fetchNewGuests();
            
            if (guests.length === 0) {
                console.log('No new guests to process');
                return { processed: 0, successful: 0, failed: 0 };
            }
            
            const results = {
                processed: guests.length,
                successful: 0,
                failed: 0,
                details: []
            };
            
            for (const guest of guests) {
                const guestName = `${guest.firstName} ${guest.lastName}`;
                console.log(`\n--- Processing: ${guestName} ---`);
                
                try {
                    // Update status to processing
                    await this.updateGuestStatus(guest.id, 'Processing', 'Started automated processing');
                    
                    // Download passport files if available
                    const passportFile = await this.downloadPassportFiles(guest);
                    
                    // Submit to Sakani portal
                    const sakaniResult = await this.submitToSakani(guest, passportFile);
                    
                    if (sakaniResult.success) {
                        await this.updateGuestStatus(guest.id, 'Completed', 'Successfully submitted to Sakani portal');
                        results.successful++;
                        console.log(`✅ ${guestName} completed successfully`);
                        
                        // Clean up downloaded files
                        if (passportFile) {
                            await this.cleanupFile(passportFile);
                        }
                        
                    } else {
                        await this.updateGuestStatus(guest.id, 'Failed', `Sakani submission failed: ${sakaniResult.message}`);
                        results.failed++;
                        console.log(`❌ ${guestName} failed: ${sakaniResult.message}`);
                    }
                    
                    results.details.push({
                        guest: guestName,
                        id: guest.id,
                        success: sakaniResult.success,
                        message: sakaniResult.message
                    });
                    
                } catch (error) {
                    console.error(`❌ Error processing ${guestName}:`, error);
                    
                    await this.updateGuestStatus(guest.id, 'Failed', `Processing error: ${error.message}`);
                    results.failed++;
                    
                    results.details.push({
                        guest: guestName,
                        id: guest.id,
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
            console.error('❌ Error in processGuests:', error);
            throw error;
        }
    }

    async downloadPassportFiles(guest) {
        try {
            if (!guest.passportFiles) {
                console.log(`No passport files found for ${guest.firstName} ${guest.lastName}`);
                return null;
            }
            
            // Extract first URL from passport files
            const urls = guest.passportFiles.split(',').map(url => url.trim()).filter(url => url);
            if (urls.length === 0) return null;
            
            const fileUrl = urls[0]; // Use first file
            const fileName = `${guest.passportNumber}_passport.pdf`;
            const filePath = path.join(this.config.downloadPath, fileName);
            
            console.log(`Downloading passport file: ${fileUrl}`);
            
            await this.downloadFile(fileUrl, filePath);
            
            console.log(`✓ Downloaded passport: ${filePath}`);
            return filePath;
            
        } catch (error) {
            console.error(`Error downloading passport for ${guest.firstName} ${guest.lastName}:`, error);
            return null;
        }
    }

    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = require('fs').createWriteStream(filePath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve(filePath);
                });
                
                file.on('error', (error) => {
                    fs.unlink(filePath);
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    async submitToSakani(guest, passportFilePath = null) {
        try {
            console.log(`Submitting ${guest.firstName} ${guest.lastName} to Sakani portal...`);
            
            const guestData = {
                firstName: guest.firstName,
                lastName: guest.lastName,
                nationalityCode: guest.nationalityCode,
                passportNumber: guest.passportNumber,
                passportExpiry: guest.passportExpiry,
                totalGuests: guest.totalGuests,
                children: guest.children,
                checkInDate: guest.checkInDate,
                checkInTime: guest.checkInTime,
                checkOutDate: guest.checkOutDate,
                checkOutTime: guest.checkOutTime,
                passportFilePath: passportFilePath
            };
            
            const result = await SakaniPortalAutomation.submitGuest(guestData, {
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
            const rowNumber = parseInt(guestId.replace('row_', ''));
            
            const updates = [];
            
            // Update Status (column Q)
            updates.push({
                range: `${this.config.sheetName}!Q${rowNumber}`,
                values: [[status]]
            });
            
            // Update Processing Notes (column R)
            if (notes) {
                updates.push({
                    range: `${this.config.sheetName}!R${rowNumber}`,
                    values: [[notes]]
                });
            }
            
            // Update Last Processed (column S)
            updates.push({
                range: `${this.config.sheetName}!S${rowNumber}`,
                values: [[new Date().toISOString()]]
            });
            
            await this.sheetsApi.spreadsheets.values.batchUpdate({
                spreadsheetId: this.config.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: updates
                }
            });
            
            console.log(`Updated status for guest ${guestId} to ${status}`);
            
        } catch (error) {
            console.error('Error updating guest status:', error);
            throw error;
        }
    }

    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`Cleaned up file: ${filePath}`);
        } catch (error) {
            console.error(`Error cleaning up file ${filePath}:`, error);
        }
    }

    async saveResults(results) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `processing-results-${timestamp}.json`;
            const filePath = path.join(this.config.logPath, filename);
            
            await fs.writeFile(filePath, JSON.stringify(results, null, 2));
            console.log(`📄 Results saved to ${filePath}`);
            
        } catch (error) {
            console.error('Error saving results:', error);
        }
    }

    getNationalityCode(nationality) {
        const nationalityMap = {
            'United States': '226',
            'United Kingdom': '77',
            'Canada': '38',
            'Australia': '13',
            'Germany': '81',
            'France': '70',
            'Italy': '105',
            'Spain': '197',
            'Netherlands': '151',
            'Sweden': '202',
            'Norway': '157',
            'Denmark': '56',
            'Finland': '69',
        };
        
        return nationalityMap[nationality] || '226'; // Default to US
    }

    async startPeriodicProcessing() {
        if (this.isRunning) {
            console.log('Periodic processing already running');
            return;
        }
        
        this.isRunning = true;
        console.log(`🔄 Starting periodic processing (every ${this.config.processInterval / 1000} seconds)`);
        
        const processLoop = async () => {
            if (!this.isRunning) return;
            
            try {
                await this.processGuests();
            } catch (error) {
                console.error('Error in periodic processing:', error);
            }
            
            if (this.isRunning) {
                setTimeout(processLoop, this.config.processInterval);
            }
        };
        
        setTimeout(processLoop, 5000); // Start after 5 seconds
    }

    stopPeriodicProcessing() {
        this.isRunning = false;
        console.log('🛑 Stopped periodic processing');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            config: {
                processInterval: this.config.processInterval,
                spreadsheetId: this.config.spreadsheetId,
                sakaniProperty: this.config.sakaniProperty
            }
        };
    }
}

module.exports = SimpleOrchestrator;

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'process';
    
    (async () => {
        const orchestrator = new SimpleOrchestrator({
            headless: process.env.NODE_ENV === 'production' || args.includes('--headless')
        });
        
        try {
            await orchestrator.init();
            
            switch (command) {
                case 'process':
                    await orchestrator.processGuests();
                    break;
                    
                case 'start':
                    await orchestrator.startPeriodicProcessing();
                    
                    // Keep running until interrupted
                    process.on('SIGINT', () => {
                        console.log('\nReceived SIGINT, shutting down gracefully...');
                        orchestrator.stopPeriodicProcessing();
                        process.exit(0);
                    });
                    
                    // Keep the process alive
                    await new Promise(() => {});
                    break;
                    
                case 'stats':
                    const stats = orchestrator.getStats();
                    console.log(JSON.stringify(stats, null, 2));
                    break;
                    
                default:
                    console.log(`Unknown command: ${command}`);
                    console.log('Available commands: process, start, stats');
                    break;
            }
            
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    })();
}