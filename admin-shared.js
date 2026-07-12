// ── SUPABASE CONFIG ──
const SB_URL = "https://pflehgaffylcfmgltzlr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGVoZ2FmZnlsY2ZtZ2x0emxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODcxMjQsImV4cCI6MjA5NjU2MzEyNH0.9Hh4n-9IvsCBnwEbcKBhGan2LskY3lKhoeRcA2lxXac";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// ── AUTH ──
// Call on every admin page except employe.html itself.
// Redirects to employe.html if no valid session; returns session if authenticated.
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'employe.html';
    return null;
  }
  initIdleTimeoutTracking();
  return session;
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'employe.html';
}

// ── IDLE AUTO-LOGOUT ──
const IDLE_TIMEOUT_MS   = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // warn 2 min before logout

let _idleTimer         = null;
let _warningTimer      = null;
let _warningModalEl    = null;
let _countdownInterval = null;

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  clearTimeout(_warningTimer);
  _hideIdleWarning();
  _warningTimer = setTimeout(_showIdleWarning, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
  _idleTimer    = setTimeout(_performIdleLogout, IDLE_TIMEOUT_MS);
}

function _showIdleWarning() {
  if (!_warningModalEl) {
    _warningModalEl = document.createElement('div');
    _warningModalEl.id = 'idle-warning-modal';
    _warningModalEl.innerHTML = `
      <div class="idle-warning-backdrop">
        <div class="idle-warning-box">
          <h3>Du loggas ut snart</h3>
          <p>Du har varit inaktiv ett tag. Du loggas ut automatiskt om <span id="idle-countdown">2:00</span> minuter av säkerhetsskäl.</p>
          <button id="idle-stay-logged-in-btn">Fortsätt vara inloggad</button>
        </div>
      </div>`;
    document.body.appendChild(_warningModalEl);
    document.getElementById('idle-stay-logged-in-btn').addEventListener('click', resetIdleTimer);
  }
  _warningModalEl.style.display = 'flex';
  _startCountdownDisplay();
}

function _hideIdleWarning() {
  if (_warningModalEl) _warningModalEl.style.display = 'none';
  clearInterval(_countdownInterval);
}

function _startCountdownDisplay() {
  let remainingMs = WARNING_BEFORE_MS;
  clearInterval(_countdownInterval);
  _countdownInterval = setInterval(() => {
    remainingMs -= 1000;
    if (remainingMs <= 0) { clearInterval(_countdownInterval); return; }
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    const el = document.getElementById('idle-countdown');
    if (el) el.textContent = mins + ':' + String(secs).padStart(2, '0');
  }, 1000);
}

async function _performIdleLogout() {
  _hideIdleWarning();
  await supabaseClient.auth.signOut();
  window.location.href = 'employe.html?reason=idle';
}

function initIdleTimeoutTracking() {
  // Guard: only wire up once even if called multiple times
  if (initIdleTimeoutTracking._initialized) return;
  initIdleTimeoutTracking._initialized = true;
  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

// ── TOAST ──
let _toastTimer;
function showToast(msg, cls = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + cls;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast ' + cls; }, 2800);
}

// ── SIDEBAR NAV ──
const ADMIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',     href: 'employe.html',         icon: 'grid'     },
  { id: 'bookings',  label: 'Bokningar',      href: 'bookings-admin.html',  icon: 'inbox'    },
  { id: 'sale',      label: 'Rea & Priser',  href: 'sale-admin.html',      icon: 'tag'      },
  { id: 'analysis',  label: 'PC-analys',      href: 'form-admin.html',      icon: 'chart'    },
  { id: 'blog',      label: 'Blogg',          href: 'blog-admin.html',      icon: 'edit'     },
  { id: 'portfolio', label: 'Portfolio',      href: 'portfolio-admin.html', icon: 'image'    },
  { id: 'prebuilt',  label: 'Prebyggda PC',   href: 'prebuilt-admin.html',  icon: 'monitor'   },
  { id: 'forms',     label: 'Formulär',       href: 'form-admin.html',      icon: 'clipboard' },
  { id: 'media',     label: 'Mediabibliotek', href: 'media-admin.html',     icon: 'folder'    },
  { id: 'seo',       label: 'SEO',            href: 'seo-admin.html',       icon: 'search'   },
  { id: 'settings',  label: 'Instellningar',  href: 'settings.html',        icon: 'settings' },
];

const _NAV_ICONS = {
  grid:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  inbox:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  edit:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  image:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  folder:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  tag:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  clipboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

// Renders sidebar + mobile controls into #admin-nav.
// activePage: one of the id values in ADMIN_NAV_ITEMS (e.g. 'dashboard').
// After calling this, set the user email via:
//   document.getElementById('sidebar-user-email').textContent = email;
function renderAdminNav(activePage) {
  const container = document.getElementById('admin-nav');
  if (!container) return;

  const links = ADMIN_NAV_ITEMS.map(item => `
    <a href="${item.href}" class="sidebar-link${activePage === item.id ? ' active' : ''}">
      <span class="sidebar-icon">${_NAV_ICONS[item.icon]}</span>
      <span>${item.label}</span>
    </a>`).join('');

  container.innerHTML = `
    <nav class="admin-sidebar" id="admin-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">Nordic <strong>PC</strong><span class="sidebar-admin-badge">Admin</span></div>
        <button class="sidebar-close-btn" onclick="toggleAdminNav()" aria-label="St&#228;ng">&#10005;</button>
      </div>
      <div class="sidebar-user-row" id="sidebar-user-email"></div>
      <div class="sidebar-nav">${links}</div>
      <div class="sidebar-footer">
        <a href="index.html" target="_blank" class="sidebar-site-link">&#8592; Hemsidan</a>
        <button onclick="adminLogout()" class="sidebar-logout-btn">Logga ut</button>
      </div>
    </nav>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleAdminNav()"></div>
    <button class="nav-hamburger" id="nav-hamburger" onclick="toggleAdminNav()" aria-label="&#214;ppna meny">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>`;
}

function toggleAdminNav() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

// ── HELPERS ──
function slugify(text) {
  return String(text)
    .toLowerCase().trim()
    .replace(/å/g,'a').replace(/ä/g,'a').replace(/ö/g,'o')
    .replace(/[^a-z0-9\s-]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-');
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ══════════════════════════════════════════════════════════════════
// SHARED MEDIA LIBRARY — used by media-admin.html AND blog-editor.html
// ══════════════════════════════════════════════════════════════════

// Category value → display label map (English keys match DB + storage values)
const MEDIA_CAT_LABELS = {
  blog:          'Blogg',
  hero:          'Hero',
  portfolio:     'Portfolio',
  prebuilt:      'Prebuilt',
  team:          'Team',
  logo:          'Logotyper',
  marketing:     'Marknadsföring',
  uncategorized: 'Okategoriserad',
};

// Fetches all media_library rows ordered newest-first.
// Returns the raw Supabase { data, error } object — callers handle errors.
async function loadMediaLibrary() {
  return supabaseClient
    .from('media_library')
    .select('id,file_name,storage_path,public_url,alt_text,caption,category,file_size,width,height,mime_type,uploaded_at')
    .order('uploaded_at', { ascending: false });
}

// Returns an HTML string for a responsive thumbnail grid.
//
// options.mode = 'manage' (default)
//   Full management cards: hover "Kopiera URL" button; onclick calls openModal(id)
//   which must exist as a global on the host page.
//
// options.mode = 'pick'
//   Simplified picker cards: clicking calls options.onSelectCallback(id).
//   onSelectCallback must be a globally accessible function name (string).
//
// options.emptyMessage — displayed when items array is empty.
function renderMediaGridHTML(items, options = {}) {
  const {
    mode             = 'manage',
    onSelectCallback = 'pickMediaItem',
    emptyMessage     = 'Inga bilder hittades.',
  } = options;

  if (!items.length) return `<div class="media-empty">${emptyMessage}</div>`;

  return items.map(m => {
    const label   = MEDIA_CAT_LABELS[m.category] || escH(m.category || '');
    const sizeStr = formatBytes(m.file_size);
    const imgSrc  = escAttr(m.public_url);
    const imgAlt  = escAttr(m.alt_text || m.file_name);

    if (mode === 'pick') {
      return `<div class="media-card media-card-pick" onclick="${escAttr(onSelectCallback)}(${m.id})" role="button" tabindex="0">
        <img class="media-card-thumb" src="${imgSrc}" alt="${imgAlt}" loading="lazy">
        <div class="media-card-body">
          <div class="media-card-name">${escH(m.file_name)}</div>
          <div class="media-card-meta">
            <span class="media-cat-badge">${escH(label)}</span>
            <span class="media-size">${sizeStr}</span>
          </div>
        </div>
      </div>`;
    }

    // mode = 'manage' — full card with "Kopiera URL" hover affordance
    return `<div class="media-card" onclick="openModal(${m.id})">
      <img class="media-card-thumb" src="${imgSrc}" alt="${imgAlt}" loading="lazy">
      <div class="media-card-body">
        <div class="media-card-name">${escH(m.file_name)}</div>
        <div class="media-card-meta">
          <span class="media-cat-badge">${escH(label)}</span>
          <span class="media-size">${sizeStr}</span>
        </div>
      </div>
      <div class="media-card-hover">
        <button class="media-copy-btn"
                onclick="event.stopPropagation(); copyUrl('${escAttr(m.public_url)}')">
          Kopiera URL
        </button>
      </div>
    </div>`;
  }).join('');
}

// Uploads a single image File to Supabase Storage, then inserts a media_library row.
// Returns { success, data?, error?, partial? }
// partial=true means storage succeeded but the DB insert failed — file exists, row missing.
const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// category defaults to 'uncategorized'; pass a value from MEDIA_CAT_LABELS keys to override.
async function uploadMediaFile(file, category = 'uncategorized') {
  if (!file.type.startsWith('image/')) return { success: false, error: 'Ej en bildfil' };
  if (file.size > MEDIA_MAX_BYTES)     return { success: false, error: 'Överstiger 10 MB' };

  const storagePath = Date.now() + '-' + sanitizePath(file.name);

  const { error: storageErr } = await supabaseClient.storage
    .from('media')
    .upload(storagePath, file, { contentType: file.type });

  if (storageErr) return { success: false, error: 'Lagring: ' + storageErr.message };

  const { data: urlData } = supabaseClient.storage.from('media').getPublicUrl(storagePath);
  const { width, height } = await getImageDimensions(file);

  const { data, error: dbErr } = await supabaseClient
    .from('media_library')
    .insert({
      file_name:    file.name,
      storage_path: storagePath,
      public_url:   urlData.publicUrl,
      alt_text:     '',
      caption:      '',
      category:     category,
      file_size:    file.size,
      width, height,
      mime_type:    file.type,
    })
    .select()
    .single();

  if (dbErr) return { success: false, partial: true, error: dbErr.message, storagePath };
  return { success: true, data };
}

// Updates fields on an existing media_library row. Typically used for
// alt_text / caption / category, but accepts any valid column map.
// Returns { success: boolean, data?: updatedRow, error?: Error }
async function updateMediaMetadata(id, updates) {
  const { data, error } = await supabaseClient
    .from('media_library')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error };
  return { success: true, data };
}

// Deletes the Storage object and the media_library DB row for the given item.
// Returns { success: boolean, step?: 'storage'|'db', error?: Error }
// On storage failure the DB row is NOT touched (keeps data consistent).
// On DB failure after storage deletion, the file is gone but the row lingers —
// callers should surface this distinction so the admin knows to clean up manually.
async function deleteMediaItem(id, storagePath) {
  const { error: storageErr } = await supabaseClient.storage
    .from('media')
    .remove([storagePath]);

  if (storageErr) return { success: false, step: 'storage', error: storageErr };

  const { error: dbErr } = await supabaseClient
    .from('media_library')
    .delete()
    .eq('id', id);

  if (dbErr) return { success: false, step: 'db', error: dbErr };
  return { success: true };
}

// ── SHARED UTILITIES ──────────────────────────────────────────────

// Reads natural pixel dimensions from a File via a temporary object URL.
function getImageDimensions(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    img.src = url;
  });
}

// Returns a lowercase, hyphenated filename safe for Supabase Storage paths.
function sanitizePath(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-+/g, '-');
}

// Human-readable file size (B / KB / MB).
function formatBytes(n) {
  if (!n) return '—';
  if (n < 1024)         return n + ' B';
  if (n < 1024 * 1024)  return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// Copies url to clipboard and shows a toast.
function copyUrl(url) {
  navigator.clipboard.writeText(url)
    .then(() => showToast('URL kopierad!', 't-green'))
    .catch(() => showToast('Kunde inte kopiera.', 't-amber'));
}

// HTML-escapes a string for safe use in text content.
function escH(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// HTML-escapes a string for safe use inside attribute values.
function escAttr(s) {
  if (s == null) return '';
  return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── ARTICLE VIEW COUNTER ──
// Called from public article pages to increment the view count for a post.
// Uses localStorage with a 24-hour expiry per post rather than sessionStorage.
// Rationale: sessionStorage resets on tab close, so a visitor returning the next
// day in a new tab would re-increment — which is correct — but closing and reopening
// the *same* tab mid-session would also re-increment, which is noise. localStorage
// with a 24-hour TTL is a better balance: it counts genuine daily unique views
// (a returning visitor the following day is meaningfully a new view) while
// suppressing same-session and intra-day duplicates.
async function incrementArticleView(postId) {
  const storageKey    = 'viewed_post_' + postId;
  const storedEntry   = localStorage.getItem(storageKey);
  const now           = Date.now();
  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

  if (storedEntry) {
    const lastViewed = parseInt(storedEntry, 10);
    if (!isNaN(lastViewed) && now - lastViewed < TWENTY_FOUR_H) return;
  }

  localStorage.setItem(storageKey, String(now));

  const { data: current } = await supabaseClient
    .from('blog_posts')
    .select('views')
    .eq('id', postId)
    .single();

  const newViews = (current?.views || 0) + 1;

  await supabaseClient
    .from('blog_posts')
    .update({ views: newViews, last_viewed_at: new Date().toISOString() })
    .eq('id', postId);
}
