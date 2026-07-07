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
  return session;
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'employe.html';
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
  { id: 'analysis',  label: 'PC-analys',      href: 'analysis-admin.html',  icon: 'chart'    },
  { id: 'blog',      label: 'Blogg',          href: 'blog-admin.html',      icon: 'edit'     },
  { id: 'portfolio', label: 'Portfolio',      href: 'portfolio-admin.html', icon: 'image'    },
  { id: 'prebuilt',  label: 'Prebyggda PC',   href: 'prebuilt-admin.html',  icon: 'monitor'  },
  { id: 'media',     label: 'Mediabibliotek', href: 'media-admin.html',     icon: 'folder'   },
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
