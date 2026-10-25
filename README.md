# MoneyFlow — ready-to-upload GitHub Pages project

## Setup
1. Upload the ZIP contents **not the outer folder** to the root of `Thanyboon/moneyflow` on the `main` branch, replacing old files with matching names.
2. Edit `src/googleSheets.js` and replace `CLIENT_ID` and `SPREADSHEET_ID` placeholders with your own values. Never add a Client Secret.
3. In GitHub Settings > Pages select **GitHub Actions** as the build and deployment source.
4. In Google Cloud enable Google Sheets API and configure OAuth Web Client authorized JavaScript origin `https://thanyboon.github.io` (case-insensitive hostname), add your Google account as test user if required.
5. In Google Sheets run `setupMoneyFlow()` from your existing Apps Script to create the six tables and their exact column headers.
6. Visit https://thanyboon.github.io/moneyflow/ and sign in.

## Important limits
- Online only for financial data. The PWA service worker caches the application shell, **not private Sheets data**.
- Google OAuth token is kept only in memory; you may need to sign in again after expiration or reload.
- Google Sheets row-based updates are **not atomic** across devices. Do not edit/delete the same record simultaneously from multiple devices.
- Savings and split-bill records are tracking tools and do not alter account balances automatically.
- Not independently audited or production-grade financial software; use sample transactions first.
