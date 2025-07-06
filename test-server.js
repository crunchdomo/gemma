const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    let filePath = '';
    
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(__dirname, 'guest-form.html');
    } else if (req.url === '/guest-form.html') {
        filePath = path.join(__dirname, 'guest-form.html');
    } else {
        // Serve other static files
        filePath = path.join(__dirname, req.url);
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
        return;
    }
    
    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
        case '.html':
            contentType = 'text/html';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.json':
            contentType = 'application/json';
            break;
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>500 - Internal Server Error</h1>');
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Test server running at: http://localhost:${PORT}`);
    console.log(`📋 Guest form available at: http://localhost:${PORT}`);
    console.log(`\n✨ You can now test the complete user pipeline:`);
    console.log(`1. Open http://localhost:${PORT} in your browser`);
    console.log(`2. Fill out the guest registration form`);
    console.log(`3. Upload passport files (PDF, JPG, PNG)`);
    console.log(`4. Submit the form`);
    console.log(`5. Check Google Sheets for the new guest data`);
    console.log(`6. Run 'npm run process' to test automation`);
    console.log(`\nPress Ctrl+C to stop the server`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down test server...');
    server.close(() => {
        process.exit(0);
    });
});