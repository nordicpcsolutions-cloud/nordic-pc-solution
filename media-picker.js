/**
 * media-picker.js — Shared Media Picker for Nordic PC Admin CMS
 * ════════════════════════════════════════════════════════════════
 *
 * This is the SINGLE shared media picker component for the entire CMS.
 * Any module that needs an image selected should call openMediaPicker(callback)
 * rather than building its own picker UI. This includes blog posts (hero image,
 * inline editor images), portfolio entries, prebuilt PC listings, hero banners,
 * landing pages, team photos, and any future module — do not duplicate this logic.
 *
 * DEPENDENCY: admin-shared.js must be loaded before this file. It provides:
 *   loadMediaLibrary, uploadMediaFile, updateMediaMetadata, deleteMediaItem,
 *   MEDIA_CAT_LABELS, formatBytes, escH, escAttr, copyUrl, showToast, supabaseClient,
 *   getImageDimensions, sanitizePath, MEDIA_MAX_BYTES
 *
 * USAGE — minimal example:
 *   openMediaPicker(function(media) {
 *     document.getElementById('hero-preview').src = media.public_url;
 *     heroImageUrl = media.public_url;
 *   });
 *
 * USAGE — inline editor image insertion:
 *   openMediaPicker(function(media) {
 *     easyMDE.codemirror.replaceSelection('![' + (media.alt_text || media.file_name) + '](' + media.public_url + ')');
 *   });
 *
 * The callback receives the full media_library row object with:
 *   { id, file_name, public_url, alt_text, caption, category,
 *     width, height, file_size, mime_type, storage_path }
 *
 * FEATURES: browse/search/filter, multi-file drag-drop upload, alt text auto-save
 * on blur, image replacement (updates existing row in-place), permanent deletion
 * with inline confirmation.
 *
 * The modal is injected into the DOM once (on first call) and reused for all
 * subsequent openMediaPicker() calls. No duplicate HTML on the page.
 */

// ── Internal state ────────────────────────────────────────────────────────────
let _mpCallback    = null;   // onSelect callback provided to openMediaPicker()
let _mpAllMedia    = [];     // cached media rows; invalidated after upload/delete
let _mpLoaded      = false;  // false forces reload on next open
let _mpActiveItem  = null;   // media row shown in the current detail view
let _mpInitialized = false;  // guards one-time DOM + style injection
let _mpUploadOpen  = false;  // tracks upload zone expand/collapse state

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Opens the Media Picker modal.
 *
 * @param {function(mediaRow): void} onSelect
 *   Called when the admin confirms a selection. Receives a copy of the
 *   media_library row. Multiple calls with a new callback are safe — each
 *   open replaces the previous callback.
 */
function openMediaPicker(onSelect) {
  _mpCallback = onSelect;
  if (!_mpInitialized) {
    _mpInjectStyles();
    _mpInjectHTML();
    _mpBindEvents();
    _mpInitialized = true;
  }
  _mpOpen();
}

// ════════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════

function _mpOpen() {
  _mpShowGridView();
  document.getElementById('mp-overlay').classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent page scroll while modal is open

  if (!_mpLoaded) {
    _mpLoadMedia();
  } else {
    _mpApplyFilters();
  }
}

function _mpClose() {
  document.getElementById('mp-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _mpActiveItem = null;
}

// ════════════════════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════════════════════

async function _mpLoadMedia() {
  document.getElementById('mp-grid').innerHTML =
    '<div class="media-empty">Laddar…</div>';

  const { data, error } = await loadMediaLibrary(); // admin-shared.js
  if (error) {
    document.getElementById('mp-grid').innerHTML =
      `<div class="media-empty">Kunde inte ladda bilder: ${escH(error.message)}</div>`;
    return;
  }
  _mpAllMedia = data || [];
  _mpLoaded   = true;
  _mpApplyFilters();
}

function _mpApplyFilters() {
  const cat = document.getElementById('mp-cat').value;
  const q   = (document.getElementById('mp-search').value || '').toLowerCase().trim();

  let list = cat === 'all'
    ? _mpAllMedia
    : _mpAllMedia.filter(m => m.category === cat);

  if (q) {
    list = list.filter(m =>
      (m.file_name || '').toLowerCase().includes(q) ||
      (m.alt_text  || '').toLowerCase().includes(q)
    );
  }

  _mpRenderGrid(list, q);
}

function _mpRenderGrid(list, searchQuery) {
  const grid = document.getElementById('mp-grid');

  if (!list.length) {
    grid.innerHTML = searchQuery
      ? `<div class="media-empty">Inga träffar för “${escH(searchQuery)}”.</div>`
      : '<div class="media-empty">Inga bilder hittades.</div>';
    return;
  }

  // Uses data-media-id + event delegation — no global callback function needed
  grid.innerHTML = list.map(m => `
    <div class="media-card mp-pick-card" data-media-id="${m.id}"
         tabindex="0" role="button" aria-label="${escAttr(m.file_name)}">
      <img class="media-card-thumb"
           src="${escAttr(m.public_url)}"
           alt="${escAttr(m.alt_text || m.file_name)}"
           loading="lazy">
      <div class="media-card-body">
        <div class="media-card-name">${escH(m.file_name)}</div>
        <div class="media-card-meta">
          <span class="media-cat-badge">${escH(MEDIA_CAT_LABELS[m.category] || m.category || '')}</span>
          <span class="media-size">${formatBytes(m.file_size)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW SWITCHING
// ════════════════════════════════════════════════════════════════════════════

function _mpShowGridView() {
  document.getElementById('mp-grid-view').style.display   = '';
  document.getElementById('mp-detail-view').style.display = 'none';
  document.getElementById('mp-back-btn').style.display    = 'none';
  document.getElementById('mp-title').textContent         = 'Mediabibliotek';
  _mpActiveItem = null;
}

function _mpShowDetail(id) {
  const m = _mpAllMedia.find(x => String(x.id) === String(id));
  if (!m) return;
  _mpActiveItem = m;

  // Populate image
  const img = document.getElementById('mp-detail-img');
  img.src = m.public_url;
  img.alt = m.alt_text || m.file_name;

  document.getElementById('mp-detail-filename').textContent = m.file_name;

  const dateStr = m.uploaded_at
    ? new Date(m.uploaded_at).toLocaleDateString('sv-SE', { year:'numeric', month:'short', day:'numeric' })
    : '—';
  document.getElementById('mp-detail-meta').innerHTML =
    (m.width ? `<span>${m.width} × ${m.height} px</span>` : '') +
    `<span>${formatBytes(m.file_size)}</span>` +
    `<span>${escH(m.mime_type || '')}</span>` +
    `<span>${dateStr}</span>`;

  document.getElementById('mp-alt').value = m.alt_text || '';
  document.getElementById('mp-alt-saved').classList.remove('show');

  // Reset transient UI states
  document.getElementById('mp-delete-confirm').classList.remove('show');
  document.getElementById('mp-delete-btn').style.display = '';
  const rs = document.getElementById('mp-replace-status');
  rs.textContent = '';
  rs.style.display = 'none';

  // Switch to detail view
  document.getElementById('mp-grid-view').style.display   = 'none';
  document.getElementById('mp-detail-view').style.display = '';
  document.getElementById('mp-back-btn').style.display    = '';
  document.getElementById('mp-title').textContent         = 'Bilddetaljer';
}

// ════════════════════════════════════════════════════════════════════════════
// ALT TEXT  — auto-saved on blur so improvements persist regardless of whether
// the admin ultimately selects this image or navigates back to the grid
// ════════════════════════════════════════════════════════════════════════════

async function _mpSaveAltText() {
  if (!_mpActiveItem) return;
  const newAlt = document.getElementById('mp-alt').value.trim();
  if (newAlt === (_mpActiveItem.alt_text || '')) return; // unchanged — nothing to do

  const result = await updateMediaMetadata(_mpActiveItem.id, { alt_text: newAlt }); // admin-shared.js
  if (!result.success) { showToast('Kunde inte spara alt-text.', 't-amber'); return; }

  _mpActiveItem.alt_text = newAlt;

  // Sync master list so grid thumbnail alt attributes update if user returns to grid
  const m = _mpAllMedia.find(x => x.id === _mpActiveItem.id);
  if (m) m.alt_text = newAlt;

  const savedEl = document.getElementById('mp-alt-saved');
  savedEl.classList.add('show');
  setTimeout(() => savedEl.classList.remove('show'), 2200);
}

// ════════════════════════════════════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════════════════════════════════════

async function _mpConfirmSelect() {
  if (!_mpCallback || !_mpActiveItem) return;

  // Ensure any pending alt text change is committed before the row is handed back
  const pendingAlt = document.getElementById('mp-alt').value.trim();
  if (pendingAlt !== (_mpActiveItem.alt_text || '')) {
    const result = await updateMediaMetadata(_mpActiveItem.id, { alt_text: pendingAlt }); // admin-shared.js
    if (result.success) {
      _mpActiveItem.alt_text = pendingAlt;
      const m = _mpAllMedia.find(x => x.id === _mpActiveItem.id);
      if (m) m.alt_text = pendingAlt;
    }
  }

  _mpCallback({ ..._mpActiveItem }); // pass a shallow copy so caller can't mutate cache
  _mpClose();
}

// ════════════════════════════════════════════════════════════════════════════
// UPLOAD  (multi-file, drag-drop + click-to-browse, max 3 concurrent)
// ════════════════════════════════════════════════════════════════════════════

function _mpToggleUploadZone() {
  _mpUploadOpen = !_mpUploadOpen;
  document.getElementById('mp-upload-zone-wrap').classList.toggle('open', _mpUploadOpen);
  document.getElementById('mp-upload-toggle').classList.toggle('active', _mpUploadOpen);
  document.querySelector('#mp-upload-toggle .mp-toggle-label').textContent =
    _mpUploadOpen ? '▲ Dölj uppladdning' : '▼ Ladda upp ny bild';
}

async function _mpHandleUpload(files) {
  const listEl = document.getElementById('mp-upload-list');
  listEl.innerHTML = '';
  listEl.style.display = 'block';

  const queue = Array.from(files).map(file => {
    const row = document.createElement('div');
    row.className = 'mp-upload-item';
    row.innerHTML = `<span class="u-name">${escH(file.name)}</span>
                     <span class="u-status">Väntar…</span>`;
    listEl.appendChild(row);
    return { file, row };
  });

  for (let i = 0; i < queue.length; i += 3) {
    await Promise.all(
      queue.slice(i, i + 3).map(({ file, row }) => _mpUploadOne(file, row))
    );
  }

  // Invalidate cache and refresh grid so new images appear immediately
  _mpLoaded = false;
  await _mpLoadMedia();
}

async function _mpUploadOne(file, rowEl) {
  const setStatus = (text, cls) => {
    rowEl.querySelector('.u-status').textContent = text;
    rowEl.className = 'mp-upload-item' + (cls ? ' ' + cls : '');
  };

  setStatus('Laddar upp…', '');
  const result = await uploadMediaFile(file); // admin-shared.js

  if (!result.success) {
    setStatus(result.error, ' u-error');
    showToast(
      result.partial
        ? file.name + ': fil uppladdad men DB-rad saknas.'
        : file.name + ': ' + result.error,
      result.partial ? 't-amber' : 't-red'
    );
    return;
  }

  setStatus('✓ Klart', ' u-done');
}

// ════════════════════════════════════════════════════════════════════════════
// REPLACE IMAGE
// Uploads a new file and updates the existing media_library row in-place,
// keeping the same ID so all references by ID remain valid.
// NOTE: Anything referencing this image by its direct public_url string
// (not by ID) will break because both the storage path and URL change.
// Such references must be updated manually.
// ════════════════════════════════════════════════════════════════════════════

async function _mpHandleReplace(file) {
  if (!_mpActiveItem) return;

  const statusEl = document.getElementById('mp-replace-status');
  statusEl.textContent = 'Laddar upp ny fil…';
  statusEl.style.display = 'block';

  if (!file.type.startsWith('image/')) {
    statusEl.style.display = 'none';
    showToast('Ej en bildfil.', 't-red');
    return;
  }
  if (file.size > MEDIA_MAX_BYTES) {
    statusEl.style.display = 'none';
    showToast('Överstiger 10 MB.', 't-red');
    return;
  }

  const oldStoragePath = _mpActiveItem.storage_path;
  const newStoragePath = Date.now() + '-' + sanitizePath(file.name);

  // 1. Upload new file to Storage
  const { error: storageErr } = await supabaseClient.storage
    .from('media')
    .upload(newStoragePath, file, { contentType: file.type });

  if (storageErr) {
    statusEl.style.display = 'none';
    showToast('Uppladdning misslyckades: ' + storageErr.message, 't-red');
    return;
  }

  // 2. Get public URL + dimensions for the new file
  const { data: urlData } = supabaseClient.storage.from('media').getPublicUrl(newStoragePath);
  const { width, height } = await getImageDimensions(file);

  // 3. Update the SAME DB row so the ID is preserved (direct call, not updateMediaMetadata,
  //    since we're replacing file-level fields rather than metadata)
  const { data: updatedRow, error: updateErr } = await supabaseClient
    .from('media_library')
    .update({
      file_name:    file.name,
      storage_path: newStoragePath,
      public_url:   urlData.publicUrl,
      width,
      height,
      file_size:    file.size,
      mime_type:    file.type,
    })
    .eq('id', _mpActiveItem.id)
    .select()
    .single();

  if (updateErr) {
    statusEl.style.display = 'none';
    showToast('Ny fil uppladdad men rad ej uppdaterad: ' + updateErr.message, 't-amber');
    return;
  }

  // 4. Delete old storage file (soft-fail — orphaned file is not critical)
  supabaseClient.storage.from('media').remove([oldStoragePath])
    .catch(err => console.warn('Gammal bildfil kvar i Storage:', err));

  // 5. Update internal state and refresh the detail view
  Object.assign(_mpActiveItem, updatedRow);
  const idx = _mpAllMedia.findIndex(x => x.id === _mpActiveItem.id);
  if (idx !== -1) Object.assign(_mpAllMedia[idx], updatedRow);

  statusEl.style.display = 'none';
  _mpShowDetail(_mpActiveItem.id);
  showToast('Bild ersatt.', 't-green');
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE  (two-step inline confirmation)
// ════════════════════════════════════════════════════════════════════════════

function _mpStartDelete() {
  document.getElementById('mp-delete-confirm').classList.add('show');
  document.getElementById('mp-delete-btn').style.display = 'none';
}

function _mpCancelDelete() {
  document.getElementById('mp-delete-confirm').classList.remove('show');
  document.getElementById('mp-delete-btn').style.display = '';
}

async function _mpConfirmDelete() {
  if (!_mpActiveItem) return;

  const result = await deleteMediaItem(_mpActiveItem.id, _mpActiveItem.storage_path); // admin-shared.js

  if (!result.success && result.step === 'storage') {
    // Abort — file still in Storage, DB row intentionally untouched
    showToast('Kunde inte radera filen: ' + result.error.message, 't-red');
    _mpCancelDelete();
    return;
  }

  if (!result.success && result.step === 'db') {
    // File is gone but DB row lingers — surface it so admin can clean up manually
    showToast('Fil raderad, databaspost kvarstår: ' + result.error.message, 't-amber');
  } else {
    showToast('Bild raderad.', 't-amber');
  }

  // Remove from cache regardless (file is gone either way)
  _mpAllMedia = _mpAllMedia.filter(x => x.id !== _mpActiveItem.id);
  _mpShowGridView();
  _mpApplyFilters();
}

// ════════════════════════════════════════════════════════════════════════════
// DOM INJECTION  (runs once on first openMediaPicker() call)
// ════════════════════════════════════════════════════════════════════════════

function _mpInjectStyles() {
  if (document.getElementById('mp-styles')) return;
  const el = document.createElement('style');
  el.id = 'mp-styles';
  el.textContent = `
/* ── Media Picker overlay ── */
.mp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:1200;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.22s ease;}
.mp-overlay.open{opacity:1;pointer-events:all;}

/* Card shell */
.mp-card{background:var(--dark2);border:1px solid rgba(255,255,255,0.1);border-radius:14px;width:92vw;max-width:1020px;height:84vh;display:flex;flex-direction:column;overflow:hidden;}

/* Header */
.mp-header{display:flex;align-items:center;gap:0.6rem;padding:1rem 1.25rem 0.85rem;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.mp-title{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1.1rem;text-transform:uppercase;letter-spacing:0.04em;margin:0;color:var(--white);flex:1;}
.mp-close-btn{background:transparent;border:none;color:var(--gray);font-size:1.1rem;cursor:pointer;padding:0.3rem;line-height:1;border-radius:4px;transition:color 0.15s;flex-shrink:0;}
.mp-close-btn:hover{color:var(--white);}
.mp-back-btn{background:transparent;border:1px solid rgba(255,255,255,0.12);color:var(--gray-light);font-size:0.8rem;font-family:"Barlow",sans-serif;font-weight:600;cursor:pointer;padding:0.28rem 0.65rem;border-radius:5px;transition:color 0.15s,border-color 0.15s;white-space:nowrap;flex-shrink:0;}
.mp-back-btn:hover{color:var(--white);border-color:rgba(255,255,255,0.3);}

/* Grid view — fills remaining card height */
.mp-grid-view{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;}

/* Upload zone */
.mp-upload-section{flex-shrink:0;padding:0.75rem 1.25rem 0;}
.mp-upload-toggle{display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.46rem 0.85rem;background:var(--dark3);border:1px dashed rgba(255,255,255,0.17);border-radius:7px;color:var(--gray-light);font-size:0.82rem;font-weight:600;font-family:"Barlow",sans-serif;cursor:pointer;transition:border-color 0.18s,color 0.18s;text-align:left;box-sizing:border-box;}
.mp-upload-toggle:hover{border-color:rgba(255,255,255,0.38);color:var(--white);}
.mp-upload-toggle.active{border-style:solid;border-color:var(--blue-light);color:var(--white);}
.mp-upload-zone-wrap{max-height:0;overflow:hidden;transition:max-height 0.24s ease;}
.mp-upload-zone-wrap.open{max-height:240px;}
.mp-upload-drop{border:2px dashed rgba(255,255,255,0.13);border-radius:7px;padding:0.82rem 1rem;text-align:center;color:var(--gray);font-size:0.8rem;line-height:1.5;cursor:pointer;transition:border-color 0.18s,background 0.18s;margin-top:0.55rem;}
.mp-upload-drop:hover,.mp-upload-drop.drag-over{border-color:var(--blue);background:rgba(26,79,255,0.07);color:var(--gray-light);}
.mp-upload-list{margin-top:0.4rem;max-height:90px;overflow-y:auto;}
.mp-upload-item{display:flex;align-items:center;gap:0.5rem;padding:0.24rem 0;font-size:0.77rem;color:var(--gray-light);border-bottom:1px solid rgba(255,255,255,0.05);}
.mp-upload-item .u-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mp-upload-item .u-status{font-size:0.73rem;color:var(--gray);flex-shrink:0;}
.mp-upload-item.u-done .u-status{color:var(--green);}
.mp-upload-item.u-error .u-status{color:var(--red);}

/* Filter toolbar */
.mp-toolbar{display:flex;align-items:center;gap:0.6rem;padding:0.7rem 1.25rem 0.5rem;flex-shrink:0;flex-wrap:wrap;}
.mp-search{flex:1;min-width:110px;background:var(--dark3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.42rem 0.85rem;color:var(--white);font-family:"Barlow",sans-serif;font-size:0.84rem;outline:none;min-height:36px;transition:border-color 0.2s;}
.mp-search:focus{border-color:var(--blue);}
.mp-cat-select{background:var(--dark3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.42rem 0.85rem;color:var(--white);font-family:"Barlow",sans-serif;font-size:0.84rem;outline:none;cursor:pointer;min-height:36px;transition:border-color 0.2s;}
.mp-cat-select:focus{border-color:var(--blue);}
.mp-cat-select option{background:var(--dark3);}

/* Scrollable grid container */
.mp-grid-scroll{flex:1;overflow-y:auto;padding:0.3rem 1.25rem 1.25rem;min-height:0;}

/* Picker thumbnail cards — extends .media-card from admin-shared.css */
.mp-pick-card{cursor:pointer;outline:2px solid transparent;transition:outline-color 0.15s,transform 0.1s;}
.mp-pick-card:hover,.mp-pick-card:focus{outline-color:var(--blue);transform:translateY(-2px);}
.mp-pick-card:focus{outline-style:solid;}

/* ── Detail view ── */
.mp-detail-view{flex:1;overflow-y:auto;padding:1.25rem;display:none;}
.mp-detail-inner{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start;}
.mp-detail-img-wrap img{width:100%;max-height:420px;object-fit:contain;border-radius:8px;background:var(--dark3);border:1px solid rgba(255,255,255,0.08);}
.mp-detail-filename{font-weight:700;font-size:0.95rem;color:var(--white);word-break:break-all;margin-bottom:0.35rem;}
.mp-detail-meta{display:flex;flex-wrap:wrap;gap:0.28rem 0.7rem;margin-bottom:1rem;font-size:0.74rem;color:var(--gray);}
.mp-field{margin-bottom:0.9rem;}
.mp-field label{display:block;font-size:0.7rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--gray);margin-bottom:0.32rem;}
.mp-field input{width:100%;box-sizing:border-box;background:var(--dark3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--white);font-family:"Barlow",sans-serif;font-size:0.84rem;padding:0.42rem 0.7rem;outline:none;transition:border-color 0.2s;}
.mp-field input:focus{border-color:var(--blue);}
.mp-alt-saved{font-size:0.7rem;color:var(--green);opacity:0;transition:opacity 0.4s;margin-top:0.2rem;display:block;}
.mp-alt-saved.show{opacity:1;}

/* Detail action buttons */
.mp-detail-actions{display:flex;flex-direction:column;gap:0.46rem;margin-top:0.85rem;}
.mp-btn-primary{background:var(--blue);border:none;color:var(--white);font-family:"Barlow",sans-serif;font-weight:700;font-size:0.88rem;border-radius:7px;padding:0.6rem 1rem;cursor:pointer;transition:background 0.2s;text-align:center;width:100%;}
.mp-btn-primary:hover{background:var(--blue-light);}
.mp-btn-secondary{background:var(--dark3);border:1px solid rgba(255,255,255,0.12);color:var(--gray-light);font-family:"Barlow",sans-serif;font-weight:600;font-size:0.84rem;border-radius:7px;padding:0.48rem 0.9rem;cursor:pointer;transition:color 0.15s,border-color 0.15s;text-align:center;width:100%;}
.mp-btn-secondary:hover{color:var(--white);border-color:rgba(255,255,255,0.3);}
.mp-btn-danger{background:transparent;border:1px solid rgba(232,64,64,0.3);color:var(--red);font-family:"Barlow",sans-serif;font-weight:600;font-size:0.84rem;border-radius:7px;padding:0.48rem 0.9rem;cursor:pointer;transition:background 0.18s,border-color 0.18s;text-align:center;width:100%;}
.mp-btn-danger:hover{background:rgba(232,64,64,0.1);border-color:var(--red);}
.mp-replace-status{font-size:0.75rem;color:var(--accent);padding:0.25rem 0;}
.mp-delete-confirm{background:rgba(232,64,64,0.08);border:1px solid rgba(232,64,64,0.25);border-radius:7px;padding:0.6rem 0.85rem;display:none;}
.mp-delete-confirm.show{display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;}
.mp-delete-confirm > span{font-size:0.82rem;color:#ffaaaa;font-weight:600;flex:1;}
.mp-delete-confirm button{font-family:"Barlow",sans-serif;font-size:0.79rem;font-weight:700;padding:0.32rem 0.7rem;border-radius:5px;cursor:pointer;}
#mp-delete-yes{background:var(--red);border:none;color:var(--white);}
#mp-delete-no{background:transparent;border:1px solid rgba(255,255,255,0.18);color:var(--gray-light);}

/* Responsive */
@media(max-width:700px){
  .mp-detail-inner{grid-template-columns:1fr;}
  .mp-card{height:92vh;}
}
@media(max-width:480px){
  .mp-header{padding:0.75rem 1rem 0.65rem;}
  .mp-upload-section{padding-left:1rem;padding-right:1rem;}
  .mp-toolbar{padding:0.65rem 1rem 0.5rem;}
  .mp-grid-scroll{padding-left:1rem;padding-right:1rem;}
  .mp-detail-view{padding:0.9rem 1rem;}
}
`;
  document.head.appendChild(el);
}

function _mpInjectHTML() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="mp-overlay" id="mp-overlay">
  <div class="mp-card" id="mp-card">

    <!-- Shared header — title and back button change between views -->
    <div class="mp-header">
      <button class="mp-back-btn" id="mp-back-btn" style="display:none;">&#8592; Tillbaka till rutn&#228;t</button>
      <h3 class="mp-title" id="mp-title">Mediabibliotek</h3>
      <button class="mp-close-btn" id="mp-close-btn" aria-label="St&#228;ng">&#10005;</button>
    </div>

    <!-- ════════ GRID VIEW ════════ -->
    <div class="mp-grid-view" id="mp-grid-view">

      <!-- Collapsible upload zone -->
      <div class="mp-upload-section">
        <button class="mp-upload-toggle" id="mp-upload-toggle" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <span class="mp-toggle-label">&#9660; Ladda upp ny bild</span>
        </button>
        <div class="mp-upload-zone-wrap" id="mp-upload-zone-wrap">
          <div class="mp-upload-drop" id="mp-upload-drop">
            <input type="file" id="mp-file-input" accept="image/*" multiple hidden>
            Drag &amp; sl&#228;pp bilder hit, eller klicka f&#246;r att v&#228;lja
            &mdash; PNG, JPG, WebP, GIF &middot; max 10 MB per fil
          </div>
          <div class="mp-upload-list" id="mp-upload-list" style="display:none;"></div>
        </div>
      </div>

      <!-- Search + category filter -->
      <div class="mp-toolbar">
        <input class="mp-search" id="mp-search" type="search"
               placeholder="S&#246;k filnamn, alt-text&#8230;" autocomplete="off">
        <select class="mp-cat-select" id="mp-cat">
          <option value="all">Alla kategorier</option>
          <option value="blog">Blogg</option>
          <option value="hero">Hero</option>
          <option value="portfolio">Portfolio</option>
          <option value="prebuilt">Prebuilt</option>
          <option value="team">Team</option>
          <option value="logo">Logotyper</option>
          <option value="marketing">Marknadsf&#246;ring</option>
          <option value="uncategorized">Okategoriserad</option>
        </select>
      </div>

      <!-- Scrollable thumbnail grid -->
      <div class="mp-grid-scroll" id="mp-grid-scroll">
        <div class="media-grid" id="mp-grid">
          <div class="media-empty">Laddar&#8230;</div>
        </div>
      </div>

    </div><!-- /.mp-grid-view -->

    <!-- ════════ DETAIL VIEW ════════ -->
    <div class="mp-detail-view" id="mp-detail-view" style="display:none;">
      <div class="mp-detail-inner">

        <!-- Left column: large image preview -->
        <div class="mp-detail-img-wrap">
          <img id="mp-detail-img" src="" alt="">
        </div>

        <!-- Right column: editable fields + action buttons -->
        <div class="mp-detail-info">
          <div class="mp-detail-filename" id="mp-detail-filename"></div>
          <div class="mp-detail-meta" id="mp-detail-meta"></div>

          <!-- Alt text — auto-saved on blur so improvements persist
               even if the admin doesn't ultimately select this image -->
          <div class="mp-field">
            <label for="mp-alt">Alt-text</label>
            <input type="text" id="mp-alt" maxlength="200"
                   placeholder="Beskriv bilden (SEO &amp; tillg&#228;nglighet)">
            <span class="mp-alt-saved" id="mp-alt-saved">&#10003; Alt-text sparad</span>
          </div>

          <div class="mp-detail-actions">
            <button class="mp-btn-primary" id="mp-select-btn">V&#228;lj denna bild</button>
            <button class="mp-btn-secondary" id="mp-copy-url-btn">Kopiera URL</button>
            <!-- Replace: uploads a new file and updates this row in-place.
                 The ID is preserved so references by ID remain valid.
                 References by direct URL must be updated manually. -->
            <button class="mp-btn-secondary" id="mp-replace-btn">Ers&#228;tt bild</button>
            <input type="file" id="mp-replace-input" accept="image/*" hidden>
            <span class="mp-replace-status" id="mp-replace-status" style="display:none;"></span>
            <button class="mp-btn-danger" id="mp-delete-btn">Ta bort</button>
            <!-- Inline delete confirmation — shown only when Ta bort is clicked -->
            <div class="mp-delete-confirm" id="mp-delete-confirm">
              <span>Radera bilden permanent?</span>
              <button id="mp-delete-yes">Ja, radera</button>
              <button id="mp-delete-no">Avbryt</button>
            </div>
          </div>
        </div><!-- /.mp-detail-info -->

      </div><!-- /.mp-detail-inner -->
    </div><!-- /.mp-detail-view -->

  </div><!-- /.mp-card -->
</div><!-- /#mp-overlay -->`;

  document.body.appendChild(wrap.firstElementChild);
}

// ════════════════════════════════════════════════════════════════════════════
// EVENT BINDING  (called once after _mpInjectHTML)
// ════════════════════════════════════════════════════════════════════════════

function _mpBindEvents() {
  const $ = id => document.getElementById(id);

  // Close on overlay background click or Escape key
  $('mp-overlay').addEventListener('click', e => {
    if (e.target === $('mp-overlay')) _mpClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('mp-overlay').classList.contains('open')) _mpClose();
  });

  $('mp-close-btn').addEventListener('click', _mpClose);

  // Back button: detail → grid
  $('mp-back-btn').addEventListener('click', () => {
    _mpShowGridView();
    _mpApplyFilters();
  });

  // Upload zone toggle
  $('mp-upload-toggle').addEventListener('click', _mpToggleUploadZone);

  // Drop zone: click-to-browse
  $('mp-upload-drop').addEventListener('click', () => $('mp-file-input').click());

  // Drop zone: drag-over highlight
  $('mp-upload-drop').addEventListener('dragover', e => {
    e.preventDefault();
    $('mp-upload-drop').classList.add('drag-over');
  });
  $('mp-upload-drop').addEventListener('dragleave', e => {
    if (!$('mp-upload-drop').contains(e.relatedTarget))
      $('mp-upload-drop').classList.remove('drag-over');
  });
  $('mp-upload-drop').addEventListener('drop', e => {
    e.preventDefault();
    $('mp-upload-drop').classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) _mpHandleUpload(files);
    else showToast('Endast bildfiler accepteras.', 't-amber');
  });

  // File input (browse dialog)
  $('mp-file-input').addEventListener('change', e => {
    if (e.target.files.length) _mpHandleUpload(Array.from(e.target.files));
    e.target.value = '';
  });

  // Search + filter
  $('mp-search').addEventListener('input', _mpApplyFilters);
  $('mp-cat').addEventListener('change', _mpApplyFilters);

  // Grid: thumbnail click via event delegation (no global callback needed)
  $('mp-grid-scroll').addEventListener('click', e => {
    const card = e.target.closest('[data-media-id]');
    if (card) _mpShowDetail(card.dataset.mediaId);
  });
  $('mp-grid-scroll').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('[data-media-id]');
      if (card) { e.preventDefault(); _mpShowDetail(card.dataset.mediaId); }
    }
  });

  // Detail: confirm selection
  $('mp-select-btn').addEventListener('click', _mpConfirmSelect);

  // Detail: copy URL
  $('mp-copy-url-btn').addEventListener('click', () => {
    if (_mpActiveItem) copyUrl(_mpActiveItem.public_url);
  });

  // Detail: replace image
  $('mp-replace-btn').addEventListener('click', () => $('mp-replace-input').click());
  $('mp-replace-input').addEventListener('change', e => {
    if (e.target.files.length) _mpHandleReplace(e.target.files[0]);
    e.target.value = '';
  });

  // Detail: alt text auto-save on blur
  $('mp-alt').addEventListener('blur', _mpSaveAltText);

  // Detail: delete flow
  $('mp-delete-btn').addEventListener('click', _mpStartDelete);
  $('mp-delete-yes').addEventListener('click', _mpConfirmDelete);
  $('mp-delete-no').addEventListener('click', _mpCancelDelete);
}
