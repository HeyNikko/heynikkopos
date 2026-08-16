HEYNIKKO IPAD OFFLINE POS (PWA)
================================

WHAT THIS IS
A touch-friendly Progressive Web App (PWA) designed for iPad. It stores products, stock, promotions and sales locally in Safari on that iPad and continues working offline after installation/caching.

FEATURES
- Product / SKU setup
- Starting stock and stock adjustments
- Low-stock alerts
- Automatic Buy X -> Get Y free promotions
- Free gifts also deduct stock
- Cash / PayNow checkout
- Sales history and daily totals
- Excel .xlsx export with 5 sheets: Sales, Items Sold, Inventory, Promotions, Stock Movements
- JSON backup and restore
- Home Screen / standalone app experience

IMPORTANT: HOW TO PUT IT ON AN IPAD
A PWA must be opened from an HTTPS website for reliable installation and offline service-worker caching. Opening index.html directly from the iPad Files app is NOT the recommended deployment method.

EASIEST DEPLOYMENT
1. Upload the contents of this folder to any static HTTPS host, such as GitHub Pages, Netlify, Cloudflare Pages, or your own HTTPS website.
2. On the iPad, open the resulting HTTPS URL in Safari while online.
3. Tap Safari's Share button.
4. Tap Add to Home Screen.
5. Open HeyNikko POS from the Home Screen once while online so all app files are cached.
6. You can then use the POS offline.

DATA STORAGE WARNING
The POS data is stored locally in that browser/iPad. Clearing Safari website data, deleting the site's storage, or changing to a different iPad will not automatically move the database. Use Export > Backup Data (.json) regularly. Restore that JSON file on another iPad when needed.

EXCEL EXPORT ON IPAD
Open Export > Export Today to Excel or Export All to Excel. Safari downloads a .xlsx workbook. You can save/share it using Files, Microsoft Excel, Numbers, Google Drive, AirDrop, etc.

TESTING ON A COMPUTER
From this folder run:
  python3 -m http.server 8000
Then open:
  http://localhost:8000
Localhost is sufficient for desktop testing. For iPad installation use HTTPS hosting.

STARTER DATA
The first launch contains sample Baobao Sticker and Sunny Sticker products plus a Buy 2 -> Get 1 promo. Edit or replace these from Products and Promos.
