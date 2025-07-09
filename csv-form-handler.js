const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;
const cors = require('cors');

class CSVFormHandler {
    constructor(config = {}) {
        this.config = {
            dataDir: config.dataDir || './guest-data',
            port: config.port || 3001,
            ...config
        };
        
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Enable CORS for form submissions
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Setup multer for file uploads
        const storage = multer.memoryStorage();
        this.upload = multer({ 
            storage,
            limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Guest submission endpoint
        this.app.post('/submit-guest', this.upload.array('passportFiles', 5), async (req, res) => {
            try {
                const result = await this.handleGuestSubmission(req);
                res.json({ success: true, ...result });
            } catch (error) {
                console.error('Error handling guest submission:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Get pending guests
        this.app.get('/pending-guests', async (req, res) => {
            try {
                const guests = await this.getPendingGuests();
                res.json({ success: true, guests });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Serve guest form
        this.app.use(express.static('public'));
    }

    async handleGuestSubmission(req) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const guestData = JSON.parse(req.body.guestData || '{}');
        
        // Create unique guest folder with property and unit info
        const propertySlug = (guestData.propertyName || 'property').toLowerCase().replace(/\s+/g, '-');
        const unitSlug = (guestData.unitNumber || 'unit').toLowerCase().replace(/\s+/g, '-');
        const guestId = `guest_${timestamp}_${propertySlug}_${unitSlug}_${guestData.passportNumber || 'unknown'}`;
        const guestDir = path.join(this.config.dataDir, guestId);
        
        // Ensure directories exist
        await fs.mkdir(this.config.dataDir, { recursive: true });
        await fs.mkdir(guestDir, { recursive: true });
        await fs.mkdir(path.join(guestDir, 'passport_files'), { recursive: true });
        
        // Save passport files
        const passportPaths = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const filename = `passport_${file.originalname}`;
                const filepath = path.join(guestDir, 'passport_files', filename);
                await fs.writeFile(filepath, file.buffer);
                passportPaths.push(filepath);
            }
        }
        
        // Prepare guest data with all information
        const completeGuestData = {
            ...guestData,
            guestId,
            submissionTime: new Date().toISOString(),
            passportFiles: passportPaths,
            status: 'pending'
        };
        
        // Save complete guest data as JSON
        await fs.writeFile(
            path.join(guestDir, 'guest_info.json'),
            JSON.stringify(completeGuestData, null, 2)
        );
        
        // Generate Hostaway CSV format
        await this.generateHostawayCSV(guestDir, completeGuestData);
        
        // Generate Sakani-ready data
        await this.generateSakaniData(guestDir, completeGuestData);
        
        // Add to pending batch
        await this.addToPendingBatch(completeGuestData);
        
        // Update index file
        await this.updateIndex(completeGuestData);
        
        console.log(`✓ Guest data saved: ${guestId}`);
        
        return {
            guestId,
            message: 'Guest data saved successfully',
            dataLocation: guestDir
        };
    }

    async generateHostawayCSV(guestDir, guestData) {
        // Hostaway CSV format based on their documentation
        const hostawayData = {
            // Reservation details
            'Confirmation Code': guestData.guestId,
            'Guest First Name': guestData.firstName,
            'Guest Last Name': guestData.lastName,
            'Guest Email': guestData.email,
            'Guest Phone': guestData.phone || '',
            'Guest Country': guestData.nationality,
            
            // Property details
            'Property': guestData.propertyName || 'Default Property',
            'Unit': guestData.unitNumber || '1',
            
            // Stay details
            'Check-in Date': guestData.checkInDate,
            'Check-in Time': guestData.checkInTime || '15:00',
            'Check-out Date': guestData.checkOutDate,
            'Check-out Time': guestData.checkOutTime || '11:00',
            'Number of Guests': guestData.totalGuests || 1,
            'Number of Children': guestData.children || 0,
            
            // Financial
            'Total Price': guestData.totalPrice || '0',
            'Currency': 'AED',
            'Payment Status': 'Paid',
            
            // Additional info
            'Notes': `Passport: ${guestData.passportNumber}, Expiry: ${guestData.passportExpiry}`,
            'Source': 'Direct Booking',
            'Status': 'Confirmed'
        };
        
        // Write individual CSV for this guest
        const csvPath = path.join(guestDir, 'hostaway_import.csv');
        const csvWriter = csv({
            path: csvPath,
            header: Object.keys(hostawayData).map(key => ({ id: key, title: key }))
        });
        
        await csvWriter.writeRecords([hostawayData]);
        console.log(`✓ Hostaway CSV generated: ${csvPath}`);
        
        return csvPath;
    }

    async generateSakaniData(guestDir, guestData) {
        // Format data for Sakani automation
        const sakaniData = {
            firstName: guestData.firstName,
            lastName: guestData.lastName,
            nationalityCode: this.getNationalityCode(guestData.nationality),
            passportNumber: guestData.passportNumber,
            passportExpiry: guestData.passportExpiry,
            totalGuests: parseInt(guestData.totalGuests) || 1,
            children: parseInt(guestData.children) || 0,
            checkInDate: guestData.checkInDate,
            checkInTime: guestData.checkInTime || '3:00PM',
            checkOutDate: guestData.checkOutDate,
            checkOutTime: guestData.checkOutTime || '11:00AM',
            passportFilePath: guestData.passportFiles[0] || null // Primary passport file
        };
        
        const sakaniPath = path.join(guestDir, 'sakani_data.json');
        await fs.writeFile(sakaniPath, JSON.stringify(sakaniData, null, 2));
        console.log(`✓ Sakani data generated: ${sakaniPath}`);
        
        return sakaniPath;
    }

    async addToPendingBatch(guestData) {
        const batchDir = path.join(this.config.dataDir, 'pending_batch');
        await fs.mkdir(batchDir, { recursive: true });
        
        const date = new Date().toISOString().split('T')[0];
        const batchFile = path.join(batchDir, `hostaway_batch_${date}.csv`);
        
        // Check if batch file exists
        let existingData = [];
        try {
            const content = await fs.readFile(batchFile, 'utf-8');
            // Parse existing CSV if needed
        } catch (error) {
            // File doesn't exist yet
        }
        
        // Append to batch
        const batchData = {
            'Confirmation Code': guestData.guestId,
            'Guest First Name': guestData.firstName,
            'Guest Last Name': guestData.lastName,
            'Guest Email': guestData.email,
            'Check-in Date': guestData.checkInDate,
            'Check-out Date': guestData.checkOutDate,
            'Status': 'Pending Import'
        };
        
        // For now, just track in a JSON file
        const trackingFile = path.join(batchDir, 'pending_guests.json');
        let pendingGuests = [];
        
        try {
            const existing = await fs.readFile(trackingFile, 'utf-8');
            pendingGuests = JSON.parse(existing);
        } catch (error) {
            // File doesn't exist
        }
        
        pendingGuests.push({
            ...batchData,
            addedAt: new Date().toISOString(),
            dataLocation: guestData.guestId
        });
        
        await fs.writeFile(trackingFile, JSON.stringify(pendingGuests, null, 2));
    }

    async getPendingGuests() {
        const trackingFile = path.join(this.config.dataDir, 'pending_batch', 'pending_guests.json');
        
        try {
            const content = await fs.readFile(trackingFile, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return [];
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

    async updateIndex(guestData) {
        try {
            const indexPath = path.join(this.config.dataDir, 'index.json');
            let index = { guests: [] };
            
            // Read existing index if it exists
            try {
                const existingIndex = await fs.readFile(indexPath, 'utf-8');
                index = JSON.parse(existingIndex);
            } catch (error) {
                // Index doesn't exist yet
            }
            
            // Add new guest entry
            const indexEntry = {
                id: guestData.guestId,
                firstName: guestData.firstName,
                lastName: guestData.lastName,
                email: guestData.email,
                passportNumber: guestData.passportNumber,
                nationality: guestData.nationality,
                propertyName: guestData.propertyName,
                unitNumber: guestData.unitNumber,
                checkInDate: guestData.checkInDate,
                checkOutDate: guestData.checkOutDate,
                status: guestData.status,
                submissionTime: guestData.submissionTime,
                totalGuests: guestData.totalGuests,
                children: guestData.children
            };
            
            // Add to beginning of array (newest first)
            index.guests.unshift(indexEntry);
            
            // Save updated index
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
            console.log('✓ Index updated');
            
        } catch (error) {
            console.error('Error updating index:', error);
            // Don't fail the submission if index update fails
        }
    }

    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.config.port, () => {
                console.log(`✓ CSV Form Handler running on port ${this.config.port}`);
                console.log(`  Guest data will be saved to: ${this.config.dataDir}`);
                console.log(`  Submit guests to: http://localhost:${this.config.port}/submit-guest`);
                resolve();
            });
        });
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
    }
}

module.exports = CSVFormHandler;

// Run directly if called as script
if (require.main === module) {
    const handler = new CSVFormHandler();
    handler.start().catch(console.error);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down CSV Form Handler...');
        await handler.stop();
        process.exit(0);
    });
}