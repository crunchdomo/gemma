# 🏠 Complete Guest Management Integration

**Notion Forms → Hostaway → Sakani Portal Automation**

A comprehensive guest management system that automates the entire workflow from guest form submission to property management system updates.

## 🚀 Features

### **Complete Integration Workflow**
- **Notion Forms**: User-friendly guest information collection
- **Hostaway Sync**: Automatic reservation updates via API
- **Sakani Portal**: Automated building portal submissions
- **Real-time Processing**: Webhook-triggered automation
- **Status Tracking**: Live progress updates in Notion

### **Advanced Automation**
- **Document Handling**: Automatic passport download and upload
- **Error Recovery**: Robust retry logic for broken website interactions
- **Status Monitoring**: Real-time dashboard and logging
- **Batch Processing**: Handle multiple guests efficiently
- **Security**: Secure credential management and data handling

## 📋 Quick Start

### 1. Installation

```bash
git clone <repository>
cd gemma
npm install
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

### 3. Set up Notion Database

Follow the [detailed setup guide](SETUP.md#notion-setup) to create your guest database and form.

### 4. Validate Your Setup

```bash
# Check environment configuration
npm run validate-env

# Detailed setup check with connection tests
npm run setup-check
```

### 5. Test Individual Components

```bash
# Test Notion connection
npm run notion-only

# Test Hostaway connection  
npm run test-hostaway

# Test Sakani automation
npm run sakani-only ./guests-sample.csv ./passports
```

### 6. Run the Integration

```bash
# One-time processing
npm run process

# Continuous processing (recommended)
npm start

# Webhook server with dashboard
npm run webhook
```

## 🎯 Usage Examples

### **Guest Submits Form**
1. Guest fills Notion form with personal details and passport
2. System automatically processes the submission
3. Updates Hostaway reservation with guest information
4. Submits guest details to Sakani building portal
5. Updates Notion with completion status

### **Manual Processing**
```bash
# Process all new guests
npm run process

# Retry failed submissions
npm run retry

# View processing statistics
npm run stats
```

### **Real-time Dashboard**
Access the web dashboard at `http://localhost:3000` for:
- System status monitoring
- Manual processing triggers
- Live statistics
- Processing results

## 🏗️ Architecture

```
Guest Form (Notion) 
       ↓
Integration Hub
    ↙     ↘
Hostaway   Sakani Portal
   API      (Puppeteer)
```

### **Core Components**

| Component | Purpose | File |
|-----------|---------|------|
| Integration Hub | Main orchestration | `integrationHub.js` |
| Notion Client | Form data & document handling | `notionIntegration.js` |
| Hostaway Sync | Reservation updates | `hostawaySync.js` |
| Sakani Automation | Portal submissions | `robustAutomation.js` |
| Webhook Server | Real-time processing | `webhookServer.js` |

## 📊 Monitoring & Debugging

### **Dashboard Interface**
- Real-time system status
- Processing statistics
- Manual operation triggers
- Error reporting

### **Logging & Screenshots**
- Detailed processing logs in `logs/`
- Error screenshots in `screenshots/`
- Failed guest tracking for retry

### **Status Tracking**
All guest submissions tracked in Notion with:
- Processing status (New → Processing → Completed/Failed)
- Sync status for each system
- Detailed error messages
- Processing timestamps

## 🔧 Configuration Options

### **Environment Variables**
```bash
# Required
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=xxx
HOSTAWAY_CLIENT_ID=xxx
HOSTAWAY_CLIENT_SECRET=xxx
SAKANI_EMAIL=xxx
SAKANI_PASSWORD=xxx

# Optional
WEBHOOK_SECRET=xxx
PORT=3000
NODE_ENV=production
```

### **System Behavior**
```javascript
const hub = new IntegrationHub({
    enableHostawaySync: true,    // Enable/disable Hostaway updates
    enableSakaniSync: true,      // Enable/disable Sakani submissions  
    processInterval: 300000,     // Auto-processing interval (5 minutes)
    headless: true               // Browser visibility
});
```

## 🛠️ Advanced Usage

### **API Endpoints**
```bash
# Manual processing
POST /trigger/process

# Retry failed guests
POST /trigger/retry

# Process specific guest
POST /process/{guestId}

# System statistics
GET /stats

# Health check
GET /health
```

### **Webhook Integration**
Configure Notion webhooks to trigger real-time processing:
- Webhook URL: `http://your-domain.com/webhook/notion`
- Events: `page.created`, `page.updated`

### **Bulk Operations**
```bash
# Process from CSV (legacy support)
npm run sakani-only ./guests.csv ./passports

# Bulk retry all failed guests
npm run retry
```

## 🔒 Security & Compliance

- **Credential Security**: Environment-based configuration
- **Document Handling**: Temporary download with automatic cleanup
- **Data Privacy**: Secure processing with minimal data retention
- **Access Control**: Webhook signature verification
- **Audit Logging**: Complete processing trails

## 📚 Documentation

- **[Setup Guide](SETUP.md)**: Detailed configuration instructions
- **[Environment Template](.env.example)**: Configuration reference
- **Code Documentation**: Inline comments and JSDoc

## 🐛 Troubleshooting

### **Common Issues**

| Issue | Solution |
|-------|----------|
| Notion connection fails | Check token and database permissions |
| Hostaway auth fails | Verify API credentials |
| Sakani login fails | Check website for changes, update selectors |
| Document upload fails | Verify file permissions and paths |

### **Debug Mode**
```bash
# Visual debugging
NODE_ENV=development npm run process

# Detailed logging
DEBUG=* npm run process

# Component testing
npm run notion-only
npm run test-hostaway
```

## 🚀 Production Deployment

```bash
# Install PM2 for process management
npm install -g pm2

# Start integration hub
pm2 start integrationHub.js --name "guest-integration" -- start

# Start webhook server
pm2 start webhookServer.js --name "guest-webhook"

# Monitor
pm2 status
pm2 logs
```

## 📈 Performance

- **Processing Speed**: ~30 seconds per guest (including document upload)
- **Concurrent Handling**: Processes guests sequentially for stability
- **Error Recovery**: Automatic retry with exponential backoff
- **Resource Usage**: Minimal CPU/memory footprint when idle

---

**Need help?** Check the [Setup Guide](SETUP.md) or review the dashboard at `http://localhost:3000` for real-time system status.