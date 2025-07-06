# 🚀 Enable GitHub Pages for Your Guest Registration Form

## Step 1: Enable GitHub Pages

1. **Go to your repository settings**:
   - Visit: https://github.com/crunchdomo/gemma/settings
   - Or click "Settings" tab in your repo

2. **Find the Pages section**:
   - Scroll down to "Pages" in the left sidebar
   - Click on "Pages"

3. **Configure deployment**:
   - **Source**: Select "Deploy from a branch"
   - **Branch**: Select "gh-pages"
   - **Folder**: Select "/ (root)"
   - Click "Save"

## Step 2: Wait for Deployment

- GitHub will show "Your site is being built..."
- Takes 1-5 minutes for first deployment
- You'll get a green checkmark when ready

## Step 3: Your Form is Live! 🎉

Your guest registration form will be available at:
```
https://crunchdomo.github.io/gemma/
```

## Step 4: Test the Complete Pipeline

1. **Visit your form**: https://crunchdomo.github.io/gemma/
2. **Fill out the form** with test data
3. **Upload a test file** (any image or PDF)
4. **Submit the form**
5. **Check your Google Sheets** - new row should appear
6. **Run automation**: `npm run process` (locally)

## Step 5: Share with Guests

Send this URL to your AirBNB guests:
```
https://crunchdomo.github.io/gemma/
```

Example message:
> Hi! Please complete your guest registration before check-in:
> https://crunchdomo.github.io/gemma/
> 
> This helps us prepare for your arrival and ensures smooth check-in.

## Troubleshooting

### If the form doesn't load:
- Check GitHub Pages is enabled (step 1-3 above)
- Wait up to 10 minutes for DNS propagation
- Try visiting in incognito/private mode

### If submissions don't reach Google Sheets:
- Verify your Apps Script is deployed as a web app
- Check the URL in guest-form.html line 416 matches your Apps Script
- Test your Apps Script directly: visit your Apps Script URL

### If automation doesn't find new entries:
- Run `npm run validate-env` to check credentials
- Run `npm run test-sheets` to verify connection
- Check spreadsheet ID in .env matches your Google Sheets

## Security Notes ✅

- ✅ Only the form is public (HTML/CSS/JS)
- ✅ Your .env file stays private (not deployed)
- ✅ Your automation scripts stay private
- ✅ Google credentials stay on your computer
- ✅ Guest data goes directly to your Google Sheets

## Updating the Form

To update the form after making changes:

```bash
# Switch to main branch
git checkout main

# Make your changes to guest-form.html
# Then update the deployment:

git checkout gh-pages
git checkout main -- guest-form.html
cp guest-form.html index.html
git add index.html
git commit -m "Update guest form"
git push origin gh-pages
```

Your form will be live and working within minutes! 🎉