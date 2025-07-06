#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SimpleEnvironmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.isDetailed = process.argv.includes('--detailed');
    }

    checkEnvFile() {
        const envPath = path.join(__dirname, '.env');
        
        if (!fs.existsSync(envPath)) {
            this.errors.push({
                type: 'MISSING_ENV_FILE',
                message: '.env file not found',
                solution: 'Copy .env.example to .env and fill in your credentials:\n  cp .env.example .env'
            });
            return false;
        }
        
        console.log('✓ .env file exists');
        return true;
    }

    validateEnvironmentVariables() {
        console.log('\n🔍 Validating Environment Variables:');
        
        // Required variables for Google Sheets
        const requiredVars = [
            {
                name: 'GOOGLE_SHEETS_SPREADSHEET_ID',
                description: 'Google Sheets Spreadsheet ID',
                example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
                setupUrl: 'Get from spreadsheet URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit'
            },
            {
                name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
                description: 'Google Service Account Email',
                example: 'your-service-account@project.iam.gserviceaccount.com',
                setupUrl: 'Google Cloud Console → IAM & Admin → Service Accounts'
            },
            {
                name: 'GOOGLE_PRIVATE_KEY',
                description: 'Google Service Account Private Key',
                example: '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n',
                setupUrl: 'Download from service account JSON key file'
            }
        ];

        // Required variables for Sakani
        const sakaniVars = [
            {
                name: 'SAKANI_EMAIL',
                description: 'Sakani Portal Email',
                example: 'ibrahim@serayastays.com',
                setupUrl: 'Your Sakani portal login credentials'
            },
            {
                name: 'SAKANI_PASSWORD',
                description: 'Sakani Portal Password',
                example: '@SerayaS2024',
                setupUrl: 'Your Sakani portal login credentials'
            }
        ];

        // Optional variables
        const optionalVars = [
            {
                name: 'SAKANI_PROPERTY',
                description: 'Sakani Property Number',
                example: '3005',
                default: '3005'
            },
            {
                name: 'GOOGLE_SHEET_NAME',
                description: 'Google Sheet Tab Name',
                example: 'Guests',
                default: 'Guests'
            }
        ];

        console.log('\n📊 Google Sheets Configuration:');
        this.validateVarGroup(requiredVars, true);

        console.log('\n🏢 Sakani Portal Configuration:');
        this.validateVarGroup(sakaniVars, true);

        console.log('\n⚙️ Optional Configuration:');
        this.validateVarGroup(optionalVars, false);
    }

    validateVarGroup(vars, required) {
        for (const envVar of vars) {
            const value = process.env[envVar.name];
            
            if (!value) {
                if (required) {
                    this.errors.push({
                        type: 'MISSING_REQUIRED_VAR',
                        message: `${envVar.name} is required but not set`,
                        solution: `Set ${envVar.name} in your .env file\n  Description: ${envVar.description}\n  Example: ${envVar.name}=${envVar.example}\n  Setup: ${envVar.setupUrl || 'See documentation'}`
                    });
                    console.log(`❌ ${envVar.name}: Missing (REQUIRED)`);
                } else {
                    this.warnings.push({
                        type: 'MISSING_OPTIONAL_VAR',
                        message: `${envVar.name} is not set (using default: ${envVar.default || 'none'})`,
                        solution: `Set ${envVar.name} in your .env file if you want to customize\n  Description: ${envVar.description}`
                    });
                    console.log(`ℹ️  ${envVar.name}: Not set (using default: ${envVar.default || 'none'})`);
                }
                continue;
            }

            // Basic validation
            if (envVar.name.includes('EMAIL') && !value.includes('@')) {
                this.errors.push({
                    type: 'INVALID_FORMAT',
                    message: `${envVar.name} should be a valid email address`,
                    solution: 'Provide a valid email address'
                });
                console.log(`❌ ${envVar.name}: Invalid email format`);
                continue;
            }

            if (envVar.name === 'GOOGLE_PRIVATE_KEY' && !value.includes('BEGIN PRIVATE KEY')) {
                this.errors.push({
                    type: 'INVALID_FORMAT',
                    message: `${envVar.name} should be a valid private key`,
                    solution: 'Ensure you copied the full private key from the JSON file'
                });
                console.log(`❌ ${envVar.name}: Invalid private key format`);
                continue;
            }

            console.log(`✓ ${envVar.name}: Set and valid`);
        }
    }

    checkFeatureAvailability() {
        console.log('\n🎯 Feature Availability:');
        
        const features = [
            {
                name: 'Google Sheets Integration',
                required: ['GOOGLE_SHEETS_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'],
                description: 'Guest data collection and management'
            },
            {
                name: 'Sakani Portal Automation',
                required: ['SAKANI_EMAIL', 'SAKANI_PASSWORD'],
                description: 'Automated guest submission to building portal'
            }
        ];

        for (const feature of features) {
            const hasAllRequired = feature.required.every(envVar => {
                const value = process.env[envVar];
                return value && value.trim() !== '';
            });

            if (hasAllRequired) {
                console.log(`✅ ${feature.name}: Available`);
            } else {
                const missing = feature.required.filter(envVar => {
                    const value = process.env[envVar];
                    return !value || value.trim() === '';
                });
                console.log(`❌ ${feature.name}: Disabled (missing: ${missing.join(', ')})`);
            }
            
            if (this.isDetailed) {
                console.log(`   📝 ${feature.description}`);
            }
        }
    }

    printSummary() {
        console.log('\n📊 Validation Summary:');
        
        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('🎉 All environment variables are properly configured!');
            console.log('\n✨ You can now run:');
            console.log('  npm run test-sheets     # Test Google Sheets connection');
            console.log('  npm run test-sakani     # Test Sakani automation');
            console.log('  npm run process         # Process guests');
            return true;
        }

        if (this.errors.length > 0) {
            console.log(`❌ ${this.errors.length} error(s) found:`);
            this.errors.forEach((error, i) => {
                console.log(`\n${i + 1}. ${error.message}`);
                if (this.isDetailed) {
                    console.log(`   💡 Solution: ${error.solution}`);
                }
            });
        }

        if (this.warnings.length > 0) {
            console.log(`\n⚠️  ${this.warnings.length} warning(s):`);
            this.warnings.forEach((warning, i) => {
                console.log(`\n${i + 1}. ${warning.message}`);
                if (this.isDetailed) {
                    console.log(`   💡 Solution: ${warning.solution}`);
                }
            });
        }

        if (this.errors.length > 0) {
            console.log('\n🔧 Quick Setup Steps:');
            console.log('1. Copy environment template: cp .env.example .env');
            console.log('2. Set up Google Sheets:');
            console.log('   - Create a Google Sheets spreadsheet');
            console.log('   - Set up Google Cloud service account');
            console.log('   - Share spreadsheet with service account email');
            console.log('3. Get Sakani portal credentials');
            console.log('4. Update .env with your actual credentials');
            console.log('5. Run: npm run validate-env');
            
            return false;
        }

        return true;
    }

    async testConnections() {
        if (this.errors.length > 0) {
            console.log('\n❌ Cannot test connections - fix errors first');
            return;
        }

        console.log('\n🔌 Testing Connections:');

        // Test Google Sheets
        const hasGoogleSheets = process.env.GOOGLE_SHEETS_SPREADSHEET_ID && 
                               process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
                               process.env.GOOGLE_PRIVATE_KEY;
        
        if (hasGoogleSheets) {
            try {
                const SimpleOrchestrator = require('./simple-orchestrator');
                const orchestrator = new SimpleOrchestrator();
                await orchestrator.init();
                const guests = await orchestrator.fetchNewGuests();
                console.log(`✅ Google Sheets: Connected (found ${guests.length} guests)`);
            } catch (error) {
                console.log(`❌ Google Sheets: ${error.message}`);
            }
        }

        // Test Sakani (basic validation only - not actual login)
        const hasSakani = process.env.SAKANI_EMAIL && process.env.SAKANI_PASSWORD;
        if (hasSakani) {
            console.log(`✅ Sakani Portal: Credentials configured (${process.env.SAKANI_EMAIL})`);
            console.log(`   Property: ${process.env.SAKANI_PROPERTY || '3005'}`);
            console.log(`   Note: Run 'npm run test-sakani' to test actual login`);
        }
    }

    async run() {
        console.log('🔍 Simple Environment Validation\n');

        if (!this.checkEnvFile()) {
            this.printSummary();
            return;
        }

        this.validateEnvironmentVariables();
        this.checkFeatureAvailability();
        
        const isValid = this.printSummary();

        if (isValid && this.isDetailed) {
            await this.testConnections();
        }

        process.exit(this.errors.length > 0 ? 1 : 0);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    const validator = new SimpleEnvironmentValidator();
    validator.run().catch(console.error);
}

module.exports = SimpleEnvironmentValidator;