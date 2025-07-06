# Deploy Your Guest Registration Form

## Quick Start (Easiest - GitHub Pages)

1. **Rename your form file**:
   ```bash
   cp guest-form.html index.html
   ```

2. **Create GitHub Pages branch**:
   ```bash
   git checkout -b gh-pages
   git add index.html
   git commit -m "Deploy guest registration form"
   git push origin gh-pages
   ```

3. **Enable GitHub Pages**:
   - Go to your repo settings
   - Scroll to "Pages" section
   - Source: Deploy from branch
   - Branch: gh-pages
   - Folder: / (root)
   - Save

4. **Your form will be live at**:
   ```
   https://[your-github-username].github.io/gemma/
   ```

## Alternative: Deploy with Vercel (Also Free)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   - Follow prompts
   - When asked about settings, just press Enter for defaults

3. **Get your URL** (will be something like):
   ```
   https://gemma-abc123.vercel.app
   ```

## Testing Before Deploy

Always test locally first:
```bash
npm run test-form
```

Then open http://localhost:3000 in your browser.

## Important Notes

- ✅ The form is already connected to your Google Sheets
- ✅ No additional setup needed
- ✅ Files automatically save to Google Drive
- ✅ The automation will pick up new entries when you run `npm run process`

## Share the Form

Once deployed, you can share the URL with:
- Property managers
- Cleaning staff
- Or embed it in booking confirmation emails

Example message:
```
Please complete your guest registration:
https://[your-username].github.io/gemma/

This helps us prepare for your arrival and ensures smooth check-in.
```