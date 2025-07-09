#!/bin/bash

echo "🚀 Setting up CSV-Based Guest Management System"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Copy package.json
echo ""
echo "📦 Setting up package.json..."
if [ -f "package-csv.json" ]; then
    cp package-csv.json package.json
    echo "✓ Package.json configured"
else
    echo "❌ package-csv.json not found"
    exit 1
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Create directory structure
echo ""
echo "📁 Creating directory structure..."
mkdir -p guest-data/hostaway_batches
mkdir -p guest-data/logs
mkdir -p public
echo "✓ Directories created"

# Copy guest form to public directory
if [ -f "guest-form-local.html" ]; then
    cp guest-form-local.html public/index.html
    echo "✓ Guest form copied to public directory"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Sakani Portal Credentials
SAKANI_EMAIL=your_email@example.com
SAKANI_PASSWORD=your_password
SAKANI_PROPERTY=3005

# Server Configuration
SERVER_PORT=3001
DATA_DIR=./guest-data

# Automation Settings
NODE_ENV=development
EOF
    echo "✓ .env file created (please update with your credentials)"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update .env file with your Sakani credentials"
echo "2. Start the server: npm start"
echo "3. Open the form: http://localhost:3001"
echo "4. Submit a test guest"
echo "5. Process guests: npm run process"
echo "6. Generate Hostaway batch: npm run batch"
echo ""
echo "📖 See CSV-ARCHITECTURE-GUIDE.md for detailed documentation"