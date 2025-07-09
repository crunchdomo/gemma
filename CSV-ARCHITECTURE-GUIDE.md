# 📊 CSV-Based Guest Management Architecture

## 🎯 Overview

This is a **much simpler and better** architecture than using Google Sheets as middleware. Here's how it works:

```
Guest Form → Local Server → Local CSV/JSON Files → Hostaway Import + Sakani Automation
```

## 🚀 Benefits Over Google Sheets Approach

| Factor | Google Sheets | CSV-Based | Winner |
|--------|--------------|-----------|--------|
| **Complexity** | Form → Apps Script → Sheets → API → Local | Form → Local Server → Files | ✅ CSV |
| **Speed** | API calls, network delays | Direct file writes | ✅ CSV |
| **Dependencies** | Google account, API keys, service accounts | None | ✅ CSV |
| **Data Control** | Data in cloud | Data local | ✅ CSV |
| **Hostaway Import** | Manual export from Sheets | Direct CSV ready | ✅ CSV |
| **Cost** | Free (with limits) | Free (unlimited) | ✅ CSV |

## 📁 Smart Folder Structure

```
guest-data/
├── index.json                   # Searchable index of all guests
├── guest_2024-07-07T10-30-45_seraya-residence_2b_AB123456/
│   ├── guest_info.json          # Complete guest data
│   ├── hostaway_import.csv      # Ready for Hostaway
│   ├── sakani_data.json         # Formatted for automation
│   └── passport_files/
│       ├── passport_front.jpg
│       └── passport_back.pdf
├── guest_2024-07-07T11-15-22_downtown-lofts_5a_CD789012/
│   └── ... (same structure)
├── hostaway_batches/
│   ├── batch_2024-07-07.csv    # Combined CSV for bulk import
│   └── batch_2024-07-08.csv
└── logs/
    └── processing-results-*.json
```

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
# Copy the CSV package.json
cp package-csv.json package.json

# Install all dependencies
npm install
```

### 2. Configure Environment
Create `.env` file:
```bash
# Sakani credentials (same as before)
SAKANI_EMAIL=your_email@example.com
SAKANI_PASSWORD=your_password
SAKANI_PROPERTY=3005

# Server settings
SERVER_PORT=3001
DATA_DIR=./guest-data
```

### 3. Start the System

#### Start Form Handler Server:
```bash
npm start
# Server runs on http://localhost:3001
```

#### Open Guest Form:
```bash
open guest-form-local.html
# Or visit file:// in your browser
```

## 📋 How It Works

### 1. Guest Submits Form
- Guest fills out `guest-form-local.html`
- Form includes property details (name, unit number)
- Uploads passport documents
- Submits to local server

### 2. Server Processes Submission
- Creates unique guest folder
- Saves passport files locally
- Generates:
  - `guest_info.json` - All data
  - `hostaway_import.csv` - Hostaway format
  - `sakani_data.json` - Automation format
- Returns confirmation ID

### 3. Process Guests for Sakani
```bash
npm run process
```
- Reads pending guests from folders
- Submits each to Sakani portal
- Updates status in `guest_info.json`

### 4. Generate Hostaway Batch
```bash
npm run batch
```
- Collects all completed guests
- Creates combined CSV for Hostaway import
- Saves to `hostaway_batches/batch_[date].csv`

### 5. Import to Hostaway
- Log into Hostaway
- Go to Reservations → Import
- Upload the batch CSV
- Done! ✅

## 🎯 Complete Workflow

### Morning Routine:
1. **Check new submissions**: Look in `guest-data/` folder
2. **Process Sakani**: `npm run process`
3. **Generate batch**: `npm run batch`
4. **Import to Hostaway**: Upload CSV

### For Each Guest:
1. ✅ Guest data saved locally
2. ✅ Passport files organized
3. ✅ Sakani automation runs
4. ✅ Hostaway CSV ready
5. ✅ Complete tracking

## 📊 Hostaway CSV Format

The system automatically generates CSVs with these fields:
- Confirmation Code
- Guest First/Last Name
- Guest Email/Phone
- Property Name & Unit
- Check-in/out Dates & Times
- Number of Guests/Children
- Status & Notes

## 🔍 Monitoring & Status

### Search Guests:
```bash
# Search by name
npm run search -- --name "John"

# Search by property and status
npm run search -- --property "Seraya" --status "pending"

# Search by check-in/out date
npm run search -- --date "2024-07-09"

# Search by unit
npm run search -- --unit "2B"

# Search by passport number
npm run search -- --passport "AB123456"
```

### View Processing Stats:
```bash
npm run stats
```

### Check Today's Batch:
```bash
cat guest-data/hostaway_batches/batch_$(date +%Y-%m-%d).csv
```

## 🚀 Advantages

1. **No Cloud Dependencies** - Everything runs locally
2. **Direct CSV Generation** - Hostaway import ready instantly
3. **Organized File Storage** - Passports with guest data
4. **Simple Architecture** - Easy to understand and maintain
5. **Fast Processing** - No API delays
6. **Complete Control** - Your data, your server
7. **Smart Search** - Find guests by name, property, date, or status
8. **Enhanced Organization** - Folders include property/unit info
9. **Searchable Index** - Fast guest lookup without scanning folders

## 🛠️ Troubleshooting

### Form Not Submitting:
- Check server is running: `npm start`
- Verify port 3001 is available
- Check browser console for errors

### Sakani Processing Fails:
- Run `npm run validate-env`
- Check passport files exist
- Verify Sakani credentials

### Hostaway Import Issues:
- Verify CSV format matches requirements
- Check date formats (YYYY-MM-DD)
- Ensure all required fields present

## 🎉 Why This Is Better

**Before (Google Sheets)**:
- Complex setup with service accounts
- API rate limits and quotas
- Network delays
- Manual CSV export from Sheets
- Data scattered across cloud services

**Now (CSV-Based)**:
- Simple local file system
- Instant processing
- Direct CSV generation
- All data in one place
- No external dependencies

This architecture is **simpler, faster, and more reliable** than the Google Sheets approach!