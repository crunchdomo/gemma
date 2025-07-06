const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class GoogleSheetsGuestIntegration {
    constructor(config = {}) {
        this.config = {
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || config.spreadsheetId,
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || config.serviceAccountEmail,
            privateKey: process.env.GOOGLE_PRIVATE_KEY || config.privateKey,
            sheetName: process.env.GOOGLE_SHEET_NAME || config.sheetName || 'Guests',
            downloadPath: './downloads/passports',
            ...config
        };
        
        if (!this.config.spreadsheetId) {
            throw new Error(`
❌ Google Sheets Spreadsheet ID is required but not found.

🔧 Setup Instructions:
1. Create a Google Sheets spreadsheet
2. Copy the spreadsheet ID from the URL: 
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
3. Add it to your .env file: GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

💡 Current value: ${this.config.spreadsheetId || 'undefined'}

Run 'npm run validate-env' to check your setup.
            `.trim());
        }
        
        if (!this.config.serviceAccountEmail || !this.config.privateKey) {
            throw new Error(`
❌ Google Service Account credentials are required but not found.

🔧 Setup Instructions:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account under IAM & Admin
5. Generate and download the JSON key file
6. Add credentials to your .env file:
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
7. Share your spreadsheet with the service account email

💡 Current values:
   Service Account: ${this.config.serviceAccountEmail || 'undefined'}
   Private Key: ${this.config.privateKey ? '[SET]' : 'undefined'}

Run 'npm run validate-env' to check your setup.
            `.trim());
        }
        
        this.sheets = null;
        this.auth = null;
    }

    async init() {
        try {
            // Create download directory if it doesn't exist
            await fs.mkdir(this.config.downloadPath, { recursive: true });
            
            // Initialize Google Auth
            this.auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: this.config.serviceAccountEmail,
                    private_key: this.config.privateKey.replace(/\\n/g, '\n')
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            
            // Initialize Sheets API
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            console.log('Google Sheets integration initialized');
            
            // Verify connection
            await this.validateConnection();
            
        } catch (error) {
            console.error('Failed to initialize Google Sheets integration:', error.message);
            throw error;
        }
    }

    async validateConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.config.spreadsheetId
            });
            
            console.log(`✓ Connected to spreadsheet: "${response.data.properties.title}"`);
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Google Sheets:', error.message);
            throw new Error(`Cannot access spreadsheet. Make sure:\n1. Spreadsheet ID is correct\n2. Service account has access to the spreadsheet\n3. Spreadsheet is shared with: ${this.config.serviceAccountEmail}`);
        }
    }

    async fetchNewSubmissions() {
        try {
            console.log('Fetching new guest submissions from Google Sheets...');
            
            // Get all data from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!A:Z`, // Get all columns
            });
            
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                console.log('No data found in spreadsheet');
                return [];
            }
            
            // First row contains headers
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            console.log(`Found ${dataRows.length} total submissions`);
            
            const guests = [];
            for (let i = 0; i < dataRows.length; i++) {
                const rowData = dataRows[i];
                const guest = this.parseGuestData(headers, rowData, i + 2); // +2 because of 0-based index and header row
                
                if (guest && guest.status === 'New') {
                    guests.push(guest);
                }
            }
            
            console.log(`Found ${guests.length} new submissions`);
            return guests;
            
        } catch (error) {
            console.error('Error fetching submissions:', error.message);
            throw error;
        }
    }

    parseGuestData(headers, rowData, rowNumber) {
        try {
            // Create object from headers and row data
            const data = {};
            headers.forEach((header, index) => {
                data[header] = rowData[index] || '';
            });
            
            // Map common field variations to standard names
            const guest = {
                id: `row_${rowNumber}`,
                rowNumber: rowNumber,
                firstName: data['First Name'] || data['firstName'] || data['first_name'] || '',
                lastName: data['Last Name'] || data['lastName'] || data['last_name'] || '',
                email: data['Email'] || data['email'] || '',
                phone: data['Phone'] || data['phone'] || data['Phone Number'] || '',
                passportNumber: data['Passport Number'] || data['passportNumber'] || data['passport_number'] || '',
                nationality: data['Nationality'] || data['nationality'] || '',
                passportExpiry: data['Passport Expiry'] || data['passportExpiry'] || data['passport_expiry'] || '',
                checkInDate: data['Check-in Date'] || data['checkInDate'] || data['checkin_date'] || '',
                checkOutDate: data['Check-out Date'] || data['checkOutDate'] || data['checkout_date'] || '',
                propertyNumber: data['Property Number'] || data['propertyNumber'] || data['property_number'] || '',
                totalGuests: parseInt(data['Total Guests'] || data['totalGuests'] || data['total_guests'] || '1'),
                children: parseInt(data['Children'] || data['children'] || '0'),
                checkInTime: data['Check-in Time'] || data['checkInTime'] || data['checkin_time'] || '3:00PM',
                checkOutTime: data['Check-out Time'] || data['checkOutTime'] || data['checkout_time'] || '11:00AM',
                passportFiles: this.parseFileUrls(data['Passport Files'] || data['passportFiles'] || data['passport_files'] || ''),
                status: data['Status'] || data['status'] || 'New',
                submissionDate: new Date(data['Timestamp'] || data['timestamp'] || Date.now()),
                lastModified: new Date()
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

    parseFileUrls(fileString) {
        if (!fileString) return [];
        
        // Typeform provides comma-separated file URLs
        const urls = fileString.split(',').map(url => url.trim()).filter(url => url);
        return urls.map(url => ({ url, filename: this.extractFilename(url) }));
    }

    extractFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return pathname.split('/').pop() || 'passport_document';
        } catch (error) {
            return 'passport_document';
        }
    }

    async downloadPassportDocuments(guest) {
        const downloadedFiles = [];
        
        if (!guest.passportFiles || guest.passportFiles.length === 0) {
            console.warn(`No passport files found for ${guest.firstName} ${guest.lastName}`);
            return downloadedFiles;
        }
        
        for (let i = 0; i < guest.passportFiles.length; i++) {
            const file = guest.passportFiles[i];
            try {
                const downloadedPath = await this.downloadFile(file, guest.passportNumber, i);
                downloadedFiles.push(downloadedPath);
                console.log(`Downloaded passport document: ${downloadedPath}`);
            } catch (error) {
                console.error(`Failed to download file for ${guest.firstName} ${guest.lastName}:`, error);
            }
        }
        
        return downloadedFiles;
    }

    async downloadFile(file, passportNumber, index = 0) {
        const fileUrl = file.url;
        const originalFilename = file.filename || `passport_${passportNumber}_${index}`;
        
        // Extract file extension
        const urlParts = originalFilename.split('.');
        const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1] : 'pdf';
        
        // Create safe filename
        const safeFileName = `${passportNumber}_${index}.${extension}`;
        const filePath = path.join(this.config.downloadPath, safeFileName);
        
        // Download the file
        return new Promise((resolve, reject) => {
            const fileStream = require('fs').createWriteStream(filePath);
            
            https.get(fileUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${response.statusCode}`));
                    return;
                }
                
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(filePath);
                });
                
                fileStream.on('error', (error) => {
                    fs.unlink(filePath); // Delete the file on error
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    async updateSubmissionStatus(guestId, status, notes = '') {
        try {
            const rowNumber = parseInt(guestId.replace('row_', ''));
            
            // Find the status column
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!1:1`,
            });
            
            const headers = headerResponse.data.values[0];
            const statusColumn = this.findColumnIndex(headers, ['Status', 'status']);
            const notesColumn = this.findColumnIndex(headers, ['Processing Notes', 'processingNotes', 'processing_notes']);
            const processedColumn = this.findColumnIndex(headers, ['Last Processed', 'lastProcessed', 'last_processed']);
            
            const updates = [];
            
            if (statusColumn !== -1) {
                updates.push({
                    range: `${this.config.sheetName}!${this.columnToLetter(statusColumn)}${rowNumber}`,
                    values: [[status]]
                });
            }
            
            if (notesColumn !== -1 && notes) {
                updates.push({
                    range: `${this.config.sheetName}!${this.columnToLetter(notesColumn)}${rowNumber}`,
                    values: [[notes]]
                });
            }
            
            if (processedColumn !== -1) {
                updates.push({
                    range: `${this.config.sheetName}!${this.columnToLetter(processedColumn)}${rowNumber}`,
                    values: [[new Date().toISOString()]]
                });
            }
            
            if (updates.length > 0) {
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: this.config.spreadsheetId,
                    resource: {
                        valueInputOption: 'RAW',
                        data: updates
                    }
                });
                
                console.log(`Updated status for guest ${guestId} to ${status}`);
            }
            
        } catch (error) {
            console.error('Error updating submission status:', error.message);
            throw error;
        }
    }

    async updateSyncStatus(guestId, hostawaySync = false, sakaniSync = false) {
        try {
            const rowNumber = parseInt(guestId.replace('row_', ''));
            
            // Find the sync columns
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!1:1`,
            });
            
            const headers = headerResponse.data.values[0];
            const hostawayColumn = this.findColumnIndex(headers, ['Hostaway Synced', 'hostawaySync', 'hostaway_sync']);
            const sakaniColumn = this.findColumnIndex(headers, ['Sakani Synced', 'sakaniSync', 'sakani_sync']);
            
            const updates = [];
            
            if (hostawayColumn !== -1) {
                updates.push({
                    range: `${this.config.sheetName}!${this.columnToLetter(hostawayColumn)}${rowNumber}`,
                    values: [[hostawaySync ? 'TRUE' : 'FALSE']]
                });
            }
            
            if (sakaniColumn !== -1) {
                updates.push({
                    range: `${this.config.sheetName}!${this.columnToLetter(sakaniColumn)}${rowNumber}`,
                    values: [[sakaniSync ? 'TRUE' : 'FALSE']]
                });
            }
            
            if (updates.length > 0) {
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: this.config.spreadsheetId,
                    resource: {
                        valueInputOption: 'RAW',
                        data: updates
                    }
                });
                
                console.log(`Updated sync status for guest ${guestId}`);
            }
            
        } catch (error) {
            console.error('Error updating sync status:', error.message);
            throw error;
        }
    }

    findColumnIndex(headers, possibleNames) {
        for (const name of possibleNames) {
            const index = headers.findIndex(header => 
                header && header.toLowerCase() === name.toLowerCase()
            );
            if (index !== -1) return index;
        }
        return -1;
    }

    columnToLetter(columnIndex) {
        let result = '';
        while (columnIndex >= 0) {
            result = String.fromCharCode(65 + (columnIndex % 26)) + result;
            columnIndex = Math.floor(columnIndex / 26) - 1;
        }
        return result;
    }

    async getGuestById(guestId) {
        try {
            const rowNumber = parseInt(guestId.replace('row_', ''));
            
            const headerResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!1:1`,
            });
            
            const rowResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!${rowNumber}:${rowNumber}`,
            });
            
            const headers = headerResponse.data.values[0];
            const rowData = rowResponse.data.values[0];
            
            return this.parseGuestData(headers, rowData, rowNumber);
            
        } catch (error) {
            console.error('Error fetching guest by ID:', error.message);
            throw error;
        }
    }

    async cleanupPassportFiles(guestId) {
        try {
            // Find and delete downloaded files for this guest
            const files = await fs.readdir(this.config.downloadPath);
            const guest = await this.getGuestById(guestId);
            
            if (guest && guest.passportNumber) {
                const filesToDelete = files.filter(file => 
                    file.includes(guest.passportNumber)
                );
                
                for (const file of filesToDelete) {
                    const filePath = path.join(this.config.downloadPath, file);
                    await fs.unlink(filePath);
                    console.log(`Deleted passport file: ${filePath}`);
                }
            }
            
        } catch (error) {
            console.error('Error cleaning up passport files:', error);
        }
    }

    // Convert guest data to CSV format for compatibility with existing scripts
    guestToCsvFormat(guest) {
        return {
            firstName: guest.firstName,
            lastName: guest.lastName,
            nationalityCode: this.getNationalityCode(guest.nationality),
            passportNumber: guest.passportNumber,
            passportExpiry: guest.passportExpiry,
            totalGuests: guest.totalGuests,
            children: guest.children,
            checkInDate: guest.checkInDate,
            checkInTime: guest.checkInTime,
            checkOutDate: guest.checkOutDate,
            checkOutTime: guest.checkOutTime
        };
    }

    // Map nationality names to codes (you'll need to expand this)
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
            // Add more mappings as needed
        };
        
        return nationalityMap[nationality] || '226'; // Default to US if not found
    }
}

module.exports = GoogleSheetsGuestIntegration;