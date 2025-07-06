# Simple Guest Registration System - Setup Guide

This is a simplified guest registration automation system that follows this workflow:

**Guest Form → Google Sheets → Sakani Portal**

## Overview

1. **Guest Registration Form** (`guest-form.html`) - Simple HTML form for guests to submit their information
2. **Google Apps Script** (`sheets-webapp.js`) - Handles form submissions and stores data in Google Sheets
3. **Simple Orchestrator** (`simple-orchestrator.js`) - Processes new entries and submits to Sakani portal
4. **Website Automation** (`simple-automation.js`) - Handles Sakani portal interactions

## Setup Instructions

### Step 1: Environment Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example.simple .env
   ```

2. **Install dependencies:**
   ```bash
   # If using the simplified package.json:
   cp package.json.simple package.json
   npm install
   ```

### Step 2: Google Sheets Setup

1. **Create a Google Sheets spreadsheet:**
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new spreadsheet
   - Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

2. **Set up Google Cloud Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Sheets API
   - Go to IAM & Admin → Service Accounts
   - Create a service account
   - Generate and download the JSON key file
   - Extract the `client_email` and `private_key` from the JSON file

3. **Share your spreadsheet:**
   - Open your Google Sheets spreadsheet
   - Click "Share" button
   - Add your service account email (from the JSON file) with Editor permissions

4. **Update your .env file:**
   ```env
   GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
   ```

### Step 3: Google Apps Script Setup

1. **Create a new Google Apps Script project:**
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"
   - Replace the default code with the content from `sheets-webapp.js`

2. **Update the configuration:**
   - Replace `YOUR_SPREADSHEET_ID_HERE` with your actual spreadsheet ID
   - Save the project

3. **Set up the spreadsheet headers:**
   - In the Google Apps Script editor, run the `setupSheet()` function once
   - This will create the proper headers in your spreadsheet

4. **Deploy as web app:**
   - Click "Deploy" → "New deployment"
   - Choose type: "Web app"
   - Execute as: "Me"
   - Access: "Anyone"
   - Click "Deploy"
   - Copy the web app URL

5. **Update the HTML form:**
   - Open `guest-form.html`
   - Replace `YOUR_GOOGLE_APPS_SCRIPT_URL` with your actual web app URL

### Step 4: Sakani Portal Setup

1. **Update your .env file with Sakani credentials:**
   ```env
   SAKANI_EMAIL=ibrahim@serayastays.com
   SAKANI_PASSWORD=@SerayaS2024
   SAKANI_PROPERTY=3005
   ```

### Step 5: Validation and Testing

1. **Validate your environment:**
   ```bash
   npm run validate-env
   ```

2. **Test Google Sheets connection:**
   ```bash
   npm run test-sheets
   ```

3. **Test Sakani portal login:**
   ```bash
   npm run test-sakani
   ```

4. **Test with sample data:**
   ```bash
   npm run test-guest
   ```

## Usage

### Running the System

1. **Process guests once:**
   ```bash
   npm run process
   ```

2. **Start continuous processing:**
   ```bash
   npm start
   ```

3. **Check processing statistics:**
   ```bash
   npm run stats
   ```

### Guest Registration Workflow

1. **Guest fills out the form** (`guest-form.html`)
   - Form validates required fields
   - Handles passport file uploads
   - Submits to Google Apps Script

2. **Google Apps Script processes submission**
   - Validates data
   - Saves passport files to Google Drive
   - Creates new row in Google Sheets with status "New"

3. **Simple Orchestrator processes new guests**
   - Fetches guests with status "New" from Google Sheets
   - Updates status to "Processing"
   - Downloads passport files
   - Submits to Sakani portal
   - Updates status to "Completed" or "Failed"
   - Logs results

## File Structure

```
├── guest-form.html              # Guest registration form
├── sheets-webapp.js             # Google Apps Script code
├── simple-orchestrator.js       # Main processing coordinator
├── simple-automation.js         # Sakani portal automation
├── simple-env-validation.js     # Environment validation
├── .env.example.simple         # Environment template
├── package.json.simple         # Simplified dependencies
└── SETUP-SIMPLE.md            # This setup guide
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Yes | Google Sheets spreadsheet ID | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | Service account email | `your-service-account@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Yes | Service account private key | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` |
| `SAKANI_EMAIL` | Yes | Sakani portal email | `ibrahim@serayastays.com` |
| `SAKANI_PASSWORD` | Yes | Sakani portal password | `@SerayaS2024` |
| `SAKANI_PROPERTY` | No | Property number | `3005` (default) |
| `GOOGLE_SHEET_NAME` | No | Sheet tab name | `Guests` (default) |
| `NODE_ENV` | No | Environment mode | `development` or `production` |

## Troubleshooting

### Common Issues

1. **"Cannot access spreadsheet" error:**
   - Ensure the spreadsheet is shared with your service account email
   - Verify the spreadsheet ID is correct

2. **"Invalid private key" error:**
   - Ensure the private key includes the `\n` characters
   - Make sure to wrap the key in quotes in the .env file

3. **Sakani login fails:**
   - Verify your email and password are correct
   - Check if the portal website structure has changed

4. **Form submission fails:**
   - Verify the Google Apps Script web app URL is correct
   - Check that the web app is deployed with proper permissions

### Logs and Debugging

- Processing results are saved to `./logs/processing-results-*.json`
- Screenshots of errors are saved to `./screenshots/`
- Use `NODE_ENV=development` for verbose browser automation (non-headless)

## Differences from Complex Version

This simplified version removes:
- ❌ Notion integration
- ❌ Hostaway integration  
- ❌ Complex webhook server
- ❌ Multiple data source support
- ❌ Advanced error recovery

And focuses on:
- ✅ Simple Google Sheets integration
- ✅ Direct Sakani portal automation
- ✅ Clean, maintainable code
- ✅ Easy setup and configuration
- ✅ Essential error handling