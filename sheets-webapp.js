/**
 * Google Apps Script Web App for Guest Registration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Apps Script project at script.google.com
 * 2. Replace the default Code.gs content with this code
 * 3. Create a Google Sheets spreadsheet
 * 4. Update the SPREADSHEET_ID constant below with your spreadsheet ID
 * 5. Deploy as web app with "Execute as: Me" and "Access: Anyone"
 * 6. Copy the web app URL and update the HTML form
 * 7. Set up the spreadsheet headers (run setupSheet() once)
 */

// Configuration
const SPREADSHEET_ID = '19sppToe2z6y0hYZDibhuOkR-3ICm9ZH9YndRGta_ZXQ'; // Your actual spreadsheet ID
const SHEET_NAME = 'Sheet1';

/**
 * Handle HTTP POST requests from the registration form
 */
function doPost(e) {
  try {
    // Parse the request data
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.firstName || !data.lastName || !data.passportNumber) {
      throw new Error('Missing required fields');
    }
    
    // Process and save the guest data
    const result = saveGuestData(data);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Guest data saved successfully',
        rowId: result.rowId
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error processing request:', error);
    
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        message: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle HTTP GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      message: 'Guest Registration API is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Save guest data to Google Sheets
 */
function saveGuestData(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      setupSheetHeaders(sheet);
    }
    
    // Process passport files
    const passportFileUrls = processPassportFiles(data.passportFiles, data.passportNumber);
    
    // Map nationality to code
    const nationalityCode = getNationalityCode(data.nationality);
    
    // Prepare row data
    const rowData = [
      data.timestamp,                    // A: Timestamp
      data.firstName,                    // B: First Name
      data.lastName,                     // C: Last Name
      data.email,                        // D: Email
      data.phone || '',                  // E: Phone
      data.nationality,                  // F: Nationality
      nationalityCode,                   // G: Nationality Code
      data.passportNumber,               // H: Passport Number
      data.passportExpiry,               // I: Passport Expiry
      passportFileUrls.join(', '),       // J: Passport Files
      data.checkInDate,                  // K: Check-in Date
      data.checkInTime || '3:00PM',      // L: Check-in Time
      data.checkOutDate,                 // M: Check-out Date
      data.checkOutTime || '11:00AM',    // N: Check-out Time
      parseInt(data.totalGuests),        // O: Total Guests
      parseInt(data.children) || 0,      // P: Children
      data.status || 'New',              // Q: Status
      '',                                // R: Processing Notes
      '',                                // S: Last Processed
      '',                                // T: Hostaway Synced
      ''                                 // U: Sakani Synced
    ];
    
    // Add row to sheet
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Insert the data
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    
    console.log(`Guest data saved for ${data.firstName} ${data.lastName} in row ${newRow}`);
    
    return {
      success: true,
      rowId: `row_${newRow}`,
      row: newRow
    };
    
  } catch (error) {
    console.error('Error saving guest data:', error);
    throw error;
  }
}

/**
 * Process passport files and save to Google Drive
 */
function processPassportFiles(files, passportNumber) {
  const fileUrls = [];
  
  if (!files || files.length === 0) {
    return fileUrls;
  }
  
  try {
    // Create folder for passport documents
    const folderName = `Passport_Documents_${passportNumber}`;
    let folder;
    
    try {
      const folders = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    } catch (e) {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Save each file
    files.forEach((file, index) => {
      try {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(file.data),
          file.type,
          `${passportNumber}_${index}_${file.name}`
        );
        
        const driveFile = folder.createFile(blob);
        
        // Make file viewable by anyone with the link
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        fileUrls.push(driveFile.getUrl());
        
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
      }
    });
    
  } catch (error) {
    console.error('Error processing passport files:', error);
  }
  
  return fileUrls;
}

/**
 * Set up sheet headers (run this once after creating the spreadsheet)
 */
function setupSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  
  setupSheetHeaders(sheet);
  console.log('Sheet headers set up successfully');
}

/**
 * Set up the headers for the guest data sheet
 */
function setupSheetHeaders(sheet) {
  const headers = [
    'Timestamp',           // A
    'First Name',          // B
    'Last Name',           // C
    'Email',               // D
    'Phone',               // E
    'Nationality',         // F
    'Nationality Code',    // G
    'Passport Number',     // H
    'Passport Expiry',     // I
    'Passport Files',      // J
    'Check-in Date',       // K
    'Check-in Time',       // L
    'Check-out Date',      // M
    'Check-out Time',      // N
    'Total Guests',        // O
    'Children',            // P
    'Status',              // Q
    'Processing Notes',    // R
    'Last Processed',      // S
    'Hostaway Synced',     // T
    'Sakani Synced'        // U
  ];
  
  // Set headers in first row
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  
  // Set column widths
  sheet.setColumnWidth(1, 180);  // Timestamp
  sheet.setColumnWidth(2, 120);  // First Name
  sheet.setColumnWidth(3, 120);  // Last Name
  sheet.setColumnWidth(4, 200);  // Email
  sheet.setColumnWidth(10, 300); // Passport Files
  sheet.setColumnWidth(17, 100); // Status
  sheet.setColumnWidth(18, 200); // Processing Notes
  
  // Freeze header row
  sheet.setFrozenRows(1);
}

/**
 * Map nationality names to codes for Sakani portal
 */
function getNationalityCode(nationality) {
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

/**
 * Test function to verify the setup
 */
function testSetup() {
  console.log('Testing Google Apps Script setup...');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✓ Spreadsheet accessible:', spreadsheet.getName());
    
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      setupSheetHeaders(sheet);
      console.log('✓ Sheet created with headers');
    } else {
      console.log('✓ Sheet exists:', sheet.getName());
    }
    
    console.log('Setup test completed successfully!');
    
  } catch (error) {
    console.error('Setup test failed:', error);
  }
}

/**
 * Get all guests with a specific status (for testing)
 */
function getGuestsByStatus(status = 'New') {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const statusIndex = headers.indexOf('Status');
    
    const matchingGuests = rows
      .filter(row => row[statusIndex] === status)
      .map((row, index) => {
        const guest = {};
        headers.forEach((header, i) => {
          guest[header] = row[i];
        });
        guest.rowNumber = index + 2; // +2 because arrays are 0-based and we skip header
        return guest;
      });
    
    console.log(`Found ${matchingGuests.length} guests with status '${status}'`);
    return matchingGuests;
    
  } catch (error) {
    console.error('Error getting guests:', error);
    return [];
  }
}