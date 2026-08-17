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
