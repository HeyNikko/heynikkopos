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


V8.0.3 IMAGE SYNC FIX
---------------------
- Added Export > Cloud Product Sync > "Sync Missing Product Images".
- Designed for cases where product rows and Master Stock migrated successfully but image_url is blank.
- Uses product photos still stored in the COMPUTER'S local POS cache.
- Matches cloud rows by SKU, uploads only missing images to Supabase Storage, then updates products.image_url.
- Does not recreate products or alter Master Stock.
- Converts the local computer copy from base64 image data to the resulting cloud image URL after successful upload.
- Shows exact per-SKU errors if an image upload fails.
- Run this action on the original computer that still has the product photos, NOT on the iPad.


V8.1 — CLOUD EVENTS + IMAGE DELIVERY
------------------------------------
- Events and Event Inventory now sync through Supabase.
- Creating or editing an event on the computer queues an automatic cloud sync.
- A signed-in iPad pulls cloud Events + Event Inventory and automatically selects the newest open event when needed.
- Event allocations are matched to cloud products using the product cloud ID, while local product IDs remain intact for offline POS compatibility.
- Product images are served from the Supabase `product-images` bucket.
- IMPORTANT: run SUPABASE_V8_1_SETUP.sql once in Supabase SQL Editor before using V8.1.
- V8.1 does NOT yet cloud-sync promotions or completed sales. Do not run the same live event from two iPads yet.


V8.1.1 EVENT SYNC FIX
---------------------
- Fixed Supabase event upsert conflict targeting by replacing the partial events.local_id unique index with a normal unique index.
- Added explicit "Sync Events to Cloud" and "Pull Events from Cloud" buttons in Export > Cloud Product Sync.
- Added visible event push/pull error details.
- Fresh devices pull events instead of first attempting to push an empty local event list.
- Devices with existing events push first, then pull the canonical cloud copy.
- Run SUPABASE_V8_1_1_EVENT_FIX.sql once before testing this build.


V8.1.2 — ONE-TOUCH CLOUD SYNC
-----------------------------
- Added one main "Sync All to Cloud" button.
  Syncs all currently-supported cloud data:
  Products, Master Stock, product images, Events and Event Inventory.
- Added one main "Pull All from Cloud" button.
  Downloads Products, Master Stock, image URLs, Events and Event Inventory to the current device.
- Individual sync buttons remain under "Advanced sync tools" for troubleshooting only.
- Includes SUPABASE_V8_1_2_SETUP.sql to add/fix missing updated_at columns and force PostgREST schema-cache reload.
- Promotions and completed Sales are NOT cloud synced yet. They are planned for the next cloud stage.


V8.2 — CLOUD SALES + OFFLINE QUEUE + PROMOTIONS
-----------------------------------------------
Run SUPABASE_V8_2_SETUP.sql once before using this version.

Cloud source of truth now includes:
- Products
- Product images
- Master Stock
- Events
- Event Inventory
- Promotions
- Completed Sales
- Sale Items

SALE WORKFLOW
-------------
ONLINE:
1. Before checkout, POS refreshes the current event stock from Supabase.
2. Sale is saved locally immediately.
3. Sale is queued and sent to Supabase automatically.
4. Supabase atomically checks/decrements event stock and creates the sale + items.
5. The device refreshes event stock from cloud.

OFFLINE:
1. Sale is saved locally immediately.
2. Sale ID is stored in a persistent Pending Sales queue.
3. When internet returns, pending sales sync automatically.
4. If cloud stock is insufficient because another device sold the same units, the sale remains pending and the exact error is shown for review.

MULTI-DEVICE:
- Every 15 seconds while online, each signed-in device refreshes cloud sales and current event inventory.
- This substantially reduces stale stock between an iPad and phone.
- Offline devices can still oversell the same last unit independently; V8.2 detects that conflict on reconnect rather than silently overwriting cloud stock.

ONE-TOUCH SYNC:
- Sync All to Cloud now includes promotions and pending/completed local sales.
- Pull All from Cloud now includes promotions and sales.

CURRENT LIMITATION:
- Sale VOID / EDIT / permanent DELETE are still primarily local operations in V8.2.
  Do not use those as cross-device cloud workflows yet; cloud-safe reversal/edit will be added next.


V8.2.1 — SUPABASE LIBRARY LOADER HOTFIX
---------------------------------------
- Fixed false "Supabase library could not load" login failure after the V8.2 deployment.
- Replaced the single CDN dependency with a resilient loader that tries jsDelivr first and unpkg second.
- app.js is loaded only after the cloud-library attempt completes, while the local POS still starts even if both CDNs fail.
- initCloud() can retry the library dynamically without reloading the whole page.
- Added "Retry Cloud Library" to the login dialog when needed.
- Error messages now report a library/CDN loading problem instead of incorrectly saying the device has no internet.
- Service worker continues to intercept/cache only same-origin GitHub Pages files and never Supabase/CDN traffic.
- No Supabase SQL changes are required specifically for V8.2.1. Keep the V8.2 database setup already applied.


V8.2.2 — RENDER / EVENT PULL FIX
--------------------------------
- Fixed "renderProductTable is not defined" after Pull All / event cloud pull.
- Restored the Master Stock table renderer accidentally removed during the V8.2 checkout rewrite.
- Restored setImagePreview(), which is required when adding/editing product artwork.
- renderAll() now isolates panel render errors so one UI component cannot falsely make a successful cloud event pull look like a database sync failure.
- No Supabase SQL changes are required for V8.2.2.
- Existing cloud products, images, events, inventory, promotions and sales are untouched.


V8.2.3 — PROMOTION CLOUD SYNC FIX
--------------------------------
- Fixed Supabase error 23502: promotions.name cannot be null.
- Bundle promotions now receive a readable cloud name such as:
  "Stickers + Postcard · 5 for $10.00"
- Free-gift promotions now receive a readable cloud name based on the buy/gift products.
- Sync All now isolates Products, Images, Events, Promotions and Sales.
  A failure in one section no longer makes the other successful sections appear to have failed.
- Full Sync Result now shows a separate status for each cloud subsystem.
- Cloud Product Sync renamed to Cloud Sync.
- No new Supabase SQL is required for this V8.2.3 patch.


V8.2.4 — PROMOTION TYPE SYNC FIX
--------------------------------
- Fixed Supabase error 23502: promotions.promo_type cannot be null.
- Bundle promotions now write promo_type='bundle'.
- Free-gift promotions now write promo_type='gift'.
- promo_kind is still written for backward compatibility with the V8.2 cloud format.
- Promotion pull now accepts either promo_type or promo_kind.
- No Supabase SQL changes are required for this patch.


V8.3 — CLOUD-SAFE VOIDING
-------------------------
Run SUPABASE_V8_3_SETUP.sql once before using this version.

- Voiding a synced sale now updates Supabase instead of only the local browser.
- Supabase restores event inventory exactly once and marks the cloud sale VOIDED.
- Other devices pulling sales receive the VOIDED state, so the transaction cannot reappear as completed.
- Offline voids are stored in a persistent Pending Voids queue and sync automatically when internet returns.
- Repeated void-sync attempts are idempotent and cannot double-restore stock.
- Cloud-synced sales can no longer be permanently deleted from the UI; use Void to preserve audit history.


V8.3.1 — CLOUD-SAFE PERMANENT DELETE
------------------------------------
Run SUPABASE_V8_3_1_SETUP.sql once before using this build.

- Permanent Delete now removes the sale from Supabase too.
- Voided sale deletion does not restore stock a second time.
- Active sale deletion restores stock once before deletion.
- Offline deletes are queued and hidden locally until Supabase confirms deletion.
- Pending-delete tombstones suppress automatic cloud pulls, so deleted rows cannot reappear.
- Bulk Delete uses the same cloud-safe flow.


V8.4 — LIVE MULTI-DEVICE SYNC
-----------------------------
Run SUPABASE_V8_4_SETUP.sql once before using this build.

NEW REALTIME FLOW
-----------------
iPad checkout
→ Supabase sale + sale items + event stock
→ Supabase Realtime
→ PC/other signed-in devices refresh sales and stock automatically

Realtime covers:
- New completed sales
- Voids
- Permanent sale deletes
- Event inventory / booth stock changes

RELIABILITY LAYERS
------------------
1. Supabase Realtime is the primary cross-device update path.
2. Existing 15-second background polling remains as a fallback.
3. Returning to the browser tab (visibility/focus/pageshow) forces an immediate sales + stock refresh.
4. Offline sale / void / delete queues remain unchanged and sync when internet returns.
5. The Sales > Refresh button now pulls cloud sales before rendering instead of only refreshing local UI.

EXPECTED WORKFLOW
-----------------
- Keep PC and iPad signed into the same Supabase account.
- A sale keyed on iPad should appear on the PC automatically within about 1 second when both are online.
- No manual Pull All is required for ordinary booth sales.
- Pull All remains useful for full workspace recovery/setup on a new device.


V8.4.1 — CLOUD SALES IMPORT HOTFIX
----------------------------------
- Fixed the PC/cloud importer crash that prevented Supabase sales from appearing in Sales History.
- Root cause: pullCloudSales() declared the rebuilt cloud-sales array with `const` and later reassigned it after filtering pending deletes, causing:
  "Assignment to constant variable."
- The importer now uses a mutable array correctly.
- Sales > Refresh now reports how many cloud sales were imported.
- Realtime no longer reports a successful live update if the underlying sales pull failed.
- Cloud Sync now surfaces the actual sales-pull error instead of failing silently in the browser console.
- No Supabase SQL changes are required for V8.4.1.
- Existing Supabase sales and sale_items are untouched.


V8.4.2 — LIVE MASTER STOCK + PRODUCT CATALOGUE SYNC
---------------------------------------------------
Run SUPABASE_V8_4_2_SETUP.sql once before using this build.

NEW LIVE PRODUCT FLOW
---------------------
PC Restock / Adjust
→ products.master_qty updates in Supabase
→ Supabase Realtime
→ iPad/phone automatically refreshes the product catalogue and Master Stock.

Realtime product refresh also covers:
- Product name
- SKU-backed catalogue updates
- Category
- Selling price
- Low-stock threshold
- Active status
- Product image URL
- New products
- Removed/deactivated cloud products

RELIABILITY
-----------
1. Products table is now subscribed through Supabase Realtime.
2. The existing 15-second fallback poll now refreshes cloud products too.
3. Returning to the app/tab immediately pulls cloud products.
4. Background product pulls are silent so they do not create repeated toast notifications.
5. Sales, voids, deletes and event inventory live sync from V8.4/V8.4.1 remain unchanged.

IMPORTANT INVENTORY DISTINCTION
-------------------------------
- Master Stock = products.master_qty
- Event Stock = event_inventory.current_qty
Changing Master Stock does NOT automatically change stock already allocated to an active event.
It only updates the unallocated Master Stock quantity on every device.


V8.4.3 — NEW PRODUCT CATEGORIES
- Lifestyle
- Sticker Sheets
These are available in Add/Edit Product, POS category filters and promotion category selection.


V8.4.4 — SELECTED PRODUCT BUNDLE PROMOS
- Added bundle targeting by Selected Products.
- Example: select only Cap SKUs, set quantity 2 and bundle price $40.
- Cap A + Cap B, or 2 x Cap A, qualifies.
- Other Lifestyle products do not qualify unless explicitly selected.
- Existing category bundle promos remain supported.
- No Supabase SQL change required.


V8.4.5 — POS CATEGORY STATE FIX
-------------------------------
- Fixed POS category buttons occasionally jumping back to All.
- The selected category is now stored separately from the dropdown DOM.
- Background Realtime refreshes, product cloud pulls, renderAll(), cart changes and stock refreshes preserve the current category.
- The selected category is also remembered in browser localStorage.
- The POS only falls back to All if:
  1. the user taps All, or
  2. the selected category is no longer available in the configured category list.
- No Supabase SQL changes are required.


V8.4.6 — CATEGORY BUTTON DISPLAY FIX
------------------------------------
- Fixed the category row disappearing in V8.4.5.
- Root cause: the renderer referenced #posCategoryButtons, but the actual HTML container is #categoryButtons.
- Restored All, Stickers, Sticker Sheets, Keychain, Postcard and Lifestyle buttons.
- Kept the V8.4.5 persistent category-state fix, so background sync should no longer force the POS back to All.
- Restored the original category button styling class.
- No Supabase SQL changes are required.


V8.5 — INVENTORY SAFETY / EVENT CLOSE FIX
-----------------------------------------
Run SUPABASE_V8_5_SETUP.sql once before closing another event.

ROOT CAUSE FIXED
Live product refresh could overwrite local Master Stock while a multi-product stock upload was still running, then clear the pending queue.

PROTECTIONS
- Cloud product refresh never overwrites locally pending Master Stock/product changes.
- Realtime waits during local product upload.
- Pending product changes are pushed before background/focus cloud pulls.
- Event Close is atomic in Supabase: remaining Event Stock returns to Master Stock and the event closes in the same database transaction.
- Event Close is intentionally blocked while offline/signed out.
- Pending sales, voids and deletes must finish syncing before an event can close.

RECOVERY
Export > Cloud Sync > Advanced sync tools > Recover Last Closed Event Stock

Take a JSON backup first. Recovery uses exact local "Unsold event stock returned" movement records and only raises Master Stock to at least the quantity definitely returned at event close. It does not blindly add the same return twice.


V8.5.1 — CLOUD-SAFE EVENT DELETE
--------------------------------
Run SUPABASE_V8_5_1_SETUP.sql once before using this build.

FIXED
-----
Deleting a closed event previously removed it only from the browser.
Supabase still had the event, so Pull Events / background sync downloaded it again.

V8.5.1 permanently deletes:
- the closed event
- its event_inventory rows
- that event's sale_items
- that event's sales

INVENTORY SAFETY
----------------
Deleting closed history does NOT move inventory.

Master Stock is NOT increased or reduced during Event Delete.
The event's stock was already settled during the V8.5 Close Event transaction.

Offline deletes are queued and hidden locally.
While an event delete is pending, cloud pulls suppress that event so it cannot reappear.


V8.5.2 — LIVE EVENT LIFECYCLE SYNC
----------------------------------
Run SUPABASE_V8_5_2_SETUP.sql once before using this build.

ROOT CAUSES FIXED
-----------------
1. The Realtime channel did not subscribe to the public.events table.
   Event creation / close status therefore did not immediately reach other devices.

2. Background save() used to schedule syncEventsToCloud(), which uploaded EVERY local event.
   A stale PC with an event still marked OPEN could overwrite the CLOSED status written by the iPad.

NEW EVENT SYNC MODEL
--------------------
- Local event edits are tracked in a Pending Events queue.
- Only events deliberately changed on this device are pushed to Supabase.
- Normal login/background sync does NOT upload the entire local event history.
- Cloud Events are pulled every 15 seconds as fallback.
- Returning to the tab/app immediately pulls Events.
- public.events is subscribed through Supabase Realtime.
- Event creation, stock management and local event changes sync automatically.
- Closing an event uses the V8.5 atomic close_pos_event() transaction.
- After close, every other online device receives CLOSED state automatically.
- Event deletion continues to use the V8.5.1 permanent cloud-delete queue.

EXPECTED CROSS-DEVICE FLOW
--------------------------
iPad creates event
→ event + inventory upload to Supabase
→ PC receives events Realtime update
→ PC shows event.

PC closes event
→ Supabase atomic close returns unsold stock + marks event CLOSED
→ iPad receives Events + Product + Event Inventory Realtime updates
→ iPad removes it from active POS and shows CLOSED in Event History.

The reverse direction works the same way.


V8.5.3 — CURRENT ORDER + SALES STATUS FIX
-----------------------------------------
Run SUPABASE_V8_5_3_SETUP.sql once before using this build.

CURRENT ORDER FIX
-----------------
V8.5.2 pullCloudEvents() cleared db.cart every time Events refreshed.
Because Events refresh through Realtime, focus refresh and the 15-second fallback,
an in-progress order could disappear after a few seconds.

V8.5.3 preserves Current Order when:
- the same active Event still exists
- the Event remains OPEN

The order is cleared only when:
- the active Event was actually closed
- the active Event was deleted
- the POS genuinely switches to another Event

SALES STATUS FIX
----------------
The UI previously displayed EDITED whenever sales.updated_at existed.
Supabase sets updated_at even for brand-new confirmed sales, so all synced sales
incorrectly showed EDITED.

V8.5.3:
- adds sales.edited_at
- COMPLETED = normal confirmed sale
- EDITED = only a sale deliberately changed through Edit Sale
- VOIDED remains unchanged
- true sale edits are synced to Supabase and other devices

updated_at is now treated only as a technical database timestamp.
