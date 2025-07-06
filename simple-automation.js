const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class SakaniPortalAutomation {
    constructor(config = {}) {
        this.config = {
            headless: config.headless !== false, // Default true
            slowMo: config.slowMo || 250,
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            screenshotPath: config.screenshotPath || './screenshots',
            ...config
        };
        
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.currentProperty = null;
    }

    async init() {
        try {
            console.log('Initializing Sakani Portal automation...');
            
            // Create screenshots directory
            await fs.mkdir(this.config.screenshotPath, { recursive: true });
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: this.config.headless,
                slowMo: this.config.slowMo,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            this.page = await this.browser.newPage();
            this.page.setDefaultTimeout(this.config.timeout);
            
            // Set viewport
            await this.page.setViewport({
                width: 1280,
                height: 720
            });
            
            console.log('✓ Browser initialized');
            
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            console.log('Logging in to Sakani portal...');
            
            // Navigate to login page
            await this.page.goto('https://portal.sakani.ae/login', { 
                waitUntil: 'networkidle2' 
            });
            
            // Fill email
            await this.page.waitForSelector('#txtloginEmail');
            await this.page.click('#txtloginEmail');
            await this.page.type('#txtloginEmail', email);
            
            // Fill password
            await this.page.waitForSelector('#txtloginPassword');
            await this.page.click('#txtloginPassword');
            await this.page.type('#txtloginPassword', password);
            
            // Click login button and wait for navigation
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                this.page.click('#home button')
            ]);
            
            this.isLoggedIn = true;
            console.log('✓ Successfully logged in');
            
        } catch (error) {
            await this.takeScreenshot('login-error');
            console.error('Login failed:', error);
            throw error;
        }
    }

    async selectProperty(propertyNumber) {
        try {
            console.log(`Selecting property: ${propertyNumber}`);
            
            if (!this.isLoggedIn) {
                throw new Error('Must be logged in before selecting property');
            }
            
            // Click switch properties
            await this.page.waitForSelector('#liSwitchProperties > a');
            await this.page.click('#liSwitchProperties > a');
            
            // Search for property
            await this.page.waitForSelector('#search-friends');
            await this.page.click('#search-friends');
            await this.page.type('#search-friends', propertyNumber);
            
            // Wait a moment for search results
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Click on the property
            const propertySelector = 'div.h-list-body > div > div:nth-of-type(1) h6';
            await this.page.waitForSelector(propertySelector);
            await this.page.click(propertySelector);
            await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            this.currentProperty = propertyNumber;
            console.log(`✓ Selected property: ${propertyNumber}`);
            
        } catch (error) {
            await this.takeScreenshot('property-selection-error');
            console.error('Property selection failed:', error);
            throw error;
        }
    }

    async navigateToGuestManagement() {
        try {
            console.log('Navigating to Guest Management...');
            
            // Expand menu if needed
            try {
                await this.page.waitForSelector('#mobile-collapse1 > span', { timeout: 5000 });
                await this.page.click('#mobile-collapse1 > span');
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                // Menu might already be expanded
            }
            
            // Click Guest Management - try multiple selectors
            const guestManagementSelectors = [
                'li:nth-of-type(11) span.pcoded-mtext', // Original selector
                'span.pcoded-mtext:has-text("Guest Management")', // Text-based
                '[title="Guest Management"]', // Title attribute
                'a[href*="guest"]', // Link containing "guest"
                'span:contains("Guest Management")', // Contains text
                '.pcoded-mtext' // All menu items
            ];
            
            let clicked = false;
            for (const selector of guestManagementSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    
                    // If this is the general menu selector, find the one with Guest Management text
                    if (selector === '.pcoded-mtext') {
                        const elements = await this.page.$$(selector);
                        for (const element of elements) {
                            const text = await this.page.evaluate(el => el.textContent, element);
                            if (text && text.includes('Guest Management')) {
                                await element.click();
                                clicked = true;
                                break;
                            }
                        }
                    } else {
                        await this.page.click(selector);
                        clicked = true;
                    }
                    
                    if (clicked) {
                        console.log(`✓ Found Guest Management using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Try next selector
                    continue;
                }
            }
            
            if (!clicked) {
                // Take screenshot to debug
                await this.takeScreenshot('menu-structure-debug');
                throw new Error('Could not find Guest Management menu item');
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('✓ Navigated to Guest Management');
            
        } catch (error) {
            await this.takeScreenshot('navigation-error');
            console.error('Navigation failed:', error);
            throw error;
        }
    }

    async addGuest(guestData, passportFilePath = null) {
        try {
            console.log(`Adding guest: ${guestData.firstName} ${guestData.lastName}`);
            
            // Click "Add New Guest" button
            await this.page.waitForSelector('div.pcoded-main-container button');
            await this.page.click('div.pcoded-main-container button');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fill guest information
            await this.fillGuestForm(guestData);
            
            // Upload passport if provided
            if (passportFilePath) {
                await this.uploadPassport(passportFilePath);
            }
            
            // Submit the form
            await this.submitGuestForm();
            
            console.log(`✓ Successfully added guest: ${guestData.firstName} ${guestData.lastName}`);
            
        } catch (error) {
            await this.takeScreenshot(`guest-error-${guestData.passportNumber}`);
            console.error(`Error adding guest ${guestData.firstName} ${guestData.lastName}:`, error);
            throw error;
        }
    }

    async fillGuestForm(guestData) {
        try {
            // First Name
            await this.page.waitForSelector('#FirstName');
            await this.page.click('#FirstName');
            await this.page.type('#FirstName', guestData.firstName);
            
            // Last Name
            await this.page.click('#LastName');
            await this.page.type('#LastName', guestData.lastName);
            
            // Nationality (dropdown)
            await this.page.click('#ddlNationality');
            await this.page.type('#ddlNationality', guestData.nationalityCode.toString());
            
            // Passport Number
            await this.page.click('#PassportNumber');
            await this.page.type('#PassportNumber', guestData.passportNumber);
            
            // Passport Expiry Date
            await this.page.click('#PassportExpirtDate');
            await this.page.type('#PassportExpirtDate', this.formatDate(guestData.passportExpiry));
            
            // Total Guests
            await this.page.click('#ddlTotalGuests');
            await this.page.type('#ddlTotalGuests', guestData.totalGuests.toString());
            
            // Children
            await this.page.click('#ddlChildrens');
            await this.page.type('#ddlChildrens', guestData.children.toString());
            
            // Check-in Date
            await this.page.click('#CheckInDate');
            await this.page.type('#CheckInDate', this.formatDate(guestData.checkInDate));
            
            // Check-in Time
            if (guestData.checkInTime) {
                await this.page.click('#ddlCheckInTime');
                await this.page.type('#ddlCheckInTime', guestData.checkInTime);
            }
            
            // Check-out Date
            await this.page.click('#CheckOutDate');
            await this.page.type('#CheckOutDate', this.formatDate(guestData.checkOutDate));
            
            // Check-out Time
            if (guestData.checkOutTime) {
                await this.page.click('#CheckOutTime');
                await this.page.type('#CheckOutTime', guestData.checkOutTime);
            }
            
            console.log('✓ Guest form filled successfully');
            
        } catch (error) {
            console.error('Error filling guest form:', error);
            throw error;
        }
    }

    async uploadPassport(filePath) {
        try {
            console.log(`Uploading passport: ${filePath}`);
            
            // Check if file exists
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            if (!fileExists) {
                console.warn(`Passport file not found: ${filePath}`);
                return;
            }
            
            // Find and click the upload button
            await this.page.waitForSelector('div:nth-of-type(4) > div:nth-of-type(3) > div span');
            await this.page.click('div:nth-of-type(4) > div:nth-of-type(3) > div span');
            
            // Wait for file input to appear and upload
            const fileInput = await this.page.waitForSelector('input[type="file"]', { visible: true });
            await fileInput.uploadFile(filePath);
            
            // Wait for upload to complete
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log('✓ Passport uploaded successfully');
            
        } catch (error) {
            console.error('Error uploading passport:', error);
            // Don't throw here - passport upload is optional
        }
    }

    async submitGuestForm() {
        try {
            // Click submit button (usually the last checkbox or submit button)
            await this.page.waitForSelector('div.m-t-15 > div:nth-of-type(2) label');
            await this.page.click('div.m-t-15 > div:nth-of-type(2) label');
            
            // Wait for confirmation or redirect
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log('✓ Guest form submitted');
            
        } catch (error) {
            console.error('Error submitting guest form:', error);
            throw error;
        }
    }

    async takeScreenshot(filename) {
        try {
            const screenshotPath = path.join(this.config.screenshotPath, `${filename}-${Date.now()}.png`);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        } catch (error) {
            console.error('Error taking screenshot:', error);
        }
    }

    formatDate(dateString) {
        // Convert date to YYYY-MM-DD format expected by the portal
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // Return as-is if invalid
        
        return date.toISOString().split('T')[0];
    }

    async retry(operation, attempts = null) {
        const maxAttempts = attempts || this.config.retryAttempts;
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                return await operation();
            } catch (error) {
                console.log(`Attempt ${i + 1}/${maxAttempts} failed:`, error.message);
                
                if (i === maxAttempts - 1) {
                    throw error; // Last attempt failed
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('✓ Browser closed');
            }
        } catch (error) {
            console.error('Error closing browser:', error);
        }
    }

    // Static method to create and run a complete guest submission
    static async submitGuest(guestData, config = {}) {
        const automation = new SakaniPortalAutomation(config);
        
        try {
            await automation.init();
            
            await automation.login(
                config.sakaniEmail || process.env.SAKANI_EMAIL,
                config.sakaniPassword || process.env.SAKANI_PASSWORD
            );
            
            await automation.selectProperty(
                config.sakaniProperty || process.env.SAKANI_PROPERTY || '3005'
            );
            
            await automation.navigateToGuestManagement();
            
            await automation.addGuest(guestData, guestData.passportFilePath);
            
            return { success: true, message: 'Guest submitted successfully' };
            
        } catch (error) {
            console.error('Guest submission failed:', error);
            return { success: false, message: error.message };
            
        } finally {
            await automation.close();
        }
    }
}

module.exports = SakaniPortalAutomation;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage: node simple-automation.js <command> [options]

Commands:
  test-login              Test login functionality
  test-guest <csvFile>    Test guest submission with CSV data
  submit-guest <guestData> Submit a single guest
  
Examples:
  node simple-automation.js test-login
  node simple-automation.js test-guest guests-sample.csv
        `);
        process.exit(0);
    }
    
    const command = args[0];
    
    (async () => {
        try {
            const automation = new SakaniPortalAutomation({ headless: false });
            
            switch (command) {
                case 'test-login':
                    await automation.init();
                    await automation.login(
                        process.env.SAKANI_EMAIL,
                        process.env.SAKANI_PASSWORD
                    );
                    await automation.selectProperty(process.env.SAKANI_PROPERTY || '3005');
                    console.log('✓ Login test successful');
                    await automation.close();
                    break;
                    
                case 'test-navigation':
                    await automation.init();
                    await automation.login(
                        process.env.SAKANI_EMAIL,
                        process.env.SAKANI_PASSWORD
                    );
                    await automation.selectProperty(process.env.SAKANI_PROPERTY || '3005');
                    await automation.navigateToGuestManagement();
                    console.log('✓ Navigation test successful');
                    await automation.close();
                    break;
                    
                case 'test-guest':
                    if (!args[1]) {
                        console.error('Please provide CSV file path');
                        process.exit(1);
                    }
                    
                    const csv = require('csv-parse/sync');
                    const csvData = await fs.readFile(args[1], 'utf8');
                    const guests = csv.parse(csvData, { columns: true });
                    
                    if (guests.length === 0) {
                        console.error('No guests found in CSV');
                        process.exit(1);
                    }
                    
                    await automation.init();
                    await automation.login(
                        process.env.SAKANI_EMAIL,
                        process.env.SAKANI_PASSWORD
                    );
                    await automation.selectProperty(process.env.SAKANI_PROPERTY || '3005');
                    await automation.navigateToGuestManagement();
                    
                    // Test with first guest
                    await automation.addGuest(guests[0]);
                    console.log('✓ Guest submission test successful');
                    await automation.close();
                    break;
                    
                default:
                    console.error(`Unknown command: ${command}`);
                    process.exit(1);
            }
            
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    })();
}