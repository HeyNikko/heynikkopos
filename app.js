const KEY='heynikko_pos_v1';
const SUPABASE_URL='https://xiwhhbuwwdsaspmlksdo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_3x_4tMedSa7t5ZJR2Z-o1Q_xPFzvYNb';
const CLOUD_PENDING_KEY='heynikko_pos_v8_pending_products';
const CLOUD_PENDING_SALES_KEY='heynikko_pos_v8_pending_sales';
const CLOUD_SALES_ERRORS_KEY='heynikko_pos_v8_sales_errors';

const CATEGORIES=['Stickers','Sticker Sheets','Keychain','Postcard'];
const DEFAULT_BUNDLES=[
 {id:'bp-sticker-postcard',type:'bundle',categories:['Stickers','Postcard'],qty:5,bundlePrice:10,active:true},
 {id:'bp-sticker-sheets',type:'bundle',categories:['Sticker Sheets'],qty:3,bundlePrice:18,active:true},
 {id:'bp-keychain',type:'bundle',categories:['Keychain'],qty:3,bundlePrice:15,active:true}
];
const seed={products:[{id:'p1',sku:'BB-ST01',name:'Baobao Sticker',category:'Stickers',price:2.5,stock:100,low:5,image:''},{id:'p2',sku:'SN-ST01',name:'Sunny Sticker',category:'Stickers',price:2.5,stock:80,low:5,image:''}],promos:[],bundlePromos:DEFAULT_BUNDLES,sales:[],movements:[],cart:[],events:[],currentEventId:''};
let db=load(),pendingProductImage='',editSaleDraft=[],selectedSaleIds=new Set(),sb=null,cloudSession=null,cloudSyncTimer=null,cloudProductSnapshot=new Map(),cloudEventSyncTimer=null,cloudSaleSyncTimer=null,cloudWorkspacePoller=null;
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}'),d={...structuredClone(seed),...raw};d.products=(d.products||[]).map(p=>({...p,image:p.image||'',category:p.category||'',stock:+p.stock||0}));d.promos=(d.promos||[]).map(p=>({...p,type:'gift'}));d.bundlePromos=Array.isArray(raw.bundlePromos)?raw.bundlePromos:structuredClone(DEFAULT_BUNDLES);d.sales=(d.sales||[]).map(s=>({...s,status:s.status||'active',subtotal:s.subtotal??s.total,bundleDiscount:s.bundleDiscount||0,bundlePromos:s.bundlePromos||[],eventId:s.eventId||'',eventName:s.eventName||''}));d.movements=d.movements||[];d.cart=d.cart||[];d.events=(d.events||[]).map(e=>{const x={...e,status:e.status||'open',stock:e.stock||{},opening:e.opening||{},added:e.added||{},returned:e.returned||{},activeProducts:e.activeProducts||{},createdAt:e.createdAt||new Date().toISOString()};if(!Object.keys(x.activeProducts).length){for(const id of new Set([...Object.keys(x.stock),...Object.keys(x.opening),...Object.keys(x.added)]))x.activeProducts[id]=true}return x});d.currentEventId=d.currentEventId||'';return d}catch{return structuredClone(seed)}}
function persistLocal(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){toast('Storage is full. Export a backup and use smaller images.');throw e}}function save(){persistLocal();try{captureChangedProducts()}catch(e){console.warn('Cloud product change capture skipped',e)}try{scheduleCloudEventSync()}catch(e){console.warn('Cloud event sync schedule skipped',e)}try{scheduleCloudSaleSync()}catch(e){console.warn('Cloud sale sync schedule skipped',e)}}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const money=n=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD'}).format(Number(n)||0);const nowISO=()=>new Date().toISOString();const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}function prod(id){return db.products.find(p=>p.id===id)}function eventById(id){return db.events.find(e=>e.id===id)}function currentEvent(){const e=eventById(db.currentEventId);return e&&e.status==='open'?e:null}function activeSale(s){return(s.status||'active')!=='voided'}function manualCart(){return db.cart.filter(i=>!i.promo)}
function productImageHtml(p,cls='product-thumb'){return p?.image?`<img class="${cls}" src="${p.image}" alt="${esc(p.name)}">`:`<div class="${cls} image-placeholder">☀️</div>`}
function availableStock(id,eventId=db.currentEventId){const e=eventById(eventId);return e&&e.status==='open'?+(e.stock[id]||0):+(prod(id)?.stock||0)}
function calcPromoItems(baseItems,stockAllowance={}){const gifts=[];for(const pr of db.promos.filter(x=>x.active)){const q=baseItems.filter(i=>i.productId===pr.buy).reduce((a,b)=>a+b.qty,0),count=Math.floor(q/pr.buyQty);if(!count)continue;const gp=prod(pr.gift);if(!gp)continue;const wanted=count*pr.giftQty,already=gifts.filter(g=>g.productId===pr.gift).reduce((a,b)=>a+b.qty,0),manualNeeded=baseItems.filter(i=>i.productId===pr.gift).reduce((a,b)=>a+b.qty,0),available=Math.max(0,(stockAllowance[gp.id]??availableStock(gp.id))-manualNeeded-already),qty=Math.min(wanted,available);if(qty>0)gifts.push({id:uid('c'),productId:pr.gift,qty,promo:true,promoId:pr.id})}return gifts}
function calcBundlePricing(baseItems){const subtotal=baseItems.reduce((sum,i)=>sum+(prod(i.productId)?.price||0)*i.qty,0),remaining=baseItems.map(i=>({productId:i.productId,qty:i.qty})),applied=[];let discount=0;for(const pr of db.bundlePromos.filter(x=>x.active)){const cats=pr.categories||[],eligible=remaining.reduce((n,i)=>n+(cats.includes(prod(i.productId)?.category)?i.qty:0),0),bundles=Math.floor(eligible/pr.qty);if(!bundles)continue;let need=bundles*pr.qty,normalValue=0;for(const row of remaining){if(need<=0)break;const p=prod(row.productId);if(!p||!cats.includes(p.category)||row.qty<=0)continue;const take=Math.min(row.qty,need);normalValue+=take*p.price;row.qty-=take;need-=take}const bundleTotal=bundles*pr.bundlePrice,d=Math.max(0,normalValue-bundleTotal);discount+=d;applied.push({promoId:pr.id,categories:[...cats],bundleQty:pr.qty,bundlePrice:pr.bundlePrice,bundles,normalValue,discount:d,label:`${cats.join(' + ')} · ${pr.qty} for ${money(pr.bundlePrice)}`})}return{subtotal,discount,total:Math.max(0,subtotal-discount),applied}}
function recalcPromos(){const base=manualCart();db.cart=[...base,...calcPromoItems(base)];save();renderCart()}
function addToCart(id){const e=currentEvent();if(!e)return toast('Create or select an open event first');const p=prod(id),stock=availableStock(id);if(!p||stock<=0)return toast('Out of event stock');let row=db.cart.find(i=>!i.promo&&i.productId===id),cur=row?.qty||0;if(cur>=stock)return toast('Not enough event stock');if(row)row.qty++;else db.cart.push({id:uid('c'),productId:id,qty:1,promo:false});recalcPromos()}
function changeQty(id,d){const r=db.cart.find(i=>i.id===id);if(!r||r.promo)return;const max=availableStock(r.productId);r.qty=Math.max(0,Math.min(max,r.qty+d));if(!r.qty)db.cart=db.cart.filter(x=>x.id!==id);recalcPromos()}
function renderCategoryOptions(){const opts='<option value="">Select category…</option>'+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('#productCategory').innerHTML=opts;$('#categoryFilter').innerHTML='<option value="">All categories</option>'+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('#promoCategoryChecks').innerHTML=CATEGORIES.map(c=>`<label class="category-check"><input type="checkbox" value="${esc(c)}"> ${esc(c)}</label>`).join('');renderPosCategoryButtons()}
function renderEventBanner(){const e=currentEvent();$('#eventBanner').innerHTML=e?`<div><strong>📍 ${esc(e.name)}</strong><span>${fmtDate(e.start)}${e.end&&e.end!==e.start?' – '+fmtDate(e.end):''}</span></div><button class="ghost" data-goto-events>Manage Event</button>`:`<div><strong>No active event selected</strong><span>Create an event and allocate stock before taking booth sales.</span></div><button class="primary" data-create-event>+ Create Event</button>`;const ce=$('[data-create-event]');if(ce)ce.onclick=openCreateEvent;const ge=$('[data-goto-events]');if(ge)ge.onclick=()=>switchView('events')}
function renderProducts(){const q=($('#search')?.value||'').toLowerCase(),cat=$('#categoryFilter')?.value||'',e=currentEvent();const list=db.products.filter(p=>(!e||e.activeProducts?.[p.id])&&(!cat||p.category===cat)&&(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(q));$('#productGrid').innerHTML=list.map(p=>{const stock=e?availableStock(p.id):0;return`<button class="product-card" data-add="${p.id}" ${!e||stock<=0?'disabled':''}>${productImageHtml(p,'product-card-image')}<div class="product-card-info"><strong>${esc(p.name)}</strong><div><span class="category-pill">${esc(p.category||'Uncategorised')}</span></div><div class="sku">${esc(p.sku)}</div><div class="price">${money(p.price)}</div><div class="${stock<=p.low?'stock-low':'muted'}">Event stock: ${stock}</div></div></button>`}).join('')||'<p class="muted">No products found.</p>';$$('[data-add]').forEach(b=>b.onclick=()=>addToCart(b.dataset.add))}
function renderCart(){$('#cart').innerHTML=db.cart.length?db.cart.map(r=>{const p=prod(r.productId);if(!p)return'';return`<div class="cart-row"><div class="cart-product">${productImageHtml(p,'cart-thumb')}<div><strong>${esc(p.name)}</strong> ${r.promo?'<span class="promo-pill">FREE PROMO</span>':''}<div class="muted">${esc(p.sku)} · ${r.promo?'$0.00':money(p.price)}</div></div></div><div class="qty">${r.promo?`× ${r.qty}`:`<button class="ghost" data-minus="${r.id}">−</button><strong>${r.qty}</strong><button class="ghost" data-plus="${r.id}">+</button>`}</div></div>`}).join(''):'<p class="muted">Tap a product to start an order.</p>';const pricing=calcBundlePricing(manualCart()),lines=pricing.applied.filter(a=>a.discount>0).map(a=>`<div class="bundle-line"><span>${esc(a.label)} × ${a.bundles}</span><strong>−${money(a.discount)}</strong></div>`).join('');$('#bundleDiscounts').innerHTML=lines;$('#subtotalRow').style.display=pricing.discount>0?'flex':'none';$('#subtotal').textContent=money(pricing.subtotal);$('#total').textContent=money(pricing.total);$$('[data-minus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));$$('[data-plus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1))
  // V7.2 checkout summary: keep subtotal, promotions, total and payment area visually grouped.
  const v70Summary = document.getElementById('cartSummary');
  if (v70Summary) {
    const subtotalValue = typeof subtotal !== 'undefined'
      ? subtotal
      : cart.reduce((sum, item) => {
          const product = db.products.find(p => p.id === item.productId);
          return sum + (product ? Number(product.price || 0) * Number(item.qty || 0) : 0);
        }, 0);

    const totalValue = typeof total !== 'undefined'
      ? total
      : (typeof finalTotal !== 'undefined' ? finalTotal : subtotalValue);

    const discountValue = Math.max(0, subtotalValue - totalValue);

    let promoLabel = 'Promotion';
    if (typeof appliedPromos !== 'undefined' && Array.isArray(appliedPromos) && appliedPromos.length) {
      const first = appliedPromos[0];
      promoLabel = first.label || first.name || first.description || promoLabel;
    } else if (discountValue > 0) {
      promoLabel = 'Promotion applied';
    }

    v70Summary.innerHTML = `
      <div class="v70-order-summary">
        <div class="v70-summary-title">Order Summary</div>
        <div class="v70-summary-row v70-subtotal-row">
          <span>Subtotal</span>
          <strong>${money(subtotalValue)}</strong>
        </div>
        ${discountValue > 0 ? `
          <div class="v70-summary-row v70-promo-row">
            <span><span class="v70-promo-prefix">Promotion</span><br><small>${esc(promoLabel)}</small></span>
            <strong>−${money(discountValue)}</strong>
          </div>` : ''}
        <div class="v70-summary-divider"></div>
        <div class="v71-quick-total">
          <span>Payable Total</span>
          <strong>${money(totalValue)}</strong>
        </div>
        <div class="v70-total-row">
          <span>TOTAL</span>
          <strong>${money(totalValue)}</strong>
        </div>
      </div>`;
  }

}
async function checkout(method){
  const e=currentEvent();
  if(!e)return toast('Select an open event first');
  if(!db.cart.length)return toast('Cart is empty');

  // When online, refresh current cloud event stock immediately before payment.
  if(cloudSession&&sb&&navigator.onLine)await refreshCurrentEventInventoryFromCloud();

  for(const r of db.cart){
    const p=prod(r.productId);
    if(!p||r.qty>availableStock(r.productId))return toast(`${p?.name||'Item'} has insufficient event stock`);
  }

  const pricing=calcBundlePricing(manualCart()),
    sale={
      id:uid('S'),
      receipt:'HN-'+new Date().toISOString().replace(/\D/g,'').slice(2,14),
      createdAt:nowISO(),
      updatedAt:null,
      payment:method,
      subtotal:pricing.subtotal,
      bundleDiscount:pricing.discount,
      bundlePromos:pricing.applied,
      total:pricing.total,
      status:'active',
      eventId:e.id,
      eventName:e.name,
      items:[],
      cloudSynced:false
    };

  for(const r of db.cart){
    const p=prod(r.productId),unit=r.promo?0:p.price;
    sale.items.push({productId:p.id,sku:p.sku,name:p.name,category:p.category||'',qty:r.qty,unitPrice:unit,promo:!!r.promo,promoId:r.promoId||''});
    e.stock[p.id]=(e.stock[p.id]||0)-r.qty;
    db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-r.qty,scope:'event',eventId:e.id,eventName:e.name,reason:r.promo?'Promo gift':'Sale',receipt:sale.receipt});
  }

  db.sales.unshift(sale);
  db.cart=[];
  queueSaleForCloud(sale.id);
  save();
  renderAll();

  if(navigator.onLine&&cloudSession){
    toast(`${method} sale saved · syncing…`);
    const ok=await syncPendingSales(false);
    if(ok){
      await refreshCurrentEventInventoryFromCloud();
      renderAll();
      toast(`${method} sale saved · cloud synced`);
    }else{
      toast(`${method} sale saved locally · cloud sync pending`);
    }
  }else{
    toast(`${method} sale saved offline · queued for sync`);
  }
}
function renderProductTable(){
  const lows=db.products.filter(p=>p.stock<=p.low);
  $('#lowStockSummary').innerHTML=renderLowStockSummary(lows);
  $('#productsTable').innerHTML=db.products.map(p=>`<tr>
    <td>${productImageHtml(p,'table-thumb')}</td>
    <td>${esc(p.sku)}</td>
    <td>${esc(p.name)}</td>
    <td>${esc(p.category||'—')}</td>
    <td>${money(p.price)}</td>
    <td class="${p.stock<=p.low?'stock-low':''}">${p.stock}</td>
    <td>${p.low}</td>
    <td><div class="action-row">
      <button class="ghost" data-edit="${p.id}">Edit</button>
      <button class="ghost" data-stock="${p.id}">Restock / Adjust</button>
    </div></td>
  </tr>`).join('')||'<tr><td colspan="8" class="muted">No products.</td></tr>';
  $$('[data-edit]').forEach(b=>b.onclick=()=>openProduct(b.dataset.edit));
  $$('[data-stock]').forEach(b=>b.onclick=()=>openStock(b.dataset.stock));
}
function setImagePreview(src=''){
  pendingProductImage=src||'';
  $('#productImagePreview').innerHTML=src?`<img src="${src}" alt="Product preview">`:'<span>No image</span>';
  $('#removeProductImage').style.display=src?'inline-block':'none';
}
function openProduct(id=''){const p=id?prod(id):null;$('#productDialogTitle').textContent=p?'Edit Product':'Add Product';$('#productId').value=p?.id||'';$('#productSku').value=p?.sku||'';$('#productName').value=p?.name||'';$('#productCategory').value=p?.category||'';$('#productPrice').value=p?.price??'';$('#productStock').value=p?.stock??0;$('#productLow').value=p?.low??5;$('#productImage').value='';setImagePreview(p?.image||'');$('#productDialog').showModal()}
function resizeImage(file,max=700,quality=.78){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{let w=img.width,h=img.height;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};img.src=reader.result};reader.readAsDataURL(file)})}
async function handleProductImage(e){const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/'))return toast('Please choose an image');try{setImagePreview(await resizeImage(f));toast('Image ready')}catch{toast('Could not process image')}}
function saveProductForm(e){e.preventDefault();const id=$('#productId').value,sku=$('#productSku').value.trim();if(db.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==id))return toast('SKU already exists');const data={sku,name:$('#productName').value.trim(),category:$('#productCategory').value,price:+$('#productPrice').value,stock:+$('#productStock').value,low:+$('#productLow').value,image:pendingProductImage};if(id){const p=prod(id),old=p.stock;Object.assign(p,data);if(old!==p.stock)db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:p.stock-old,scope:'master',eventId:'',eventName:'',reason:'Master stock edited',receipt:''})}else{const p={id:uid('p'),...data};db.products.push(p);if(p.stock)db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:p.stock,scope:'master',eventId:'',eventName:'',reason:'Opening master stock',receipt:''})}save();$('#productDialog').close();renderAll();toast('Product saved')}
function openStock(id){const p=prod(id);$('#stockProductId').value=id;$('#stockProductName').textContent=`${p.name} · Master available ${p.stock}`;$('#stockDelta').value='';$('#stockReason').value='';$('#stockDialog').showModal()}
function saveStockForm(e){e.preventDefault();const p=prod($('#stockProductId').value),d=+$('#stockDelta').value;if(!p||!d)return toast('Enter a non-zero adjustment');if(p.stock+d<0)return toast('Master stock cannot go below zero');p.stock+=d;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:d,scope:'master',eventId:'',eventName:'',reason:$('#stockReason').value.trim(),receipt:''});save();$('#stockDialog').close();renderAll();toast('Master stock updated')}
function fmtDate(s){if(!s)return'';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})}
function eventSales(e){return db.sales.filter(s=>s.eventId===e.id&&activeSale(s))}function eventUnitsSold(e){return eventSales(e).reduce((n,s)=>n+s.items.reduce((a,i)=>a+i.qty,0),0)}function eventRevenue(e){return eventSales(e).reduce((n,s)=>n+s.total,0)}
let eventListSearch='',eventListCategory='';let eventDraft={selected:{},qty:{},search:'',category:''};let manageDraft={eventId:'',active:{},target:{},search:'',category:''};
function eventSoldQty(e,pid){return eventSales(e).reduce((n,s)=>n+s.items.filter(i=>i.productId===pid).reduce((a,i)=>a+i.qty,0),0)}
function eventActiveIds(e){return db.products.filter(p=>e.activeProducts?.[p.id]).map(p=>p.id)}
function renderEvents(){const cur=currentEvent();$('#currentEventPanel').innerHTML=cur?renderCurrentEvent(cur):'<div class="empty-event"><strong>No open event selected.</strong><span>Create an event to allocate booth inventory.</span></div>';$('#eventsTable').innerHTML=db.events.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(e=>`<tr><td><strong>${esc(e.name)}</strong></td><td>${fmtDate(e.start)}${e.end&&e.end!==e.start?' – '+fmtDate(e.end):''}</td><td><span class="status-pill ${e.status==='closed'?'voided':'active'}">${e.status==='closed'?'CLOSED':'OPEN'}</span></td><td>${money(eventRevenue(e))}</td><td>${eventUnitsSold(e)}</td><td><div class="action-row">${e.status==='open'?`<button class="ghost" data-use-event="${e.id}">${db.currentEventId===e.id?'Using':'Use POS'}</button><button class="danger-btn" data-close-event="${e.id}">Close</button>`:`<button class="ghost" data-view-event="${e.id}">View</button><button class="danger-btn" data-delete-event="${e.id}">Delete</button>`}</div></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No events yet.</td></tr>';
$$('[data-use-event]').forEach(b=>b.onclick=()=>{db.currentEventId=b.dataset.useEvent;db.cart=[];save();renderAll();switchView('pos');toast('Event selected')});$$('[data-close-event]').forEach(b=>b.onclick=()=>closeEvent(b.dataset.closeEvent));$$('[data-view-event]').forEach(b=>b.onclick=()=>viewClosedEvent(b.dataset.viewEvent));
const s=$('#eventProductSearch');if(s)s.oninput=e=>{eventListSearch=e.target.value;renderEvents()};const c=$('#eventProductCategory');if(c)c.onchange=e=>{eventListCategory=e.target.value;renderEvents()};const m=$('[data-manage-event]');if(m)m.onclick=()=>openManageEvent(m.dataset.manageEvent);$$('[data-event-stock]').forEach(b=>b.onclick=()=>openEventStock(cur?.id,b.dataset.eventStock))}
function renderCurrentEvent(e){const cats=[...new Set([...CATEGORIES,...db.products.map(p=>p.category).filter(Boolean)])];const q=eventListSearch.toLowerCase(),cat=eventListCategory;const list=db.products.filter(p=>e.activeProducts?.[p.id]&&(!cat||p.category===cat)&&(p.name+' '+p.sku).toLowerCase().includes(q));const rows=list.map(p=>{const current=e.stock[p.id]||0,opening=e.opening[p.id]||0,added=e.added[p.id]||0,sold=eventSoldQty(e,p.id);return`<tr><td>${productImageHtml(p,'table-thumb')}</td><td>${esc(p.name)}<div class="muted">${esc(p.sku)}</div></td><td>${p.stock}</td><td>${opening}</td><td>${added}</td><td>${sold}</td><td><strong>${current}</strong></td><td><button class="ghost" data-event-stock="${p.id}">+ Add Event Stock</button></td></tr>`}).join('');return`<div class="current-event-card"><div class="event-head"><div><span class="eyebrow">CURRENT EVENT</span><h3>${esc(e.name)}</h3><p>${fmtDate(e.start)}${e.end&&e.end!==e.start?' – '+fmtDate(e.end):''} · ${money(eventRevenue(e))} sales · ${eventUnitsSold(e)} units sold · ${eventActiveIds(e).length} active products</p></div><div class="action-row"><button class="primary" data-manage-event="${e.id}">Manage Products & Stock</button><button class="ghost" data-open-pos>Open POS</button><button class="danger-btn" data-close-current>Close Event</button></div></div><div class="event-list-tools"><input id="eventProductSearch" value="${esc(eventListSearch)}" placeholder="Search active event products…"><select id="eventProductCategory"><option value="">All categories</option>${cats.map(x=>`<option value="${esc(x)}" ${x===cat?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product</th><th>Master</th><th>Initial</th><th>Added</th><th>Sold</th><th>Event Left</th><th>Action</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="muted">No matching products.</td></tr>'}</tbody></table></div></div>`}
function renderEventDraft(){const cats=[...new Set([...CATEGORIES,...db.products.map(p=>p.category).filter(Boolean)])];$('#eventSetupCategory').innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c)}" ${c===eventDraft.category?'selected':''}>${esc(c)}</option>`).join('');const q=eventDraft.search.toLowerCase(),cat=eventDraft.category;const list=db.products.filter(p=>(!cat||p.category===cat)&&(p.name+' '+p.sku).toLowerCase().includes(q));$('#eventAllocationList').innerHTML=list.map(p=>`<div class="bulk-row"><input type="checkbox" data-event-pick="${p.id}" ${eventDraft.selected[p.id]?'checked':''}><div>${productImageHtml(p,'allocation-thumb')}<span><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category||'Uncategorised')} · Master ${p.stock}</small></span></div><input type="number" min="0" step="1" value="${eventDraft.qty[p.id]||0}" data-event-qty="${p.id}" ${eventDraft.selected[p.id]?'':'disabled'}></div>`).join('')||'<p class="muted bulk-empty">No products found.</p>';$$('[data-event-pick]').forEach(x=>x.onchange=()=>{eventDraft.selected[x.dataset.eventPick]=x.checked;const inp=$(`[data-event-qty="${x.dataset.eventPick}"]`);if(inp)inp.disabled=!x.checked});$$('[data-event-qty]').forEach(x=>x.oninput=()=>eventDraft.qty[x.dataset.eventQty]=Math.max(0,+x.value||0))}
function openCreateEvent(){if(!db.products.length)return toast('Add products first');const today=new Date().toISOString().slice(0,10);eventDraft={selected:{},qty:{},search:'',category:''};$('#eventName').value='';$('#eventStart').value=today;$('#eventEnd').value=today;$('#eventSetupSearch').value='';const prev=$('#copyEventSelect');prev.innerHTML='<option value="">Choose a previous event…</option>'+db.events.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');renderEventDraft();$('#eventDialog').showModal()}
function visibleDraftProducts(){const q=eventDraft.search.toLowerCase(),cat=eventDraft.category;return db.products.filter(p=>(!cat||p.category===cat)&&(p.name+' '+p.sku).toLowerCase().includes(q))}
function setDraftVisible(on){for(const p of visibleDraftProducts())eventDraft.selected[p.id]=on;renderEventDraft()}
function copyPreviousEvent(){const src=eventById($('#copyEventSelect').value);if(!src)return toast('Choose an event to copy');const withQty=$('#copyEventQty').checked;eventDraft.selected={};eventDraft.qty={};for(const p of db.products){const had=src.activeProducts?.[p.id]||(src.opening[p.id]||0)||(src.added[p.id]||0);if(had){eventDraft.selected[p.id]=true;if(withQty)eventDraft.qty[p.id]=Math.min(p.stock,src.opening[p.id]||0)}}renderEventDraft();toast(withQty?'Products and starting quantities copied':'Product selection copied')}
async function importEventCsv(file,mode){if(!file)return;const text=await file.text(),lines=text.replace(/\r/g,'').split('\n').filter(Boolean);let count=0;for(let i=0;i<lines.length;i++){const cols=lines[i].split(',').map(s=>s.trim().replace(/^"|"$/g,''));if(i===0&&/sku/i.test(cols[0]))continue;const sku=cols[0],qty=Math.max(0,parseInt(cols[1]||'0',10)||0),p=db.products.find(x=>x.sku.toLowerCase()===sku.toLowerCase());if(!p)continue;if(mode==='create'){eventDraft.selected[p.id]=true;eventDraft.qty[p.id]=qty}else{manageDraft.active[p.id]=true;manageDraft.target[p.id]=qty}count++}mode==='create'?renderEventDraft():renderManageDraft();toast(`${count} CSV rows matched by SKU`)}
function saveEventForm(e){e.preventDefault();const name=$('#eventName').value.trim();if(!name)return toast('Enter an event name');const ev={id:uid('E'),name,start:$('#eventStart').value,end:$('#eventEnd').value,status:'open',createdAt:nowISO(),closedAt:'',stock:{},opening:{},added:{},returned:{},activeProducts:{}};for(const p of db.products){if(!eventDraft.selected[p.id])continue;const q=Math.max(0,+eventDraft.qty[p.id]||0);if(q>p.stock)return toast(`${p.name}: only ${p.stock} in Master Stock`);ev.activeProducts[p.id]=true;ev.stock[p.id]=q;ev.opening[p.id]=q;if(q){p.stock-=q;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-q,scope:'master',eventId:ev.id,eventName:ev.name,reason:'Allocated to event',receipt:''});db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:q,scope:'event',eventId:ev.id,eventName:ev.name,reason:'Initial event allocation',receipt:''})}}db.events.push(ev);db.currentEventId=ev.id;db.cart=[];save();$('#eventDialog').close();renderAll();switchView('events');toast(`Event created with ${eventActiveIds(ev).length} products`)}
function openManageEvent(id){const e=eventById(id);if(!e||e.status!=='open')return;manageDraft={eventId:id,active:{},target:{},search:'',category:''};for(const p of db.products){manageDraft.active[p.id]=!!e.activeProducts?.[p.id];manageDraft.target[p.id]=e.stock[p.id]||0}$('#manageEventName').textContent=e.name;$('#manageSearch').value='';renderManageDraft();$('#manageEventDialog').showModal()}
function renderManageDraft(){const e=eventById(manageDraft.eventId),cats=[...new Set([...CATEGORIES,...db.products.map(p=>p.category).filter(Boolean)])];$('#manageCategory').innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c)}" ${c===manageDraft.category?'selected':''}>${esc(c)}</option>`).join('');const q=manageDraft.search.toLowerCase(),cat=manageDraft.category;const list=db.products.filter(p=>(!cat||p.category===cat)&&(p.name+' '+p.sku).toLowerCase().includes(q));$('#manageProductList').innerHTML=list.map(p=>{const sold=eventSoldQty(e,p.id);return`<div class="bulk-row manage-row"><input type="checkbox" data-manage-active="${p.id}" ${manageDraft.active[p.id]?'checked':''}><div>${productImageHtml(p,'allocation-thumb')}<span><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · Master ${p.stock} · Sold ${sold}</small></span></div><input type="number" min="0" step="1" value="${manageDraft.target[p.id]||0}" data-manage-target="${p.id}" ${manageDraft.active[p.id]?'':'disabled'}></div>`}).join('');$$('[data-manage-active]').forEach(x=>x.onchange=()=>{manageDraft.active[x.dataset.manageActive]=x.checked;const inp=$(`[data-manage-target="${x.dataset.manageActive}"]`);if(inp)inp.disabled=!x.checked});$$('[data-manage-target]').forEach(x=>x.oninput=()=>manageDraft.target[x.dataset.manageTarget]=Math.max(0,+x.value||0))}

function getManageVisibleProducts(){
  if(!manageDraft)return [];
  const q=(manageDraft.search||'').toLowerCase();
  const cat=manageDraft.category||'';
  return db.products.filter(p=>(!cat||p.category===cat)&&((p.name||'')+' '+(p.sku||'')).toLowerCase().includes(q));
}
function manageAddAllVisible(){
  if(!manageDraft)return toast('Open Manage Products & Stock first');
  const list=getManageVisibleProducts();
  list.forEach(p=>{manageDraft.active[p.id]=true});
  renderManageDraft();
  toast(`${list.length} visible product${list.length===1?'':'s'} selected`);
}
function manageRemoveAllVisible(){
  if(!manageDraft)return toast('Open Manage Products & Stock first');
  const list=getManageVisibleProducts();
  list.forEach(p=>{manageDraft.active[p.id]=false});
  renderManageDraft();
  toast(`${list.length} visible product${list.length===1?'':'s'} marked for removal`);
}
window.manageAddAllVisible=manageAddAllVisible;
window.manageRemoveAllVisible=manageRemoveAllVisible;

function saveManageEvent(){const e=eventById(manageDraft.eventId);if(!e)return;for(const p of db.products){const was=!!e.activeProducts?.[p.id],want=!!manageDraft.active[p.id],cur=e.stock[p.id]||0,target=want?Math.max(0,+manageDraft.target[p.id]||0):0;if(want&&target>cur&&target-cur>p.stock)return toast(`${p.name}: need ${target-cur}, only ${p.stock} in Master Stock`)}for(const p of db.products){const was=!!e.activeProducts?.[p.id],want=!!manageDraft.active[p.id],cur=e.stock[p.id]||0,target=want?Math.max(0,+manageDraft.target[p.id]||0):0;if(!want&&was){if(cur){p.stock+=cur;e.returned[p.id]=(e.returned[p.id]||0)+cur;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:cur,scope:'master',eventId:e.id,eventName:e.name,reason:'Removed from event / stock returned',receipt:''});db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-cur,scope:'event',eventId:e.id,eventName:e.name,reason:'Removed from selling',receipt:''})}e.stock[p.id]=0;e.activeProducts[p.id]=false;continue}if(want){e.activeProducts[p.id]=true;if(!was&&e.opening[p.id]===undefined)e.opening[p.id]=0;const diff=target-cur;if(diff>0){p.stock-=diff;e.stock[p.id]=target;e.added[p.id]=(e.added[p.id]||0)+diff;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-diff,scope:'master',eventId:e.id,eventName:e.name,reason:was?'Bulk event stock increase':'Added product to event',receipt:''});db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:diff,scope:'event',eventId:e.id,eventName:e.name,reason:was?'Bulk event stock increase':'Product added to event',receipt:''})}else if(diff<0){const ret=-diff;p.stock+=ret;e.stock[p.id]=target;e.returned[p.id]=(e.returned[p.id]||0)+ret;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:ret,scope:'master',eventId:e.id,eventName:e.name,reason:'Bulk event stock returned',receipt:''});db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-ret,scope:'event',eventId:e.id,eventName:e.name,reason:'Bulk event stock reduction',receipt:''})}}}save();$('#manageEventDialog').close();renderAll();toast('Event products & stock updated')}
function openEventStock(eventId,productId){const e=eventById(eventId),p=prod(productId);if(!e||e.status!=='open'||!p)return;$('#eventStockEventId').value=e.id;$('#eventStockProductId').value=p.id;$('#eventStockProductName').textContent=`${p.name} · Event left ${e.stock[p.id]||0} · Master available ${p.stock}`;$('#eventStockQty').value='';$('#eventStockSource').value='master';$('#eventStockDialog').showModal()}
function saveEventStock(e){e.preventDefault();const ev=eventById($('#eventStockEventId').value),p=prod($('#eventStockProductId').value),q=+$('#eventStockQty').value,source=$('#eventStockSource').value;if(!ev||!p||q<=0)return toast('Enter a quantity');if(source==='master'&&q>p.stock)return toast(`Only ${p.stock} available in Master Stock`);ev.activeProducts[p.id]=true;if(source==='master'){p.stock-=q;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-q,scope:'master',eventId:ev.id,eventName:ev.name,reason:'Transferred to event',receipt:''})}else{db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:q,scope:'company',eventId:ev.id,eventName:ev.name,reason:'New stock received directly at event',receipt:''})}ev.stock[p.id]=(ev.stock[p.id]||0)+q;ev.added[p.id]=(ev.added[p.id]||0)+q;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:q,scope:'event',eventId:ev.id,eventName:ev.name,reason:source==='master'?'Mid-event transfer':'New stock received at event',receipt:''});save();$('#eventStockDialog').close();renderAll();toast('Event stock added')}
function closeEvent(id){const e=eventById(id);if(!e||e.status!=='open')return;if(!confirm(`Close ${e.name}?\n\nAll unsold event stock will return to Master Stock. Closed event sales become view-only.`))return;for(const p of db.products){const q=e.stock[p.id]||0;if(q>0){p.stock+=q;e.returned[p.id]=(e.returned[p.id]||0)+q;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:q,scope:'master',eventId:e.id,eventName:e.name,reason:'Unsold event stock returned',receipt:''});db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-q,scope:'event',eventId:e.id,eventName:e.name,reason:'Event closed / returned to master',receipt:''});e.stock[p.id]=0}e.activeProducts[p.id]=false}e.status='closed';e.closedAt=nowISO();if(db.currentEventId===e.id){db.currentEventId='';db.cart=[]}save();renderAll();toast('Event closed and unsold stock returned')}
function viewClosedEvent(id){const e=eventById(id);if(!e)return;const lines=db.products.filter(p=>(e.opening[p.id]||0)||(e.added[p.id]||0)||(e.returned[p.id]||0)||eventSoldQty(e,p.id)).map(p=>{const sold=eventSoldQty(e,p.id);return`<div class="receipt-line"><span>${esc(p.name)}<small> Initial ${e.opening[p.id]||0} · Added ${e.added[p.id]||0} · Sold ${sold}</small></span><strong>Returned ${e.returned[p.id]||0}</strong></div>`}).join('');$('#saleViewContent').innerHTML=`<div class="receipt-meta"><div><span>Event</span><strong>${esc(e.name)}</strong></div><div><span>Status</span><strong>CLOSED</strong></div><div><span>Dates</span><strong>${fmtDate(e.start)} – ${fmtDate(e.end)}</strong></div><div><span>Sales</span><strong>${money(eventRevenue(e))}</strong></div></div><div class="receipt-lines">${lines||'<p class="muted">No allocated stock.</p>'}</div>`;$('#saleViewDialog').showModal()}
function promoOptions(){const o=db.products.map(p=>`<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('');$('#promoBuy').innerHTML=o;$('#promoGift').innerHTML=o;$('#editAddProduct').innerHTML='<option value="">Select product…</option>'+o}
function renderPromos(){$('#promosTable').innerHTML=[...db.bundlePromos.map(pr=>`<tr><td>Bundle price</td><td>${esc((pr.categories||[]).join(' + '))}</td><td>${pr.qty} for ${money(pr.bundlePrice)}</td><td>${pr.active?'Active':'Disabled'}</td><td><div class="action-row"><button class="ghost" data-toggle-bundle="${pr.id}">${pr.active?'Disable':'Enable'}</button><button class="ghost" data-delete-bundle="${pr.id}">Delete</button></div></td></tr>`),...db.promos.map(pr=>{const b=prod(pr.buy),g=prod(pr.gift);return`<tr><td>Free gift</td><td>${esc(b?.name||'Missing product')} × ${pr.buyQty}</td><td>${esc(g?.name||'Missing product')} × ${pr.giftQty} free</td><td>${pr.active?'Active':'Disabled'}</td><td><div class="action-row"><button class="ghost" data-toggle-promo="${pr.id}">${pr.active?'Disable':'Enable'}</button><button class="ghost" data-delete-promo="${pr.id}">Delete</button></div></td></tr>`})].join('')||'<tr><td colspan="5" class="muted">No promotions.</td></tr>';$$('[data-toggle-bundle]').forEach(b=>b.onclick=()=>{const p=db.bundlePromos.find(x=>x.id===b.dataset.toggleBundle);p.active=!p.active;save();renderAll()});$$('[data-delete-bundle]').forEach(b=>b.onclick=()=>{db.bundlePromos=db.bundlePromos.filter(x=>x.id!==b.dataset.deleteBundle);save();renderAll()});$$('[data-toggle-promo]').forEach(b=>b.onclick=()=>{const p=db.promos.find(x=>x.id===b.dataset.togglePromo);p.active=!p.active;save();recalcPromos();renderAll()});$$('[data-delete-promo]').forEach(b=>b.onclick=()=>{db.promos=db.promos.filter(x=>x.id!==b.dataset.deletePromo);save();recalcPromos();renderAll()})}
function togglePromoFields(){const gift=$('#promoType').value==='gift';$('#giftPromoFields').hidden=!gift;$('#bundlePromoFields').hidden=gift}
function openPromo(){promoOptions();$('#promoType').value='bundle';togglePromoFields();$$('#promoCategoryChecks input').forEach(x=>x.checked=false);$('#bundleQty').value=5;$('#bundlePrice').value=10;$('#promoDialog').showModal()}
function savePromoForm(e){e.preventDefault();if($('#promoType').value==='bundle'){const categories=$$('#promoCategoryChecks input:checked').map(x=>x.value);if(!categories.length)return toast('Choose at least one category');db.bundlePromos.push({id:uid('bp'),type:'bundle',categories,qty:+$('#bundleQty').value,bundlePrice:+$('#bundlePrice').value,active:true})}else db.promos.push({id:uid('pr'),type:'gift',buy:$('#promoBuy').value,buyQty:+$('#promoBuyQty').value,gift:$('#promoGift').value,giftQty:+$('#promoGiftQty').value,active:true});save();$('#promoDialog').close();recalcPromos();renderAll();toast('Promotion saved')}
function updateSalesBulkControls(){selectedSaleIds=new Set([...selectedSaleIds].filter(id=>db.sales.some(s=>s.id===id)));const n=selectedSaleIds.size,count=$('#salesSelectedCount'),del=$('#deleteSelectedSales'),head=$('#salesHeaderCheck');if(count)count.textContent=`${n} selected`;if(del)del.disabled=!n;if(head){head.checked=db.sales.length>0&&n===db.sales.length;head.indeterminate=n>0&&n<db.sales.length}}
function renderSales(){const today=new Date(),todayKey=today.toDateString(),active=db.sales.filter(activeSale),tod=active.filter(s=>new Date(s.createdAt).toDateString()===todayKey),sum=a=>a.reduce((n,s)=>n+s.total,0);$('#salesSummary').innerHTML=`<div class="stat"><span>Today · ${today.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})}</span><strong>${money(sum(tod))}</strong></div><div class="stat"><span>Transactions</span><strong>${tod.length}</strong></div><div class="stat"><span>All-time</span><strong>${money(sum(active))}</strong></div>`;$('#salesTable').innerHTML=db.sales.map(s=>{const e=eventById(s.eventId),locked=e?.status==='closed',checked=selectedSaleIds.has(s.id)?'checked':'';return`<tr class="${activeSale(s)?'':'voided-row'}"><td class="select-col"><input class="sales-check" type="checkbox" data-sale-select="${s.id}" ${checked} aria-label="Select ${esc(s.receipt)}"></td><td>${new Date(s.createdAt).toLocaleString('en-SG')}</td><td>${esc(s.eventName||'Legacy / Master')}</td><td>${esc(s.payment)}</td><td>${s.items.reduce((a,i)=>a+i.qty,0)}</td><td>${money(s.total)}</td><td><span class="status-pill ${activeSale(s)?'active':'voided'}">${activeSale(s)?(s.updatedAt?'EDITED':'COMPLETED'):'VOIDED'}${activeSale(s)&&!s.cloudSynced?' · SYNC PENDING':''}</span></td><td><div class="action-row"><button class="ghost" data-view-sale="${s.id}">View</button>${activeSale(s)&&!locked?`<button class="ghost" data-edit-sale="${s.id}">Edit</button>`:''}${activeSale(s)?`<button class="danger-btn" data-void-sale="${s.id}">Void</button>`:''}<button class="danger-btn" data-delete-sale="${s.id}">Delete</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="muted">No sales yet.</td></tr>';$$('[data-sale-select]').forEach(c=>c.onchange=()=>{if(c.checked)selectedSaleIds.add(c.dataset.saleSelect);else selectedSaleIds.delete(c.dataset.saleSelect);updateSalesBulkControls()});$$('[data-view-sale]').forEach(b=>b.onclick=()=>viewSale(b.dataset.viewSale));$$('[data-edit-sale]').forEach(b=>b.onclick=()=>openEditSale(b.dataset.editSale));$$('[data-void-sale]').forEach(b=>b.onclick=()=>voidSale(b.dataset.voidSale));$$('[data-delete-sale]').forEach(b=>b.onclick=()=>deleteSalePermanently(b.dataset.deleteSale));updateSalesBulkControls()}
function restoreSaleStockForDelete(s){const ev=eBySale(s);if(!activeSale(s))return;for(const i of s.items){const p=prod(i.productId);if(!p)continue;if(ev&&ev.status==='open'){ev.stock[p.id]=(ev.stock[p.id]||0)+i.qty;ev.activeProducts[p.id]=true}else p.stock+=i.qty}}
function bulkDeleteSelectedSales(){const ids=[...selectedSaleIds].filter(id=>db.sales.some(s=>s.id===id));if(!ids.length)return toast('Select at least one sale');const sales=ids.map(id=>db.sales.find(s=>s.id===id)).filter(Boolean),activeCount=sales.filter(activeSale).length;if(!confirm(`Delete ${sales.length} selected sale${sales.length===1?'':'s'} permanently?\n\n${activeCount?`${activeCount} active sale${activeCount===1?'':'s'} will have stock restored first.\n`:''}This cannot be undone.`))return;const receipts=new Set();for(const s of sales){restoreSaleStockForDelete(s);receipts.add(s.receipt)}const idSet=new Set(ids);db.sales=db.sales.filter(s=>!idSet.has(s.id));db.movements=db.movements.filter(m=>!receipts.has(m.receipt));selectedSaleIds.clear();save();renderAll();toast(`${sales.length} sale${sales.length===1?'':'s'} permanently deleted`)}
function viewSale(id){const s=db.sales.find(x=>x.id===id);if(!s)return;$('#saleViewContent').innerHTML=`<div class="receipt-meta"><div><span>Receipt</span><strong>${esc(s.receipt)}</strong></div><div><span>Event</span><strong>${esc(s.eventName||'Legacy / Master')}</strong></div><div><span>Date</span><strong>${new Date(s.createdAt).toLocaleString('en-SG')}</strong></div><div><span>Payment</span><strong>${esc(s.payment)}</strong></div><div><span>Status</span><strong>${activeSale(s)?(s.updatedAt?'Edited':'Completed'):'Voided'}</strong></div><div><span>Total</span><strong>${money(s.total)}</strong></div></div><div class="receipt-lines">${s.items.map(i=>`<div class="receipt-line"><span>${esc(i.name)} ${i.promo?'<span class="promo-pill">FREE</span>':''}<small>${esc(i.sku)} · × ${i.qty}</small></span><strong>${i.promo?'FREE':money(i.unitPrice*i.qty)}</strong></div>`).join('')}</div>${s.bundleDiscount?`<div class="receipt-line"><span>Bundle discount</span><strong>−${money(s.bundleDiscount)}</strong></div>`:''}`;$('#saleViewDialog').showModal()}
function editAllowance(s){const a={};const event=eBySale(s);for(const p of db.products)a[p.id]=(event?(event.stock[p.id]||0):p.stock);for(const i of s.items)a[i.productId]=(a[i.productId]||0)+i.qty;return a}function eBySale(s){return s.eventId?eventById(s.eventId):null}
function openEditSale(id){const s=db.sales.find(x=>x.id===id),ev=eBySale(s);if(!s||!activeSale(s))return;if(ev?.status==='closed')return toast('Closed event sales are view-only');$('#editSaleId').value=id;$('#editSaleReceipt').textContent=`${s.receipt} · ${s.eventName||'Legacy sale'}`;$('#editSalePayment').value=s.payment;editSaleDraft=s.items.filter(i=>!i.promo).map(i=>({productId:i.productId,qty:i.qty}));promoOptions();renderEditSale();$('#saleEditDialog').showModal()}
function renderEditSale(){const s=db.sales.find(x=>x.id===$('#editSaleId').value),allow=editAllowance(s),gifts=calcPromoItems(editSaleDraft,allow),pricing=calcBundlePricing(editSaleDraft);$('#editSaleItems').innerHTML=[...editSaleDraft.map((r,idx)=>{const p=prod(r.productId);return`<div class="edit-line"><button type="button" class="ghost remove-mini" data-edit-remove="${idx}">Remove</button><div>${esc(p?.name||'Missing')}<div class="muted">${esc(p?.sku||'')}</div></div><div class="qty"><button type="button" class="ghost" data-edit-minus="${idx}">−</button><strong>${r.qty}</strong><button type="button" class="ghost" data-edit-plus="${idx}">+</button></div></div>`}),...gifts.map(g=>{const p=prod(g.productId);return`<div class="edit-line promo-edit"><span class="promo-pill">FREE</span><div>${esc(p?.name||'Missing')}</div><strong>× ${g.qty}</strong></div>`})].join('');$('#editSaleTotal').textContent=money(pricing.total);$$('[data-edit-remove]').forEach(b=>b.onclick=()=>{editSaleDraft.splice(+b.dataset.editRemove,1);renderEditSale()});$$('[data-edit-minus]').forEach(b=>b.onclick=()=>{const r=editSaleDraft[+b.dataset.editMinus];r.qty--;if(r.qty<=0)editSaleDraft.splice(+b.dataset.editMinus,1);renderEditSale()});$$('[data-edit-plus]').forEach(b=>b.onclick=()=>{const r=editSaleDraft[+b.dataset.editPlus];if(r.qty+1>allow[r.productId])return toast('Insufficient stock');r.qty++;renderEditSale()})}
function addProductToEdit(){const id=$('#editAddProduct').value;if(!id)return;const s=db.sales.find(x=>x.id===$('#editSaleId').value),allow=editAllowance(s),r=editSaleDraft.find(x=>x.productId===id),current=r?.qty||0;if(current>=allow[id])return toast('Insufficient stock');if(r)r.qty++;else editSaleDraft.push({productId:id,qty:1});renderEditSale()}
function saveSaleEditForm(e){e.preventDefault();const s=db.sales.find(x=>x.id===$('#editSaleId').value),ev=eBySale(s);if(!s||!activeSale(s)||ev?.status==='closed')return;const allowance=editAllowance(s),pricing=calcBundlePricing(editSaleDraft),gifts=calcPromoItems(editSaleDraft,allowance),newItems=[...editSaleDraft.map(i=>{const p=prod(i.productId);return{productId:p.id,sku:p.sku,name:p.name,category:p.category||'',qty:i.qty,unitPrice:p.price,promo:false,promoId:''}}),...gifts.map(i=>{const p=prod(i.productId);return{productId:p.id,sku:p.sku,name:p.name,category:p.category||'',qty:i.qty,unitPrice:0,promo:true,promoId:i.promoId||''}})],needed={};for(const i of newItems)needed[i.productId]=(needed[i.productId]||0)+i.qty;for(const[id,q]of Object.entries(needed))if(q>(allowance[id]||0))return toast(`${prod(id)?.name||'Item'} has insufficient stock`);for(const old of s.items){const p=prod(old.productId);if(!p)continue;if(ev)ev.stock[p.id]=(ev.stock[p.id]||0)+old.qty;else p.stock+=old.qty;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:old.qty,scope:ev?'event':'master',eventId:ev?.id||'',eventName:ev?.name||'',reason:'Sale edit reversal',receipt:s.receipt})}for(const item of newItems){const p=prod(item.productId),avail=ev?(ev.stock[p.id]||0):p.stock;if(avail<item.qty)return toast('Stock changed before save');if(ev)ev.stock[p.id]-=item.qty;else p.stock-=item.qty;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:-item.qty,scope:ev?'event':'master',eventId:ev?.id||'',eventName:ev?.name||'',reason:item.promo?'Edited sale promo gift':'Edited sale',receipt:s.receipt})}s.items=newItems;s.payment=$('#editSalePayment').value;s.subtotal=pricing.subtotal;s.bundleDiscount=pricing.discount;s.bundlePromos=pricing.applied;s.total=pricing.total;s.updatedAt=nowISO();save();$('#saleEditDialog').close();renderAll();toast('Sale updated')}
function voidSale(id){const s=db.sales.find(x=>x.id===id),ev=eBySale(s);if(!s||!activeSale(s))return;if(!confirm(`Void ${s.receipt}?\n\nThe sale stays in history as VOIDED and stock will be restored.`))return;for(const i of s.items){const p=prod(i.productId);if(!p)continue;if(ev&&ev.status==='open'){ev.stock[p.id]=(ev.stock[p.id]||0)+i.qty;ev.activeProducts[p.id]=true;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:i.qty,scope:'event',eventId:ev.id,eventName:ev.name,reason:'Sale voided',receipt:s.receipt})}else{p.stock+=i.qty;db.movements.push({id:uid('m'),createdAt:nowISO(),productId:p.id,sku:p.sku,name:p.name,delta:i.qty,scope:'master',eventId:ev?.id||'',eventName:ev?.name||'',reason:ev?'Closed-event sale voided / stock restored to master':'Sale voided',receipt:s.receipt})}}s.status='voided';s.voidedAt=nowISO();save();renderAll();toast('Sale voided · stock restored')}
function deleteSalePermanently(id){const s=db.sales.find(x=>x.id===id);if(!s)return;const wasActive=activeSale(s);if(!confirm(`Delete ${s.receipt} permanently?\n\nThis removes the line completely. ${wasActive?'Stock will be restored first. ':''}This cannot be undone.`))return;restoreSaleStockForDelete(s);db.sales=db.sales.filter(x=>x.id!==id);db.movements=db.movements.filter(m=>m.receipt!==s.receipt);selectedSaleIds.delete(id);save();renderAll();toast('Sale permanently deleted')}
function deletePastEvent(id){const e=eventById(id);if(!e||e.status!=='closed')return toast('Only closed events can be permanently deleted');const sales=db.sales.filter(s=>s.eventId===e.id);const active=sales.filter(activeSale);if(!confirm(`Delete ${e.name} permanently?\n\nThis will remove the event and its ${sales.length} sale record(s). Active sales will be reversed back into Master Stock. This cannot be undone.`))return;for(const s of active)for(const i of s.items){const p=prod(i.productId);if(p)p.stock+=i.qty}const receipts=new Set(sales.map(s=>s.receipt));db.sales=db.sales.filter(s=>s.eventId!==e.id);db.movements=db.movements.filter(m=>m.eventId!==e.id&&!receipts.has(m.receipt));db.events=db.events.filter(x=>x.id!==e.id);if(db.currentEventId===e.id)db.currentEventId='';save();renderAll();toast('Past event permanently deleted')}

function cloudImageKey(p){const x=p?.image||'';return x.startsWith('data:')?`${x.slice(0,48)}:${x.length}`:x}
function cloudFingerprint(p){return JSON.stringify([p.sku||'',p.name||'',p.category||'',Number(p.price)||0,Number(p.stock)||0,Number(p.low)||0,cloudImageKey(p),p.active!==false])}
function resetProductCloudSnapshot(){cloudProductSnapshot=new Map(db.products.map(p=>[p.id,cloudFingerprint(p)]))}
function getPendingProductIds(){try{return new Set(JSON.parse(localStorage.getItem(CLOUD_PENDING_KEY)||'[]'))}catch{return new Set()}}
function setPendingProductIds(set){localStorage.setItem(CLOUD_PENDING_KEY,JSON.stringify([...set]))}
function captureChangedProducts(){if(!cloudProductSnapshot.size){resetProductCloudSnapshot();return}const pending=getPendingProductIds();for(const p of db.products){const fp=cloudFingerprint(p),old=cloudProductSnapshot.get(p.id);if(old!==undefined&&old!==fp)pending.add(p.id);if(old===undefined)pending.add(p.id)}setPendingProductIds(pending);renderCloudPanel();scheduleCloudProductSync()}
function scheduleCloudProductSync(){if(cloudSyncTimer)clearTimeout(cloudSyncTimer);if(!navigator.onLine||!cloudSession||!sb)return;cloudSyncTimer=setTimeout(()=>syncPendingProducts(false),1000)}
function setCloudStatus(text,state='off'){const b=$('#cloudBadge');if(b){b.textContent=text;b.className=`cloud-badge cloud-${state}`}const p=$('#cloudPanelStatus');if(p){p.textContent=text.replace('Cloud: ','');p.className=`status-pill cloud-panel-${state}`}}
function renderCloudPanel(extra=''){const stats=$('#cloudSyncStats');if(stats){const pending=getPendingProductIds().size;stats.innerHTML=`<span>Local products: <strong>${db.products.length}</strong></span><span>Cloud products: <strong id="cloudCountValue">${window.__cloudProductCount??'—'}</strong></span><span>Pending products: <strong>${pending}</strong></span><span>Pending sales: <strong>${getPendingSaleIds().size}</strong></span>`}const pr=$('#cloudProgress');if(pr&&extra)pr.textContent=extra;const account=$('#cloudAccountBtn');if(account)account.textContent=cloudSession?.user?.email||'Sign in'}
async function refreshCloudProductCount(){if(!sb||!cloudSession)return;const {count,error}=await sb.from('products').select('*',{count:'exact',head:true});if(!error){window.__cloudProductCount=count||0;renderCloudPanel()}}
function safeFileName(s){return String(s||'product').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'product'}
async function uploadCloudProductImage(p){const src=p.image||'';if(!src||!src.startsWith('data:'))return src||null;const res=await fetch(src);const blob=await res.blob();const ext=blob.type.includes('png')?'png':'jpg';const path=`products/${safeFileName(p.sku)}-${Date.now()}.${ext}`;const {error}=await sb.storage.from('product-images').upload(path,blob,{contentType:blob.type||'image/jpeg',upsert:true});if(error)throw error;const {data}=sb.storage.from('product-images').getPublicUrl(path);return data?.publicUrl||null}
async function upsertProductToCloud(p){if(!sb||!cloudSession)throw new Error('Not signed in');const localImage=p.image||'',existingRemoteImage=localImage&&!localImage.startsWith('data:')?localImage:null;const payload={sku:p.sku,name:p.name,category:p.category||null,price:Number(p.price)||0,image_url:existingRemoteImage,master_qty:Math.max(0,Number(p.stock)||0),low_stock_at:Math.max(0,Number(p.low)||0),active:p.active!==false,updated_at:new Date().toISOString()};const {data,error}=await sb.from('products').upsert(payload,{onConflict:'sku'}).select('id,sku,image_url').single();if(error){const err=new Error(error.message||'Product upsert failed');err.code=error.code;err.details=error.details;err.hint=error.hint;err.stage='product';throw err}p.cloudId=data.id;let imageWarning='';if(localImage.startsWith('data:')){try{const imageUrl=await uploadCloudProductImage(p);if(imageUrl){const {error:imageUpdateError}=await sb.from('products').update({image_url:imageUrl,updated_at:new Date().toISOString()}).eq('id',data.id);if(imageUpdateError)throw imageUpdateError;p.image=imageUrl}}catch(imgErr){console.warn('Product migrated but image upload failed',p.sku,imgErr);imageWarning=imgErr?.message||String(imgErr)}}persistLocal();cloudProductSnapshot.set(p.id,cloudFingerprint(p));return{...data,imageWarning}}
async function syncPendingProducts(showToast=true){if(!navigator.onLine){if(showToast)toast('Offline · product changes will sync later');return}if(!cloudSession||!sb){if(showToast)openCloudLogin();return}const pending=getPendingProductIds();if(!pending.size){if(showToast)toast('No pending product changes');await refreshCloudProductCount();return}setCloudStatus('Cloud: syncing','syncing');let done=0,failed=[];for(const id of [...pending]){const p=db.products.find(x=>x.id===id);if(!p){pending.delete(id);continue}try{await upsertProductToCloud(p);pending.delete(id);done++;setPendingProductIds(pending);renderCloudPanel(`Syncing ${done} of ${done+pending.size}…`)}catch(e){console.error(e);failed.push(`${p.sku}: ${formatCloudError(e)}`)}}setPendingProductIds(pending);persistLocal();setCloudStatus(failed.length?'Cloud: sync issue':'Cloud: synced',failed.length?'warn':'on');renderCloudPanel(failed.length?`Synced ${done}. Failed: ${failed.slice(0,5).join(', ')}${failed.length>5?'…':''}`:`Synced ${done} product change${done===1?'':'s'}.`);await refreshCloudProductCount();if(showToast)toast(failed.length?'Some products could not sync':'Product sync complete')}
function formatCloudError(e){const bits=[];if(e?.stage)bits.push(`stage=${e.stage}`);if(e?.code)bits.push(`code=${e.code}`);if(e?.message)bits.push(e.message);if(e?.details)bits.push(e.details);if(e?.hint)bits.push(`hint: ${e.hint}`);return bits.filter(Boolean).join(' · ')||String(e)}async function migrateLocalProductsToCloud(){if(!cloudSession||!sb)return openCloudLogin();if(!navigator.onLine)return toast('Internet connection required for first migration');if(!confirm(`Migrate ${db.products.length} local products to Supabase?\n\nThis uploads product details and Master Stock first, then product images. Your local POS data will remain as the offline copy.`))return;setCloudStatus('Cloud: migrating','syncing');let done=0,failed=[],imageWarnings=[];for(const p of db.products){try{const result=await upsertProductToCloud(p);done++;if(result?.imageWarning)imageWarnings.push(`${p.sku}: ${result.imageWarning}`);renderCloudPanel(`Migrating ${done} of ${db.products.length}… Keep this tab open.`)}catch(e){console.error('Migration failed',p.sku,e);failed.push({sku:p.sku,error:formatCloudError(e)});renderCloudPanel(`Migrating… ${done} successful, ${failed.length} failed. Latest: ${p.sku} — ${formatCloudError(e)}`)}}resetProductCloudSnapshot();setPendingProductIds(new Set());persistLocal();await refreshCloudProductCount();window.__lastCloudMigrationErrors=failed;window.__lastCloudImageWarnings=imageWarnings;const firstError=failed[0]?.error||'';const imgNote=imageWarnings.length?` Images with warnings: ${imageWarnings.length}.`:'';setCloudStatus(failed.length?'Cloud: migration issue':'Cloud: synced',failed.length?'warn':'on');renderCloudPanel(failed.length?`Migrated ${done}/${db.products.length}. First error: ${firstError}${imgNote}`:`Migration complete: ${done} products uploaded.${imgNote}`);const pr=$('#cloudProgress');if(pr&&failed.length){pr.innerHTML=`<strong>Migration error details</strong><br>${failed.slice(0,5).map(x=>`${esc(x.sku)} — ${esc(x.error)}`).join('<br>')}${failed.length>5?`<br>…and ${failed.length-5} more`:''}${imageWarnings.length?`<br><br><strong>Image warnings</strong><br>${imageWarnings.slice(0,3).map(esc).join('<br>')}`:''}`}else if(pr&&imageWarnings.length){pr.innerHTML=`Products migrated. <strong>${imageWarnings.length} image upload warning${imageWarnings.length===1?'':'s'}</strong>. Product data and Master Stock are already in cloud.`}toast(failed.length?'Migration finished with errors shown below':imageWarnings.length?'Products migrated; some images need attention':'Local products migrated to cloud')}

async function syncMissingProductImages(){
  if(!cloudSession||!sb)return openCloudLogin();
  if(!navigator.onLine)return toast('Internet connection required to sync images');

  const localWithImages=db.products.filter(p=>p.image&&p.image.startsWith('data:'));
  if(!localWithImages.length){
    return toast('No local product images found on this device');
  }

  const {data:cloudRows,error:cloudErr}=await sb.from('products').select('id,sku,image_url');
  if(cloudErr){
    console.error(cloudErr);
    renderCloudPanel(`Could not read cloud products: ${formatCloudError(cloudErr)}`);
    return toast('Could not read cloud products');
  }

  const cloudBySku=new Map((cloudRows||[]).map(r=>[String(r.sku||'').toLowerCase(),r]));
  const targets=localWithImages.filter(p=>{
    const r=cloudBySku.get(String(p.sku||'').toLowerCase());
    return r && !r.image_url;
  });

  if(!targets.length){
    renderCloudPanel('All cloud products that have local photos already have image URLs.');
    return toast('No missing cloud images found');
  }

  if(!confirm(`Upload ${targets.length} missing product image${targets.length===1?'':'s'} from this computer to Supabase?`))return;

  setCloudStatus('Cloud: syncing images','syncing');
  let done=0,failed=[];
  for(const p of targets){
    const cloudRow=cloudBySku.get(String(p.sku||'').toLowerCase());
    try{
      const imageUrl=await uploadCloudProductImage(p);
      if(!imageUrl)throw new Error('No image URL returned');
      const {error:updateErr}=await sb.from('products')
        .update({image_url:imageUrl,updated_at:new Date().toISOString()})
        .eq('id',cloudRow.id);
      if(updateErr)throw updateErr;

      p.image=imageUrl;
      p.cloudId=cloudRow.id;
      done++;
      persistLocal();
      cloudProductSnapshot.set(p.id,cloudFingerprint(p));
      renderCloudPanel(`Uploading product images ${done}/${targets.length}… Keep this tab open.`);
    }catch(e){
      console.error('Image sync failed',p.sku,e);
      failed.push({sku:p.sku,error:formatCloudError(e)});
    }
  }

  const pr=$('#cloudProgress');
  if(pr){
    if(failed.length){
      pr.innerHTML=`<strong>Image sync completed with errors</strong><br>
        Uploaded ${done}/${targets.length}.<br>
        ${failed.slice(0,5).map(x=>`${esc(x.sku)} — ${esc(x.error)}`).join('<br>')}
        ${failed.length>5?`<br>…and ${failed.length-5} more`:''}`;
    }else{
      pr.textContent=`Image sync complete: ${done} product images uploaded.`;
    }
  }

  setCloudStatus(failed.length?'Cloud: image sync issue':'Cloud: synced',failed.length?'warn':'on');
  await refreshCloudProductCount();
  toast(failed.length?'Some images could not sync':'Product images synced');
}



function getPendingSaleIds(){try{return new Set(JSON.parse(localStorage.getItem(CLOUD_PENDING_SALES_KEY)||'[]'))}catch{return new Set()}}
function setPendingSaleIds(set){localStorage.setItem(CLOUD_PENDING_SALES_KEY,JSON.stringify([...set]));renderCloudPanel()}
function getCloudSaleErrors(){try{return JSON.parse(localStorage.getItem(CLOUD_SALES_ERRORS_KEY)||'{}')}catch{return{}}}
function setCloudSaleError(id,msg){const x=getCloudSaleErrors();if(msg)x[id]=msg;else delete x[id];localStorage.setItem(CLOUD_SALES_ERRORS_KEY,JSON.stringify(x))}
function queueSaleForCloud(id){const q=getPendingSaleIds();q.add(id);setPendingSaleIds(q);scheduleCloudSaleSync()}
function scheduleCloudSaleSync(){
  clearTimeout(cloudSaleSyncTimer);
  if(!cloudSession||!sb||!navigator.onLine)return;
  cloudSaleSyncTimer=setTimeout(()=>syncPendingSales(false),500);
}
async function refreshCurrentEventInventoryFromCloud(){
  const ev=currentEvent();
  if(!ev||!ev.cloudId||!cloudSession||!sb||!navigator.onLine)return false;
  const {data,error}=await sb.from('event_inventory')
    .select('product_id,current_qty,active')
    .eq('event_id',ev.cloudId);
  if(error){console.warn('Event stock refresh failed',error);return false}
  for(const row of data||[]){
    const pid=localProductIdFromCloudId(row.product_id);
    if(!pid)continue;
    ev.stock[pid]=Number(row.current_qty||0);
    ev.activeProducts[pid]=row.active!==false;
  }
  persistLocal();
  renderProducts();renderEventBanner();renderEvents();
  return true;
}
async function buildCloudSaleItems(sale){
  const items=[];
  for(const i of sale.items||[]){
    const p=prod(i.productId);
    const cloudProductId=p?.cloudId||null;
    if(!cloudProductId)throw new Error(`${i.sku||i.name}: product has not synced to cloud`);
    items.push({
      product_id:cloudProductId,
      sku:i.sku||p?.sku||'',
      product_name:i.name||p?.name||'',
      quantity:Number(i.qty)||0,
      unit_price:Number(i.unitPrice)||0,
      line_total:(Number(i.qty)||0)*(Number(i.unitPrice)||0),
      promo:!!i.promo,
      promo_id:i.promoId||''
    });
  }
  return items;
}
async function pushSaleToCloud(sale){
  if(!sale||!activeSale(sale))return true;
  const ev=eventById(sale.eventId);
  if(!ev?.cloudId)throw new Error(`Event "${sale.eventName||''}" has not synced to cloud`);
  const items=await buildCloudSaleItems(sale);
  const {data,error}=await sb.rpc('record_pos_sale',{
    p_local_id:sale.id,
    p_receipt:sale.receipt,
    p_event_id:ev.cloudId,
    p_event_name:sale.eventName||ev.name,
    p_payment_method:sale.payment||'',
    p_subtotal:Number(sale.subtotal??sale.total)||0,
    p_discount:Number(sale.bundleDiscount||0),
    p_total:Number(sale.total)||0,
    p_created_at:sale.createdAt||nowISO(),
    p_items:items
  });
  if(error)throw error;
  sale.cloudSynced=true;
  sale.cloudId=data?.sale_id||sale.cloudId||'';
  sale.cloudSyncedAt=nowISO();
  setCloudSaleError(sale.id,'');
  persistLocal();
  return true;
}
async function syncPendingSales(showToast=true){
  if(!cloudSession||!sb){if(showToast)openCloudLogin();return false}
  if(!navigator.onLine){if(showToast)toast('Offline — sales are safely queued on this device');return false}
  const pending=getPendingSaleIds();
  if(!pending.size){if(showToast)toast('No pending sales');return true}
  setCloudStatus('Cloud: syncing sales','syncing');
  let ok=0,failed=[];
  for(const id of [...pending]){
    const sale=db.sales.find(s=>s.id===id);
    if(!sale){pending.delete(id);continue}
    try{
      if(!activeSale(sale)){
        pending.delete(id);continue;
      }
      await pushSaleToCloud(sale);
      pending.delete(id);ok++;
      setPendingSaleIds(pending);
    }catch(e){
      const msg=formatCloudError(e);
      setCloudSaleError(id,msg);
      failed.push(`${sale.receipt||id}: ${msg}`);
    }
  }
  setPendingSaleIds(pending);
  if(failed.length){
    setCloudStatus('Cloud: sales pending','warn');
    const pr=$('#cloudProgress');
    if(pr)pr.innerHTML=`<strong>Sales waiting for attention</strong><br>${failed.slice(0,5).map(esc).join('<br>')}${failed.length>5?`<br>…and ${failed.length-5} more`:''}`;
    if(showToast)toast(`${failed.length} sale${failed.length===1?'':'s'} still pending`);
    return false;
  }
  setCloudStatus('Cloud: synced','on');
  renderCloudPanel(`Sales synced: ${ok}. Pending sales: 0.`);
  if(showToast)toast(`${ok} sale${ok===1?'':'s'} synced`);
  return true;
}
async function fetchCloudSales(){
  const {data:sales,error:salesErr}=await sb.from('sales')
    .select('*').order('created_at',{ascending:false});
  if(salesErr)throw salesErr;
  const {data:items,error:itemsErr}=await sb.from('sale_items').select('*');
  if(itemsErr)throw itemsErr;
  return {sales:sales||[],items:items||[]};
}
async function pullCloudSales(options={}){
  if(!cloudSession||!sb)return false;
  if(!navigator.onLine)return false;
  try{
    const {sales,items}=await fetchCloudSales();
    const localById=new Map(db.sales.map(s=>[String(s.id),s]));
    const rebuilt=sales.map(r=>{
      const old=localById.get(String(r.local_id||''));
      const ev=db.events.find(e=>String(e.cloudId||'')===String(r.event_id||''));
      const saleItems=items.filter(i=>String(i.sale_id)===String(r.id)).map(i=>{
        const pid=localProductIdFromCloudId(i.product_id);
        return{
          productId:pid||'',
          sku:i.sku||'',
          name:i.product_name||'',
          category:prod(pid)?.category||'',
          qty:Number(i.quantity)||0,
          unitPrice:Number(i.unit_price)||0,
          promo:!!i.promo,
          promoId:i.promo_id||''
        };
      });
      return{
        ...(old||{}),
        id:old?.id||r.local_id||`cloud_sale_${r.id}`,
        cloudId:r.id,
        cloudSynced:true,
        receipt:r.receipt||old?.receipt||'',
        createdAt:r.created_at,
        updatedAt:r.updated_at||null,
        payment:r.payment_method||'',
        subtotal:Number(r.subtotal)||0,
        bundleDiscount:Number(r.discount)||0,
        bundlePromos:old?.bundlePromos||[],
        total:Number(r.total)||0,
        status:r.status==='voided'?'voided':'active',
        voidedAt:r.voided_at||'',
        eventId:ev?.id||old?.eventId||'',
        eventName:r.event_name||ev?.name||'',
        items:saleItems
      };
    });
    const cloudIds=new Set(rebuilt.map(s=>String(s.id)));
    const unsyncedLocal=db.sales.filter(s=>!s.cloudSynced&&!cloudIds.has(String(s.id)));
    db.sales=[...unsyncedLocal,...rebuilt].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    persistLocal();
    renderSales();renderEvents();
    if(options.showToast!==false)toast(`${rebuilt.length} cloud sale${rebuilt.length===1?'':'s'} loaded`);
    return true;
  }catch(e){
    console.error('Cloud sales pull failed',e);
    if(options.showToast!==false)toast(`Sales pull failed: ${formatCloudError(e)}`);
    return false;
  }
}

function scheduleCloudEventSync(){
  clearTimeout(cloudEventSyncTimer);
  if(!cloudSession||!sb||!navigator.onLine)return;
  cloudEventSyncTimer=setTimeout(()=>syncEventsToCloud(false),700);
}
function localProductCloudId(localId){
  const p=prod(localId);
  return p?.cloudId||null;
}
function localProductIdFromCloudId(cloudId){
  return db.products.find(p=>String(p.cloudId||'')===String(cloudId||''))?.id||null;
}
async function upsertEventToCloud(ev){
  const eventPayload={
    local_id:ev.id,
    name:ev.name,
    start_date:ev.start||null,
    end_date:ev.end||ev.start||null,
    status:ev.status||'open',
    created_at:ev.createdAt||nowISO(),
    closed_at:ev.closedAt||null,
    updated_at:nowISO()
  };
  const {data:eventRow,error:eventErr}=await sb.from('events')
    .upsert(eventPayload,{onConflict:'local_id'})
    .select('id,local_id').single();
  if(eventErr)throw eventErr;
  ev.cloudId=eventRow.id;

  const rows=[];
  for(const p of db.products){
    if(!ev.activeProducts?.[p.id] && !(ev.opening?.[p.id]) && !(ev.added?.[p.id]) && !(ev.returned?.[p.id]) && !(ev.stock?.[p.id]))continue;
    const cloudProductId=localProductCloudId(p.id);
    if(!cloudProductId)continue;
    rows.push({
      event_id:eventRow.id,
      product_id:cloudProductId,
      opening_qty:Number(ev.opening?.[p.id]||0),
      added_qty:Number(ev.added?.[p.id]||0),
      current_qty:Number(ev.stock?.[p.id]||0),
      returned_qty:Number(ev.returned?.[p.id]||0),
      active:!!ev.activeProducts?.[p.id],
      updated_at:nowISO()
    });
  }
  if(rows.length){
    const {error:invErr}=await sb.from('event_inventory')
      .upsert(rows,{onConflict:'event_id,product_id'});
    if(invErr)throw invErr;
  }
  return eventRow;
}
async function syncEventsToCloud(showToast=true){
  if(!cloudSession||!sb){if(showToast)openCloudLogin();return false}
  if(!navigator.onLine){if(showToast)toast('Offline — event changes will sync later');return false}
  try{
    setCloudStatus('Cloud: syncing','syncing');
    let done=0;
    for(const ev of db.events){
      await upsertEventToCloud(ev);
      done++;
      renderCloudPanel(`Syncing events ${done}/${db.events.length}…`);
    }
    persistLocal();
    setCloudStatus('Cloud: synced','on');
    renderCloudPanel(`Event sync complete: ${done} event${done===1?'':'s'} uploaded.`);
    if(showToast)toast(`${done} event${done===1?'':'s'} synced to cloud`);
    return true;
  }catch(e){
    console.error('Event cloud sync failed',e);
    const msg=formatCloudError(e);
    setCloudStatus('Cloud: event sync issue','warn');
    renderCloudPanel(`Event sync failed: ${msg}`);
    const pr=$('#cloudProgress');
    if(pr)pr.innerHTML=`<strong>Event sync error</strong><br>${esc(msg)}`;
    if(showToast)toast('Event sync failed — see Export > Cloud Product Sync');
    return false;
  }
}
async function pullCloudEvents(options={}){
  if(!cloudSession||!sb){if(options.showToast!==false)openCloudLogin();return false}
  if(!navigator.onLine){if(options.showToast!==false)toast('Offline — cannot pull events');return false}
  try{
    const {data:events,error:eventErr}=await sb.from('events').select('*').order('created_at');
    if(eventErr)throw eventErr;
    const {data:inventory,error:invErr}=await sb.from('event_inventory').select('*');
    if(invErr)throw invErr;
    if(!events?.length)return;

    const existingByLocal=new Map(db.events.map(e=>[String(e.id),e]));
    const existingByCloud=new Map(db.events.filter(e=>e.cloudId).map(e=>[String(e.cloudId),e]));
    const rebuilt=[];
    for(const r of events){
      const localId=r.local_id||`cloud_event_${r.id}`;
      const old=existingByLocal.get(String(localId))||existingByCloud.get(String(r.id));
      const ev={
        ...(old||{}),
        id:old?.id||localId,
        cloudId:r.id,
        name:r.name,
        start:r.start_date||'',
        end:r.end_date||r.start_date||'',
        status:r.status||'open',
        createdAt:r.created_at||nowISO(),
        closedAt:r.closed_at||'',
        stock:{},opening:{},added:{},returned:{},activeProducts:{}
      };
      for(const row of (inventory||[]).filter(x=>String(x.event_id)===String(r.id))){
        const pid=localProductIdFromCloudId(row.product_id);
        if(!pid)continue;
        ev.opening[pid]=Number(row.opening_qty||0);
        ev.added[pid]=Number(row.added_qty||0);
        ev.stock[pid]=Number(row.current_qty||0);
        ev.returned[pid]=Number(row.returned_qty||0);
        ev.activeProducts[pid]=row.active!==false;
      }
      rebuilt.push(ev);
    }
    db.events=rebuilt;
    const open=db.events.filter(e=>e.status==='open');
    if(!eventById(db.currentEventId)||eventById(db.currentEventId)?.status!=='open'){
      db.currentEventId=open.length?open[open.length-1].id:'';
    }
    db.cart=[];
    persistLocal();
    try{renderAll()}catch(renderErr){console.error('Event data loaded; UI refresh warning',renderErr)}
    renderCloudPanel(`Loaded ${db.events.length} cloud event${db.events.length===1?'':'s'}. Active: ${eventById(db.currentEventId)?.name||'none'}.`);
    if(options.showToast!==false)toast(`${db.events.length} cloud event${db.events.length===1?'':'s'} loaded`);
    return true;
  }catch(e){
    console.error('Cloud event pull failed',e);
    setCloudStatus('Cloud: event sync issue','warn');
    const msg=formatCloudError(e);
    renderCloudPanel(`Could not load cloud events: ${msg}`);
    const pr=$('#cloudProgress');if(pr)pr.innerHTML=`<strong>Event pull error</strong><br>${esc(msg)}`;
    if(options.showToast!==false)toast('Could not load cloud events — see sync details');
    return false;
  }
}


function cloudPromotionName(p,kind){
  if(kind==='bundle'){
    const cats=(p.categories||[]).join(' + ')||'Selected categories';
    return `${cats} · ${Number(p.qty)||0} for ${money(Number(p.bundlePrice)||0)}`;
  }
  const buy=prod(p.buy),gift=prod(p.gift);
  const buyName=buy?.name||buy?.sku||'Product';
  const giftName=gift?.name||gift?.sku||'Gift';
  return `Buy ${Number(p.buyQty)||0} ${buyName} · Get ${Number(p.giftQty)||0} ${giftName} free`;
}
async function syncPromotionsToCloud(){
  if(!cloudSession||!sb||!navigator.onLine)return false;
  const rows=[];
  for(const p of db.bundlePromos||[])rows.push({
    local_id:p.id,
    name:cloudPromotionName(p,'bundle'),
    promo_type:'bundle',
    promo_kind:'bundle',
    payload:p,
    active:p.active!==false,
    updated_at:nowISO()
  });
  for(const p of db.promos||[])rows.push({
    local_id:p.id,
    name:cloudPromotionName(p,'gift'),
    promo_type:'gift',
    promo_kind:'gift',
    payload:p,
    active:p.active!==false,
    updated_at:nowISO()
  });
  if(!rows.length)return true;
  const {error}=await sb.from('promotions').upsert(rows,{onConflict:'local_id'});
  if(error)throw error;
  return true;
}
async function pullCloudPromotions(){
  if(!cloudSession||!sb||!navigator.onLine)return false;
  const {data,error}=await sb.from('promotions').select('local_id,promo_type,promo_kind,payload,active');
  if(error)throw error;
  if(!data?.length)return true;
  db.bundlePromos=data.filter(r=>(r.promo_type||r.promo_kind)==='bundle'&&r.payload).map(r=>({...r.payload,id:r.local_id,active:r.active!==false}));
  db.promos=data.filter(r=>(r.promo_type||r.promo_kind)==='gift'&&r.payload).map(r=>({...r.payload,id:r.local_id,active:r.active!==false}));
  persistLocal();renderPromos();renderCart();
  return true;
}

async function syncAllToCloud(){
  if(!cloudSession||!sb)return openCloudLogin();
  if(!navigator.onLine)return toast('Internet connection required to sync');

  setCloudStatus('Cloud: syncing all','syncing');
  renderCloudPanel('Starting full cloud sync…');

  const result={
    products:{ok:0,fail:0,errors:[]},
    images:{warnings:[]},
    events:{ok:false,error:''},
    promotions:{ok:false,error:''},
    sales:{ok:false,error:''}
  };

  // PRODUCTS + MASTER STOCK
  let pDone=0;
  for(const p of db.products){
    try{
      const r=await upsertProductToCloud(p);
      result.products.ok++;
      if(r?.imageWarning)result.images.warnings.push(`${p.sku}: ${r.imageWarning}`);
    }catch(e){
      result.products.fail++;
      result.products.errors.push(`${p.sku}: ${formatCloudError(e)}`);
    }
    pDone++;
    renderCloudPanel(`Syncing products ${pDone}/${db.products.length}…`);
  }
  setPendingProductIds(new Set());
  persistLocal();
  resetProductCloudSnapshot();

  // MISSING IMAGES
  try{
    await syncMissingProductImagesSilent();
  }catch(e){
    result.images.warnings.push(formatCloudError(e));
  }

  // EVENTS + EVENT INVENTORY
  try{
    result.events.ok=await syncEventsToCloud(false);
    if(!result.events.ok)result.events.error='Event sync did not complete.';
  }catch(e){
    result.events.error=formatCloudError(e);
  }

  // PROMOTIONS
  try{
    result.promotions.ok=await syncPromotionsToCloud();
  }catch(e){
    result.promotions.error=formatCloudError(e);
  }

  // SALES
  try{
    for(const s of db.sales)if(activeSale(s)&&!s.cloudSynced)queueSaleForCloud(s.id);
    result.sales.ok=await syncPendingSales(false);
  }catch(e){
    result.sales.error=formatCloudError(e);
  }

  await refreshCloudProductCount();

  const issues=
    result.products.fail+
    result.images.warnings.length+
    (result.events.ok?0:1)+
    (result.promotions.ok?0:1)+
    (result.sales.ok?0:1);

  const statusLines=[
    `<strong>Products / Master Stock:</strong> ${result.products.ok}/${db.products.length}${result.products.fail?' ⚠':''}`,
    `<strong>Product images:</strong> ${result.images.warnings.length?'⚠ '+result.images.warnings.length+' warning(s)':'OK'}`,
    `<strong>Events / Event Stock:</strong> ${result.events.ok?'OK':'⚠ Failed'}`,
    `<strong>Promotions:</strong> ${result.promotions.ok?'OK':'⚠ Failed'}`,
    `<strong>Sales:</strong> ${result.sales.ok?'OK':'⚠ Pending / Failed'}`
  ];

  const details=[];
  if(result.products.errors.length)details.push(`<br><strong>Product errors</strong><br>${result.products.errors.slice(0,4).map(esc).join('<br>')}`);
  if(result.images.warnings.length)details.push(`<br><strong>Image warnings</strong><br>${result.images.warnings.slice(0,4).map(esc).join('<br>')}`);
  if(result.events.error)details.push(`<br><strong>Event error</strong><br>${esc(result.events.error)}`);
  if(result.promotions.error)details.push(`<br><strong>Promotion error</strong><br>${esc(result.promotions.error)}`);
  if(result.sales.error)details.push(`<br><strong>Sales error</strong><br>${esc(result.sales.error)}`);

  const pr=$('#cloudProgress');
  if(pr)pr.innerHTML=`<strong>Full sync result</strong><br>${statusLines.join('<br>')}${details.join('')}`;

  if(issues){
    setCloudStatus('Cloud: sync issue','warn');
    toast('Cloud sync completed with issues — see details');
  }else{
    setCloudStatus('Cloud: synced','on');
    toast('Everything is synced to cloud');
  }
  renderCloudPanel();
  if(pr)pr.innerHTML=`<strong>Full sync result</strong><br>${statusLines.join('<br>')}${details.join('')}`;
}
async function syncMissingProductImagesSilent(){
  if(!cloudSession||!sb||!navigator.onLine)return;
  const localWithImages=db.products.filter(p=>p.image&&p.image.startsWith('data:'));
  if(!localWithImages.length)return;
  const {data:cloudRows,error:cloudErr}=await sb.from('products').select('id,sku,image_url');
  if(cloudErr)throw cloudErr;
  const cloudBySku=new Map((cloudRows||[]).map(r=>[String(r.sku||'').toLowerCase(),r]));
  for(const p of localWithImages){
    const row=cloudBySku.get(String(p.sku||'').toLowerCase());
    if(!row||row.image_url)continue;
    const imageUrl=await uploadCloudProductImage(p);
    if(!imageUrl)continue;
    const {error}=await sb.from('products').update({image_url:imageUrl,updated_at:new Date().toISOString()}).eq('id',row.id);
    if(error)throw error;
    p.image=imageUrl;p.cloudId=row.id;persistLocal();
  }
}
async function pullAllFromCloud(){
  if(!cloudSession||!sb)return openCloudLogin();
  if(!navigator.onLine)return toast('Internet connection required to pull');
  if(!confirm('Pull Products, Master Stock, product images, Events and Event Inventory from cloud onto this device?'))return;
  setCloudStatus('Cloud: pulling all','syncing');
  renderCloudPanel('Downloading cloud workspace…');
  try{
    await pullCloudProducts({auto:true});
    await pullCloudEvents({showToast:false});
    await pullCloudPromotions();
    await pullCloudSales({showToast:false});
    await refreshCurrentEventInventoryFromCloud();
    setCloudStatus('Cloud: synced','on');
    renderCloudPanel(`Pull complete: ${db.products.length} products + ${db.events.length} events + promotions + ${db.sales.length} sales loaded.`);
    toast('Cloud workspace loaded');
  }catch(e){
    setCloudStatus('Cloud: pull issue','warn');
    renderCloudPanel(`Pull failed: ${formatCloudError(e)}`);
    toast('Cloud pull failed');
  }
}

async function syncCloudWorkspace(){
  await refreshCloudProductCount();
  await syncPendingProducts(false);
  await maybeAutoPullCloudProducts();
  if(db.events.length){
    const pushed=await syncEventsToCloud(false);
    if(pushed)await pullCloudEvents({showToast:false});
  }else{
    await pullCloudEvents({showToast:false});
  }
  try{await syncPromotionsToCloud();await pullCloudPromotions()}catch(e){console.warn('Promotion cloud sync skipped',e)}
  await syncPendingSales(false);
  await pullCloudSales({showToast:false});
  await refreshCurrentEventInventoryFromCloud();
}

async function fetchCloudProducts(){if(!cloudSession||!sb)throw new Error('Sign in first');const {data,error}=await sb.from('products').select('id,sku,name,category,price,image_url,master_qty,low_stock_at,active,updated_at').order('name');if(error)throw error;return data||[]}
async function pullCloudProducts(options={}){if(!cloudSession||!sb)return openCloudLogin();if(!navigator.onLine)return toast('Internet connection required to pull cloud products');let rows;try{rows=await fetchCloudProducts()}catch(e){console.error(e);toast('Could not load cloud products');return}if(!rows.length)return toast('Cloud product catalogue is empty');if(!options.auto&&!confirm(`Replace this device's local product catalogue with ${rows.length} cloud products?\n\nExisting product IDs are preserved where the SKU already exists. Events and sales are not changed.`))return;const oldBySku=new Map(db.products.map(p=>[String(p.sku).toLowerCase(),p]));db.products=rows.map(r=>{const old=oldBySku.get(String(r.sku).toLowerCase());return{id:old?.id||`cloud_${r.id}`,cloudId:r.id,sku:r.sku,name:r.name,category:r.category||'',price:Number(r.price)||0,stock:Number(r.master_qty)||0,low:Number(r.low_stock_at)||0,image:r.image_url||'',active:r.active!==false}});db.cart=(db.cart||[]).filter(i=>db.products.some(p=>p.id===i.productId));persistLocal();resetProductCloudSnapshot();setPendingProductIds(new Set());renderCategoryOptions();renderAll();window.__cloudProductCount=rows.length;renderCloudPanel(`Downloaded ${rows.length} cloud products to this device.`);setCloudStatus('Cloud: synced','on');toast(`${rows.length} cloud products loaded`)}
async function maybeAutoPullCloudProducts(){if(!cloudSession||!sb||!navigator.onLine)return;try{const rows=await fetchCloudProducts();window.__cloudProductCount=rows.length;renderCloudPanel();const looksFresh=db.products.length<=2&&db.sales.length===0&&db.events.length===0;if(rows.length&&looksFresh)await pullCloudProducts({auto:true})}catch(e){console.warn('Auto pull skipped',e)}}
function openCloudLogin(){const d=$('#cloudLoginDialog');if(!d)return;if(cloudSession)return toast('Already signed in');$('#cloudLoginError').textContent='';if(!d.open)d.showModal()}
async function cloudLoginSubmit(e){if(e){e.preventDefault();e.stopPropagation()}if(!sb){$('#cloudLoginError').textContent=`Cloud library is not ready. ${window.__supabaseLoadError||'Tap Retry Cloud Library.'}`;const b=$('#cloudRetryLibraryBtn');if(b)b.style.display='block';return false}const form=$('#cloudLoginForm'),submit=form?.querySelector('button[type=submit]'),email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;if(submit)submit.disabled=true;$('#cloudLoginError').textContent='Signing in…';try{const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){$('#cloudLoginError').textContent=error.message;return false}cloudSession=data.session;$('#cloudPassword').value='';$('#cloudLoginError').textContent='';if($('#cloudLoginDialog').open)$('#cloudLoginDialog').close();setCloudStatus('Cloud: synced','on');renderCloudPanel('Signed in successfully.');await syncCloudWorkspace();toast('Cloud signed in');return false}catch(err){console.error(err);$('#cloudLoginError').textContent='Could not sign in. Please try again.';return false}finally{if(submit)submit.disabled=false}}
async function cloudSignOut(){if(sb)await sb.auth.signOut();cloudSession=null;setCloudStatus('Cloud: signed out','off');renderCloudPanel('Local offline data remains on this device.');toast('Signed out of cloud')}

function startCloudWorkspacePoller(){
  clearInterval(cloudWorkspacePoller);
  cloudWorkspacePoller=setInterval(async()=>{
    if(!cloudSession||!sb||!navigator.onLine)return;
    try{
      await syncPendingSales(false);
      await refreshCurrentEventInventoryFromCloud();
      await pullCloudSales({showToast:false});
    }catch(e){console.warn('Background cloud refresh skipped',e)}
  },15000);
}

async function ensureSupabaseLibrary(){
  if(window.supabase)return true;
  const sources=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  ];
  for(const src of sources){
    try{
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');s.src=src;s.async=true;
        s.onload=()=>window.supabase?resolve():reject(new Error('Library loaded without Supabase global'));
        s.onerror=()=>reject(new Error(`Could not load ${src}`));
        document.head.appendChild(s);
      });
      if(window.supabase)return true;
    }catch(e){window.__supabaseLoadError=e.message;console.warn(e)}
  }
  return false;
}
async function retryCloudLibrary(){
  const err=$('#cloudLoginError'),btn=$('#cloudRetryLibraryBtn');
  if(err)err.textContent='Retrying cloud library…';
  if(btn)btn.disabled=true;
  const ok=await ensureSupabaseLibrary();
  if(ok){
    if(err)err.textContent='Cloud library loaded. You can sign in now.';
    if(btn){btn.style.display='none';btn.disabled=false}
    await initCloud();
  }else{
    if(err)err.textContent=`Cloud library still unavailable. ${window.__supabaseLoadError||'The CDN request was blocked or failed.'}`;
    if(btn){btn.style.display='block';btn.disabled=false}
  }
}

async function initCloud(){resetProductCloudSnapshot();renderCloudPanel();if(!window.supabase){const ok=await ensureSupabaseLibrary();if(!ok){setCloudStatus('Cloud: unavailable','warn');renderCloudPanel(`Cloud library unavailable. ${window.__supabaseLoadError||'Loading failed.'} Local POS still works offline.`);const b=$('#cloudRetryLibraryBtn');if(b)b.style.display='block';return}}sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});const {data}=await sb.auth.getSession();cloudSession=data?.session||null;sb.auth.onAuthStateChange((event,session)=>{cloudSession=session||null;if(cloudSession){setCloudStatus('Cloud: synced','on');renderCloudPanel();scheduleCloudProductSync();startCloudWorkspacePoller()}else{clearInterval(cloudWorkspacePoller);setCloudStatus('Cloud: signed out','off');renderCloudPanel()}});if(cloudSession){setCloudStatus('Cloud: synced','on');renderCloudPanel();await syncCloudWorkspace();startCloudWorkspacePoller()}else{setCloudStatus('Cloud: signed out','off');renderCloudPanel();if(navigator.onLine)setTimeout(openCloudLogin,350)}}

function renderAll(){
  const renderers=[renderEventBanner,renderProducts,renderCart,renderProductTable,renderEvents,renderPromos,renderSales];
  for(const fn of renderers){
    try{fn()}catch(e){console.error(`Render failed: ${fn.name}`,e)}
  }
}
function switchView(name){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));renderAll()}
const te=new TextEncoder();function crc32(bytes){let c=-1;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xEDB88320:0)}return(c^-1)>>>0}function u16(n){return[n&255,(n>>>8)&255]}function u32(n){return[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}function zipStore(files){let parts=[],central=[],offset=0;for(const[name,text]of Object.entries(files)){const nb=te.encode(name),data=te.encode(text),crc=crc32(data),local=new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),0,0]);parts.push(local,nb,data);const cen=new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(nb.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset)]);central.push(cen,nb);offset+=local.length+nb.length+data.length}const centralSize=central.reduce((s,a)=>s+a.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,...u16(Object.keys(files).length),...u16(Object.keys(files).length),...u32(centralSize),...u32(offset),0,0]);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}function xml(s){return String(s??'').replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}function sheetXml(rows){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{const ref=colName(ci+1)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))return`<c r="${ref}"><v>${v}</v></c>`;return`<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}
function workbookData(mode='all'){let sales=db.sales;if(mode==='today')sales=sales.filter(s=>new Date(s.createdAt).toDateString()===new Date().toDateString());if(mode==='event'){const e=currentEvent();sales=e?db.sales.filter(s=>s.eventId===e.id):[]}const eventRows=db.events.map(e=>[e.name,e.start,e.end,e.status,new Date(e.createdAt).toLocaleString('en-SG'),e.closedAt?new Date(e.closedAt).toLocaleString('en-SG'):'',eventRevenue(e),eventUnitsSold(e)]),eventInv=[];for(const e of db.events)for(const p of db.products){const initial=e.opening[p.id]||0,added=e.added[p.id]||0,returned=e.returned[p.id]||0,sold=eventSales(e).reduce((n,s)=>n+s.items.filter(i=>i.productId===p.id).reduce((a,i)=>a+i.qty,0),0);if(initial||added||returned||sold||(e.stock[p.id]||0))eventInv.push([e.name,e.status,p.sku,p.name,p.category||'',initial,added,sold,e.stock[p.id]||0,returned])}return[['Sales',[['Receipt','Event','Date/Time','Payment','Subtotal','Bundle Discount','Total','Status'],...sales.map(s=>[s.receipt,s.eventName||'Legacy / Master',new Date(s.createdAt).toLocaleString('en-SG'),s.payment,s.subtotal??s.total,s.bundleDiscount||0,s.total,activeSale(s)?(s.updatedAt?'Edited':'Completed'):'Voided'])]],['Items Sold',[['Receipt','Event','Status','SKU','Product','Category','Qty','Unit Price','Free Gift'],...sales.flatMap(s=>s.items.map(i=>[s.receipt,s.eventName||'Legacy / Master',activeSale(s)?'Active':'Voided',i.sku,i.name,i.category||'',i.qty,i.unitPrice,i.promo?'Yes':'No']))]],['Master Inventory',[['SKU','Product','Category','Price','Master Available','Low Stock Alert'],...db.products.map(p=>[p.sku,p.name,p.category||'',p.price,p.stock,p.low])]],['Events',[['Event','Start','End','Status','Created','Closed','Sales','Units Sold'],...eventRows]],['Event Inventory',[['Event','Status','SKU','Product','Category','Initial','Added','Sold','Event Left','Returned to Master'],...eventInv]],['Promotions',[['Type','Applies To','Quantity','Bundle Price','Free Gift','Gift Qty','Active'],...db.bundlePromos.map(pr=>['Bundle price',(pr.categories||[]).join(' + '),pr.qty,pr.bundlePrice,'','',pr.active?'Yes':'No']),...db.promos.map(pr=>{const b=prod(pr.buy),g=prod(pr.gift);return['Free gift',`${b?.sku||''} ${b?.name||''}`,pr.buyQty,'',`${g?.sku||''} ${g?.name||''}`,pr.giftQty,pr.active?'Yes':'No']})]],['Stock Movements',[['Date/Time','Scope','Event','SKU','Product','Change','Reason','Receipt'],...db.movements.map(m=>[new Date(m.createdAt).toLocaleString('en-SG'),m.scope||'master',m.eventName||'',m.sku,m.name,m.delta,m.reason,m.receipt||''])]]]}
function exportXlsx(mode='all'){if(mode==='event'&&!currentEvent())return toast('Select an open event first');const sheets=workbookData(mode),files={};files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;files['_rels/.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;files['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;files['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheetXml(s[1]));download(zipStore(files),`HeyNikko_POS_${mode}_${new Date().toISOString().slice(0,10)}.xlsx`)}function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}function backup(){download(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),`HeyNikko_POS_Backup_${new Date().toISOString().slice(0,10)}.json`)}
renderCategoryOptions();resetProductCloudSnapshot();$('#cloudLoginForm').onsubmit=cloudLoginSubmit;$('#cloudRetryLibraryBtn').onclick=retryCloudLibrary;$('#cloudOfflineBtn').onclick=()=>{if($('#cloudLoginDialog').open)$('#cloudLoginDialog').close();setCloudStatus('Cloud: offline mode','off');renderCloudPanel('Working from this device only until you sign in.')};$('#cloudAccountBtn').onclick=()=>cloudSession?switchView('export'):openCloudLogin();$('#cloudSyncAllBtn').onclick=syncAllToCloud;$('#cloudPullAllBtn').onclick=pullAllFromCloud;$('#cloudMigrateBtn').onclick=migrateLocalProductsToCloud;$('#cloudPullBtn').onclick=()=>pullCloudProducts();$('#cloudSyncBtn').onclick=()=>syncPendingProducts(true);$('#cloudImageSyncBtn').onclick=syncMissingProductImages;$('#cloudEventPushBtn').onclick=()=>syncEventsToCloud(true);$('#cloudEventPullBtn').onclick=()=>pullCloudEvents({showToast:true});$('#cloudSignOutBtn').onclick=cloudSignOut;$$('.tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#search').oninput=renderProducts;$('#categoryFilter').onchange=()=>{renderPosCategoryButtons();renderProducts()};$('#clearCart').onclick=()=>{db.cart=[];save();renderCart()};$('#payCash').onclick=()=>checkout('Cash');$('#payPaynow').onclick=()=>checkout('PayNow');$('#addProductBtn').onclick=()=>openProduct();$('#productForm').onsubmit=saveProductForm;$('#productImage').onchange=handleProductImage;$('#removeProductImage').onclick=()=>{setImagePreview('');$('#productImage').value=''};$('#stockForm').onsubmit=saveStockForm;$('#createEventBtn').onclick=openCreateEvent;$('#eventForm').onsubmit=saveEventForm;const cancelEventCreate=$('#cancelEventCreate');if(cancelEventCreate)cancelEventCreate.onclick=()=>$('#eventDialog').close();$('#eventSetupSearch').oninput=e=>{eventDraft.search=e.target.value;renderEventDraft()};$('#eventSetupCategory').onchange=e=>{eventDraft.category=e.target.value;renderEventDraft()};$('#selectVisibleProducts').onclick=()=>setDraftVisible(true);$('#clearVisibleProducts').onclick=()=>setDraftVisible(false);$('#copyEventBtn').onclick=copyPreviousEvent;$('#eventCsvInput').onchange=e=>{importEventCsv(e.target.files[0],'create');e.target.value=''};$('#eventStockForm').onsubmit=saveEventStock;$('#manageSearch').oninput=e=>{manageDraft.search=e.target.value;renderManageDraft()};$('#manageCategory').onchange=e=>{manageDraft.category=e.target.value;renderManageDraft()};$('#manageCsvInput').onchange=e=>{importEventCsv(e.target.files[0],'manage');e.target.value=''};$('#saveManageEvent').onclick=saveManageEvent;$('#addPromoBtn').onclick=openPromo;$('#promoType').onchange=togglePromoFields;$('#promoForm').onsubmit=savePromoForm;$('#refreshSales').onclick=renderSales;$('#selectAllSales').onclick=()=>{selectedSaleIds=new Set(db.sales.map(s=>s.id));renderSales()};$('#clearSalesSelection').onclick=()=>{selectedSaleIds.clear();renderSales()};$('#deleteSelectedSales').onclick=bulkDeleteSelectedSales;$('#salesHeaderCheck').onchange=e=>{selectedSaleIds=e.target.checked?new Set(db.sales.map(s=>s.id)):new Set();renderSales()};$('#saleEditForm').onsubmit=saveSaleEditForm;$('#editAddProductBtn').onclick=addProductToEdit;$$('[data-close-dialog]').forEach(b=>b.onclick=()=>{const d=$('#'+b.dataset.closeDialog);if(d&&d.open)d.close()});$('#exportToday').onclick=()=>exportXlsx('today');$('#exportEvent').onclick=()=>exportXlsx('event');$('#exportAll').onclick=()=>exportXlsx('all');$('#backupJson').onclick=backup;$('#restoreJson').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.products||!x.sales)throw 0;localStorage.setItem(KEY,JSON.stringify(x));db=load();renderAll();toast('Backup restored')}catch{toast('Invalid backup file')}e.target.value=''};document.addEventListener('click',e=>{if(e.target.matches('[data-open-pos]'))switchView('pos');if(e.target.matches('[data-close-current]')&&currentEvent())closeEvent(currentEvent().id);if(e.target.matches('[data-delete-event]'))deletePastEvent(e.target.dataset.deleteEvent)});window.addEventListener('online',()=>{$('#offlineBadge').textContent='Online · offline ready';if(cloudSession){setCloudStatus('Cloud: syncing','syncing');syncPendingSales(false).then(()=>syncCloudWorkspace()).catch(console.error)}});window.addEventListener('offline',()=>{$('#offlineBadge').textContent='Offline';setCloudStatus('Cloud: offline','off');renderCloudPanel('Offline. Local POS remains available; product changes will sync later.')});$('#offlineBadge').textContent=navigator.onLine?'Online · offline ready':'Offline';if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));renderAll();initCloud().catch(e=>{console.error(e);setCloudStatus('Cloud: unavailable','warn');renderCloudPanel('Cloud initialization failed. Local POS is still available.')});





(function () {
  function getManageDialogV68() {
    return document.getElementById('manageEventDialog') ||
      Array.from(document.querySelectorAll('dialog')).find(d => d.open) ||
      document.querySelector('dialog[open]');
  }

  function getVisibleManageRowsV68() {
    const dialog = getManageDialogV68();
    if (!dialog) return [];
    const inputs = Array.from(dialog.querySelectorAll('input[type="number"]'));
    return inputs.map(input => {
      let row = input.closest('[data-product-id], .event-product-row, .bulk-product-row, .product-row, li, tr');
      if (!row) {
        row = input.parentElement;
        while (row && row !== dialog) {
          if (row.querySelector && row.querySelector('input[type="checkbox"]')) break;
          row = row.parentElement;
        }
      }
      return row && row !== dialog ? row : null;
    }).filter(Boolean).filter((row, i, arr) => arr.indexOf(row) === i).filter(row => {
      const s = window.getComputedStyle(row);
      return s.display !== 'none' && s.visibility !== 'hidden' && row.getClientRects().length > 0;
    });
  }

  function masterQtyFromRowV68(row) {
    const explicit = row.getAttribute('data-master-stock') || row.dataset?.masterStock;
    if (explicit !== undefined && explicit !== null && explicit !== '') {
      const n = parseInt(explicit, 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
    const text = (row.innerText || row.textContent || '').replace(/\s+/g, ' ');
    const match = text.match(/Master\s*[:\-]?\s*(\d+)/i);
    return match ? Math.max(0, parseInt(match[1], 10)) : 0;
  }

  window.useMasterQtyForVisible = function () {
    const rows = getVisibleManageRowsV68();
    let selected = 0;
    let changed = 0;

    rows.forEach(row => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      const qtyInput = row.querySelector('input[type="number"]');
      if (!checkbox || !qtyInput || !checkbox.checked) return;

      selected++;
      const masterQty = masterQtyFromRowV68(row);
      qtyInput.value = String(masterQty);

      // Keep app state in sync with whatever existing handlers are listening for.
      ['input', 'change'].forEach(type => {
        qtyInput.dispatchEvent(new Event(type, { bubbles: true }));
      });
      changed++;
    });

    if (!selected) {
      alert('Select the products first, then tap Use Master Qty.');
      return;
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`${changed} selected products set to Master quantity.`);
    }
  };

  // Capture phase means this still works even if another handler stops bubbling.
  document.addEventListener('click', function (event) {
    const button = event.target.closest && event.target.closest('#useMasterQtyBtn');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    window.useMasterQtyForVisible();
  }, true);
})();


function renderLowStockSummary(lowStock){
  if(!Array.isArray(lowStock)||!lowStock.length){
    return `<div class="stock-alert stock-alert-ok">
      <div class="stock-alert-icon">✓</div>
      <div class="stock-alert-copy">
        <div class="stock-alert-title">Stock levels look good</div>
        <div class="stock-alert-subtitle">No products are currently at or below their low-stock threshold.</div>
      </div>
    </div>`;
  }
  const sorted=[...lowStock].sort((a,b)=>Number(a.stock||0)-Number(b.stock||0));
  const preview=sorted.slice(0,4).map(p=>`<span class="low-stock-chip">${esc(p.name)} <strong>${Number(p.stock||0)}</strong></span>`).join('');
  const rows=sorted.map(p=>`<div class="low-stock-row">
    <div>
      <div class="low-stock-name">${esc(p.name)}</div>
      <div class="low-stock-sku">${esc(p.sku||'')}</div>
    </div>
    <div class="low-stock-numbers">
      <span><small>Available</small><strong>${Number(p.stock||0)}</strong></span>
      <span><small>Low at</small><strong>${Number(p.low||0)}</strong></span>
    </div>
  </div>`).join('');
  return `<div class="stock-alert stock-alert-warning">
    <div class="stock-alert-main">
      <div class="stock-alert-icon">!</div>
      <div class="stock-alert-copy">
        <div class="stock-alert-title">${sorted.length} product${sorted.length===1?'':'s'} low in Master Stock</div>
        <div class="stock-alert-subtitle">These products are at or below their low-stock threshold.</div>
        <div class="low-stock-preview">${preview}</div>
      </div>
      <button type="button" class="stock-alert-button" onclick="toggleLowStockPanel(this)">View Low Stock</button>
    </div>
    <div class="low-stock-panel" hidden>${rows}</div>
  </div>`;
}
function toggleLowStockPanel(button){
  const card=button.closest('.stock-alert');
  const panel=card&&card.querySelector('.low-stock-panel');
  if(!panel)return;
  panel.hidden=!panel.hidden;
  button.textContent=panel.hidden?'View Low Stock':'Hide Low Stock';
}


function renderPosCategoryButtons(){
  const wrap=$('#categoryButtons');
  const select=$('#categoryFilter');
  if(!wrap||!select)return;
  const current=select.value||'';
  const items=[{value:'',label:'All'},...CATEGORIES.map(c=>({value:c,label:c}))];
  wrap.innerHTML=items.map(x=>`<button type="button" class="v72-category-btn ${current===x.value?'active':''}" data-pos-category="${esc(x.value)}">${esc(x.label)}</button>`).join('');
  $$('[data-pos-category]').forEach(btn=>btn.onclick=()=>{
    select.value=btn.dataset.posCategory||'';
    $$('[data-pos-category]').forEach(b=>b.classList.toggle('active',b===btn));
    renderProducts();
  });
}
