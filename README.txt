HEYNIKKO IPAD OFFLINE POS — V6 BULK EVENTS

New in V6
- Fast event setup for large catalogues (300+ products)
- Search and filter by category while creating events
- Select All Visible / Clear Visible
- Copy product selection from a previous event
- Optionally copy previous starting quantities
- CSV event-stock import using SKU,QTY
- Manage Products & Stock after an event is created
- Add or remove products from a live event
- Bulk-edit desired event stock quantities
- Removing a product returns unsold event stock to Master Stock while preserving sold history
- Search/filter the current event inventory table
- Existing V5 product, image, promo, sales and event data remains compatible

CSV FORMAT
SKU,QTY
BB-ST01,35
SN-ST01,20

UPDATING GITHUB PAGES
Replace index.html, app.js, styles.css, sw.js and README.txt with the V6 files. Commit the changes and allow GitHub Pages to redeploy.

IMPORTANT
Data is stored locally on the iPad/browser. Keep regular JSON backups from Export & Backup.


V6.1 FIX: Corrected blank dropdown labels/options on iPad/Safari for event category, previous-event copy, and manage-event category selectors. Offline cache version also bumped.


V6.2 CHANGES
- Sales History: Void restores stock but keeps a VOIDED audit row.
- Sales History: Delete permanently removes the sale row; active sales restore stock first.
- Closed events: Delete permanently removes the event and its linked sales; any still-active sales are restored to Master Stock.
- Create Event: Cancel closes immediately and no longer triggers required-field validation.


V6.3 UPDATE
- Sales History checkboxes for multi-select.
- Select All / Clear Selection controls.
- Delete Selected permanently removes multiple sales at once.
- Active selected sales restore stock before deletion; voided selected sales are erased without double-restoring stock.


V6.4 FIXES
- Fixed Manage Event > Add All Visible not responding.
- Fixed Manage Event dialog Close button not responding.
- Root cause: obsolete event-cancel handler stopped later JavaScript initialization.
- Added safer dialog close binding so missing UI controls do not break later handlers.


V6.5 FIX
- Manage Event: Add All Visible now has a direct action plus event-listener fallback.
- Manage Event: Close uses a direct dialog close action and does not depend on app initialization.
- Added visible V6.5 badge near the HeyNikko POS title.
- Added cache-busting query strings to app.js/styles.css and a new service-worker cache.


V6.6 FIX
- Manage Event Close now uses native HTML dialog submission; it does not depend on app.js.
- Add All Visible directly toggles all checkboxes currently rendered by the active search/category filter.
- Remove All Visible uses the same direct DOM mechanism.


V6.7 CHANGES
-------------
- Added "Use Master Qty" in Manage Event Products & Stock.
  Select products, then tap this to copy each selected product's current Master Stock into its event quantity.
- Added "Set Qty".
  Enter one quantity and apply it to all selected visible products. The amount is capped at each product's available Master Stock.
- Individual event quantity boxes remain editable after either bulk action.
- Both bulk actions respect the current search/category filter and only act on selected visible products.


V6.8 CHANGES
-------------
- Fixed "Use Master Qty" in Manage Event Products & Stock.
- It now reads the Master quantity directly from each selected visible product row
  and fills the event quantity box with that exact amount.
- Removed "Set Qty" because individual quantity boxes already allow manual adjustment.
- Recommended workflow:
  1. Filter/search products if needed.
  2. Tap Add All Visible.
  3. Tap Use Master Qty.
  4. Manually amend only the individual quantities that differ.
  5. Tap Save All Changes.


V6.9.1 STABILITY FIX
--------------------
- Fixed the JavaScript syntax error introduced in V6.9.
- Restored POS products, navigation, buttons, event tools and checkout interactions.
- Keeps the redesigned compact Master Stock low-stock summary.
- Added View Low Stock / Hide Low Stock expandable list.
- Built from the known-working V6.8 codebase, then added the low-stock UI cleanly.


V7.0 CHECKOUT REDESIGN
----------------------
- Built from the stable V6.9.1 codebase.
- Cart items scroll independently on long orders.
- Order Summary sits immediately below the cart items.
- Subtotal is visually secondary.
- Promotion discount is shown in green.
- TOTAL is larger and more prominent.
- Cash and PayNow remain directly below the total instead of being separated by a large blank space.
- Promotion wording is simplified for faster booth use.


V7.1 STICKY CHECKOUT
--------------------
- Current Order panel now stays inside the desktop/iPad viewport while the product catalogue scrolls.
- Cart items scroll inside the Current Order panel when the order becomes long.
- Added a compact "Payable Total" immediately below subtotal/promotion for quick reference.
- The large TOTAL and Cash/PayNow checkout controls remain at the bottom.
- On narrow/mobile layouts the panel returns to normal flow for compatibility.


V7.2 CATEGORY BUTTONS
---------------------
- Replaced the POS product category dropdown with touch-friendly category buttons.
- Buttons include All plus every configured product category.
- Search and category buttons remain sticky at the top of the Products panel while scrolling.
- Category buttons scroll horizontally if more categories are added later.
- The original hidden select remains underneath for compatibility with the existing filter logic.


V8.0 CLOUD PRODUCTS — SUPABASE MIGRATION STAGE 1
-------------------------------------------------
- Keeps V7.2 POS UI and localStorage offline operation.
- Adds Supabase email/password sign-in.
- Supabase is the cloud source for Products, Master Stock and product images.
- Adds Cloud / Syncing / Offline / Signed Out status indicators.
- Adds Export > Cloud Product Sync controls:
  * Migrate Local Products to Cloud
  * Pull Products from Cloud
  * Sync Pending Products
  * Sign Out
- Existing local product IDs are preserved when cloud products match by SKU, protecting current local event references.
- Product images stored as local data URLs are uploaded to Supabase Storage bucket `product-images` during migration/sync.
- Product edits and Master Stock changes are detected locally and queued for sync.
- Pending product changes survive reloads and sync when internet/auth returns.
- On a fresh device with no sales/events, signing in automatically downloads the cloud product catalogue.
- EVENTS, PROMOTIONS AND SALES ARE STILL LOCAL IN V8.0 STAGE 1. Do not use multiple devices for live event sales yet.

SUPABASE PROJECT
----------------
Project URL is embedded using the browser-safe publishable key supplied for this project.
Never replace it with a service_role or secret key.

FIRST MIGRATION WORKFLOW
------------------------
1. Update GitHub Pages with V8.0 files.
2. Open POS on the computer that currently contains the full catalogue.
3. Sign in with the Supabase Auth user.
4. Go to Export > Cloud Product Sync.
5. Click "Migrate Local Products to Cloud" and keep the tab open until complete.
6. Verify cloud product count matches local product count.
7. Open the same POS URL on the iPad, sign in, and the cloud catalogue will download automatically on a fresh device.
8. Confirm products, images and Master Stock match before moving to V8 Stage 2 (events/promotions/sales).


V8.0.1 LOGIN FIX
----------------
- Fixed Cloud Login form reloading the page and reopening after correct credentials.
- Root cause: V8.0 cloud UI event handlers were accidentally initialized inside Pull Products from Cloud instead of normal app startup.
- Cloud login, Continue Offline, migration, pull, pending sync and sign-out controls are now bound on startup.
- Login form now explicitly prevents browser navigation and disables the Sign In button while authenticating.
- New service-worker cache forces V8.0.1 assets to replace V8.0.


V8.0.2 MIGRATION FIX
--------------------
- Product migration no longer uploads the image before the product row.
- Product details and Master Stock are written to Supabase first.
- Product image upload happens afterward and cannot block the product record from migrating.
- Exact Supabase error code/message/details/hint are now shown in Cloud Product Sync when a product write fails.
- Image upload errors are reported separately as warnings.
- Cloud product count refreshes after migration so successful database writes are immediately visible.
- New service-worker cache forces V8.0.2 assets to replace V8.0.1.
