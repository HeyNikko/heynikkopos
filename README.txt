HEYNIKKO IPAD OFFLINE POS (PWA) — UPDATED VERSION
==================================================

NEW IN THIS VERSION
-------------------
1. Completed sales now have View, Edit and Void actions.
2. Editing a sale automatically restores the old stock, applies the edited sale, recalculates active promo gifts, and records stock movement audit entries.
3. Voiding a sale restores ALL items to inventory, including free promo gifts. The receipt remains in history as VOIDED instead of being permanently erased.
4. Every product can now have its own image. Images are automatically resized/compressed on the iPad before storage.
5. Product images appear on the POS product buttons, cart, product table and sale-edit screen.
6. Excel export now includes sale status, edited date and voided date.
7. JSON backup includes product images.

UPDATING YOUR GITHUB PAGES VERSION
----------------------------------
You do NOT need to create a new repository.

1. Unzip this folder.
2. In your existing GitHub repository, upload/replace:
   - index.html
   - app.js
   - styles.css
   - sw.js
   - README.txt (optional)
3. Keep manifest.webmanifest and the icons folder as they are, or upload all files from this folder to replace the existing copy.
4. Commit the changes.
5. Wait 1–3 minutes for GitHub Pages to deploy.
6. Open your POS URL on iPad and refresh it.
7. If an old version remains because it was cached, fully close the Home Screen POS and Safari, reopen Safari, load the site once while online, then reopen the Home Screen POS.

PRODUCT IMAGES
--------------
Products > Add Product / Edit Product > Choose Image.
The image is resized to max 700 px and stored locally with the POS data.

Because Safari/local browser storage has a limit, use reasonably sized product photos and periodically make a JSON backup. The automatic resizing greatly reduces file size.

EDITING A COMPLETED SALE
------------------------
Sales > Edit.
- Change Cash / PayNow.
- Increase/decrease quantities.
- Remove an item.
- Add another product.
- Free promo gifts recalculate automatically using currently active promotion rules.
- Save Changes automatically corrects inventory and keeps stock movement records.

VOIDING A SALE
--------------
Sales > Void.
The system asks for confirmation. On confirmation:
- all sold items return to stock;
- all free promo items return to stock;
- the sale remains visible as VOIDED;
- voided sales are excluded from Today / Transactions / All-time totals;
- the Excel export keeps the voided record for audit history.

BACKUP
------
Export > Backup Data (.json)
Save this regularly to iCloud Drive / Files. Product images are included.


V3 UPDATES
==========
- Sales summary now shows the actual date next to Today.
- Receipt number removed from the main Sales History table; it remains in View Sale and Excel exports.
- Existing v1/v2 local data is migrated automatically.
