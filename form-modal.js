// GENERIC MODAL FORM ENGINE
// ==========================
// Single shared modal-form component for all public pages.
// Any page calls openFormModal(formKey, sourcePage) to open a form
// defined in the form_definitions table. Submission goes to form_submissions.
// Adding a new form type means a new DB row, not new code.

(function(global) {
  var _OVERLAY_ID = 'fme-overlay';
  var _STYLE_ID   = 'fme-styles';
  var _currentDef = null;
  var _sourcePage = 'unknown';
  var _sb         = null;

  var _SB_URL = 'https://pflehgaffylcfmgltzlr.supabase.co';
  var _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGVoZ2FmZnlsY2ZtZ2x0emxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODcxMjQsImV4cCI6MjA5NjU2MzEyNH0.9Hh4n-9IvsCBnwEbcKBhGan2LskY3lKhoeRcA2lxXac';

  // Fallback email template when a form definition has no emailjs_template_id set.
  // Reuses the existing booking notification template as a temporary default —
  // ideally this should be replaced with a purpose-built generic form template later.
  const GENERIC_FORM_EMAIL_TEMPLATE = 'template_2u6to6n';

  // ── CLIENT ──────────────────────────────────────────────────────────
  function _client() {
    if (_sb) return _sb;
    if (global.supabase) _sb = global.supabase.createClient(_SB_URL, _SB_KEY);
    return _sb;
  }

  // ── CSS INJECTION ────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById(_STYLE_ID)) return;
    var s = document.createElement('style');
    s.id  = _STYLE_ID;
    s.textContent = [
      // Overlay backdrop
      '#fme-overlay{',
        'display:none;position:fixed;inset:0;z-index:9100;',
        'background:rgba(5,8,18,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
        'align-items:center;justify-content:center;padding:1rem;',
      '}',
      '#fme-overlay.fme-open{display:flex;}',

      // Card
      '.fme-card{',
        'background:var(--dark2,#0d1225);',
        'border:1px solid rgba(26,79,255,0.2);',
        'border-radius:14px;',
        'padding:2rem;',
        'width:100%;max-width:560px;',
        'max-height:90vh;',
        'overflow-y:auto;',
        'position:relative;',
        'box-shadow:0 30px 80px rgba(0,0,0,0.65);',
      '}',

      // Open animation (skipped if prefers-reduced-motion)
      '@media (prefers-reduced-motion: no-preference){',
        '#fme-overlay.fme-open .fme-card{animation:fme-in 0.22s ease;}',
        '@keyframes fme-in{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}',
      '}',

      // Header row
      '.fme-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:0.9rem;}',
      '.fme-title{',
        'font-family:"Barlow Condensed",sans-serif;font-weight:900;',
        'font-size:1.35rem;letter-spacing:0.02em;text-transform:uppercase;',
        'color:var(--white,#eef2ff);line-height:1.2;',
      '}',
      '.fme-subtitle{font-size:0.88rem;color:var(--gray-light,#b8cae8);line-height:1.6;margin-bottom:1.4rem;}',

      // Close button
      '.fme-close-btn{',
        'background:transparent;border:none;',
        'color:var(--gray,#7a8fb5);font-size:1.15rem;',
        'cursor:pointer;padding:0.25rem 0.4rem;',
        'line-height:1;border-radius:4px;transition:color 0.2s;flex-shrink:0;',
      '}',
      '.fme-close-btn:hover{color:var(--white,#eef2ff);}',

      // Fields
      '.fme-fields{display:flex;flex-direction:column;gap:0.9rem;margin-bottom:1.4rem;}',
      '.fme-field{display:flex;flex-direction:column;gap:0.38rem;}',
      '.fme-field label{',
        'font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;',
        'color:var(--gray,#7a8fb5);',
      '}',
      '.fme-req{color:var(--cyan,#00d4ff);margin-left:0.15em;}',
      '.fme-field input,.fme-field select,.fme-field textarea{',
        'background:rgba(13,18,37,0.9);',
        'border:1px solid rgba(255,255,255,0.09);',
        'border-radius:7px;',
        'padding:0.78rem 1rem;',
        'color:var(--white,#eef2ff);',
        "font-family:'Barlow',sans-serif;",
        'font-size:1rem;',  // ≥16px prevents iOS zoom
        'outline:none;',
        'transition:border-color 0.2s,box-shadow 0.2s;',
        'appearance:none;-webkit-appearance:none;',
        'width:100%;',
      '}',
      '.fme-field input:focus,.fme-field select:focus,.fme-field textarea:focus{',
        'border-color:var(--blue,#1a4fff);',
        'box-shadow:0 0 0 2px rgba(26,79,255,0.18);',
      '}',
      '.fme-field select option{background:var(--dark2,#0d1225);}',
      '.fme-field textarea{resize:vertical;min-height:90px;}',
      // min tap target
      '.fme-field input,.fme-field select{min-height:46px;}',

      // Invalid highlight
      '.fme-field input.fme-invalid,.fme-field select.fme-invalid,.fme-field textarea.fme-invalid{',
        'border-color:rgba(255,90,90,0.7);',
      '}',

      // Submit button
      '.fme-submit-btn{',
        'background:var(--blue,#1a4fff);color:#fff;border:none;',
        'padding:0.78rem 1.6rem;border-radius:7px;',
        "font-family:'Barlow',sans-serif;",
        'font-weight:700;font-size:0.88rem;letter-spacing:0.06em;text-transform:uppercase;',
        'cursor:pointer;width:100%;min-height:46px;',
        'transition:background 0.2s,box-shadow 0.2s;',
      '}',
      '.fme-submit-btn:hover:not(:disabled){',
        'background:var(--blue-light,#3d6fff);',
        'box-shadow:0 0 22px rgba(26,79,255,0.45);',
      '}',
      '.fme-submit-btn:disabled{opacity:0.55;cursor:not-allowed;}',

      // Error message
      '.fme-error-msg{',
        'background:rgba(220,50,50,0.12);',
        'border:1px solid rgba(220,50,50,0.35);',
        'border-radius:7px;',
        'padding:0.7rem 1rem;',
        'font-size:0.84rem;',
        'color:#ff9090;',
        'margin-bottom:1rem;',
        'display:none;',
      '}',

      // Success state
      '.fme-success{text-align:center;padding:1.5rem 0.5rem 0.5rem;}',
      '.fme-success-icon{margin-bottom:1.1rem;}',
      '.fme-success-icon svg{width:52px;height:52px;color:var(--cyan,#00d4ff);}',
      '.fme-success-msg{',
        'font-size:1rem;color:var(--gray-light,#b8cae8);',
        'line-height:1.65;margin-bottom:1.5rem;',
      '}',
      '.fme-success-close{',
        'background:transparent;border:1px solid rgba(255,255,255,0.18);',
        'color:var(--gray-light,#b8cae8);',
        'padding:0.65rem 1.8rem;border-radius:7px;',
        "font-family:'Barlow',sans-serif;",
        'font-weight:700;font-size:0.85rem;letter-spacing:0.05em;',
        'cursor:pointer;transition:border-color 0.2s,color 0.2s;min-height:46px;',
      '}',
      '.fme-success-close:hover{border-color:rgba(255,255,255,0.5);color:var(--white,#eef2ff);}',

      // Loading
      '.fme-loading{text-align:center;padding:2rem;color:var(--gray,#7a8fb5);font-size:0.9rem;}',

      // Success close row
      '.fme-success-hd{display:flex;justify-content:flex-end;margin-bottom:1rem;}',

      // Mobile
      '@media(max-width:560px){.fme-card{padding:1.4rem 1.2rem;max-height:95vh;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── MODAL DOM ────────────────────────────────────────────────────────
  function _getOrCreate() {
    var el = document.getElementById(_OVERLAY_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = _OVERLAY_ID;
    el.innerHTML = '<div class="fme-card" id="fme-card"></div>';
    document.body.appendChild(el);

    // Click outside card to close
    el.addEventListener('click', function(e) {
      if (e.target === el) _close();
    });

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') _close();
    });

    return el;
  }

  function _card() { return document.getElementById('fme-card'); }

  // ── OPEN ─────────────────────────────────────────────────────────────
  async function openFormModal(formKey, sourcePage) {
    _sourcePage = sourcePage || 'unknown';
    _injectStyles();
    var overlay = _getOrCreate();

    // Show loading state immediately
    var card = _card();
    card.innerHTML = '<p class="fme-loading">Laddar&#8230;</p>';
    overlay.classList.add('fme-open');
    document.body.style.overflow = 'hidden';

    var client = _client();
    if (!client) {
      card.innerHTML = '<p class="fme-loading">Fel: Supabase inte initialiserat. Ladda sidan igen.</p>';
      return;
    }

    var res = await client.from('form_definitions').select('*').eq('key', formKey).single();
    if (res.error || !res.data) {
      _close();
      if (global.showToast) global.showToast('Formuläret kunde inte laddas.');
      else console.error('[form-modal] form_definitions not found for key:', formKey, res.error);
      return;
    }

    _currentDef = res.data;
    _render();
  }

  // ── RENDER FORM ──────────────────────────────────────────────────────
  function _render() {
    var def     = _currentDef;
    var fields  = Array.isArray(def.fields) ? def.fields : [];
    var card    = _card();

    var subtitleHtml = def.modal_subtitle
      ? '<p class="fme-subtitle">' + _esc(def.modal_subtitle) + '</p>'
      : '';

    var fieldsHtml = fields.map(function(f) { return _fieldHtml(f); }).join('');

    card.innerHTML =
      '<div class="fme-header">' +
        '<h2 class="fme-title">' + _esc(def.modal_title || '') + '</h2>' +
        '<button class="fme-close-btn" type="button" aria-label="St&#228;ng" onclick="window.openFormModal._closeModal()">&#x2715;</button>' +
      '</div>' +
      subtitleHtml +
      '<div class="fme-error-msg" id="fme-err"></div>' +
      '<div class="fme-fields">' + fieldsHtml + '</div>' +
      '<button class="fme-submit-btn" id="fme-submit" type="button" onclick="window.openFormModal._doSubmit()">' +
        _esc(def.submit_button_text || 'Skicka') +
      '</button>';
  }

  function _fieldHtml(field) {
    var id      = 'fme-f-' + _esc(field.name);
    var reqAttr = field.required ? ' required' : '';
    var reqMark = field.required ? ' <span class="fme-req" aria-hidden="true">*</span>' : '';
    var label   = '<label for="' + id + '">' + _esc(field.label) + reqMark + '</label>';
    var input;

    if (field.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + _esc(field.name) + '"' + reqAttr + '></textarea>';
    } else if (field.type === 'select') {
      var opts = '<option value="">Välj&#8230;</option>' +
        (field.options || []).map(function(o) {
          return '<option value="' + _esc(o) + '">' + _esc(o) + '</option>';
        }).join('');
      input = '<select id="' + id + '" name="' + _esc(field.name) + '"' + reqAttr + '>' + opts + '</select>';
    } else {
      var type = ['text','email','tel'].indexOf(field.type) !== -1 ? field.type : 'text';
      input = '<input type="' + type + '" id="' + id + '" name="' + _esc(field.name) + '" autocomplete="off"' + reqAttr + '>';
    }

    return '<div class="fme-field">' + label + input + '</div>';
  }

  // ── SUBMIT ───────────────────────────────────────────────────────────
  async function _doSubmit() {
    var def    = _currentDef;
    if (!def) return;
    var fields = Array.isArray(def.fields) ? def.fields : [];

    // Clear previous invalid states
    document.querySelectorAll('#fme-card .fme-invalid').forEach(function(el) {
      el.classList.remove('fme-invalid');
    });
    _hideErr();

    // Collect + validate
    var data    = {};
    var missing = [];

    fields.forEach(function(field) {
      var el  = document.getElementById('fme-f-' + field.name);
      if (!el) return;
      var val = el.value.trim();
      data[field.name] = val;
      if (field.required && !val) {
        missing.push(field.label);
        el.classList.add('fme-invalid');
      }
    });

    if (missing.length > 0) {
      _showErr('Vänligen fyll i: ' + missing.join(', '));
      return;
    }

    // Disable button
    var btn = document.getElementById('fme-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Skickar&#8230;'; }

    var client = _client();
    var res = await client.from('form_submissions').insert({
      form_key:    def.key,
      data:        data,
      source_page: _sourcePage
    });

    if (res.error) {
      _showErr('Något gick fel. Försök igen eller kontakta oss direkt via e-post.');
      if (btn) { btn.disabled = false; btn.textContent = def.submit_button_text || 'Skicka'; }
      return;
    }

    // ── EMAIL NOTIFICATION ───────────────────────────────────────────────
    // Fired after a confirmed DB insert. A failed email send is logged but
    // does NOT block the user-facing success message — the submission is already saved.
    var templateIdToUse = def.emailjs_template_id || GENERIC_FORM_EMAIL_TEMPLATE;
    var emailParams = {
      name:          data.name          || 'Ej angivet',
      email:         data.email         || 'Ej angivet',
      phone:         data.phone         || 'Ej angivet',
      use_case:      data.use_case      || '',
      current_specs: data.current_specs || '',
      budget_range:  data.budget_range  || '',
      problem:       data.problem       || '',
      wishes:        data.wishes        || '',
      form_title:    def.modal_title    || def.key
    };
    try {
      await emailjs.send('service_asyd1jf', templateIdToUse, emailParams);
    } catch (emailErr) {
      console.log('Email notification failed (submission saved):', emailErr);
    }

    _renderSuccess();
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────
  function _renderSuccess() {
    var def = _currentDef;
    var msg = (def && def.success_message) ? def.success_message : 'Tack! Vi återkommer inom kort.';
    var card = _card();
    card.innerHTML =
      '<div class="fme-success-hd">' +
        '<button class="fme-close-btn" type="button" aria-label="St&#228;ng" onclick="window.openFormModal._closeModal()">&#x2715;</button>' +
      '</div>' +
      '<div class="fme-success">' +
        '<div class="fme-success-icon">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
            '<polyline points="22 4 12 14.01 9 11.01"/>' +
          '</svg>' +
        '</div>' +
        '<p class="fme-success-msg">' + _esc(msg) + '</p>' +
        '<button class="fme-success-close" type="button" onclick="window.openFormModal._closeModal()">St&#228;ng</button>' +
      '</div>';
  }

  // ── ERROR HELPERS ────────────────────────────────────────────────────
  function _showErr(msg) {
    var el = document.getElementById('fme-err');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function _hideErr() {
    var el = document.getElementById('fme-err');
    if (el) el.style.display = 'none';
  }

  // ── CLOSE ────────────────────────────────────────────────────────────
  function _close() {
    var overlay = document.getElementById(_OVERLAY_ID);
    if (overlay) overlay.classList.remove('fme-open');
    document.body.style.overflow = '';
    _currentDef = null;
  }

  // ── ESCAPE ───────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────
  // Attach close/submit to the primary export so inline onclick handlers can reach them
  openFormModal._closeModal = _close;
  openFormModal._doSubmit   = _doSubmit;

  global.openFormModal = openFormModal;

})(window);
