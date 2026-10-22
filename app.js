/* Kalender Canvas v24 — Supabase Full Sync + Visual Error Handling (aman untuk HP/Android) */

/* ================================================================
   1. KONFIGURASI
   ================================================================ */
const APP_VERSION = 'v28.0';
const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODg0NzMsImV4cCI6MjA4OTY2NDQ3M30.eZPbYTuaDerKL9SOEa4ctkxSlU1PiEAU9l42czgYOyI';
const GCAL_KEY = 'AIzaSyC1l9UXl2evZOf4ZSZMEVeZwfZ4mFK6EW0';
const GCAL_ID = 'id.indonesian#holiday@group.v.calendar.google.com';
const SESSION_KEY = 'kalender_session';     // { token, mainId, name }
const CACHE_KEY = 'kalender_canvas_app_data';
let session = null;                         // sesi login aktif
const DEADLINE_LOOKAHEAD_MONTHS = 6;        // Deadline muncul sekian bulan sebelum jatuh tempo

let supabaseClient = null;
let syncState = 'loading';        // loading | ok | error | local
let lastSyncAt = 0;
let lastSyncLabel = 'belum pernah';

/* ================================================================
   2. SISTEM LOG VISUAL (bisa dibaca langsung di layar HP)
   ================================================================ */
const LOG = [];
const LOG_MAX = 250;
let _inLog = false;

function nowTime() { return new Date().toLocaleTimeString('id-ID', { hour12: false }); }

function textify(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Error) return errText(v);
  try { return JSON.stringify(v); } catch (e) { return Object.prototype.toString.call(v); }
}

/* Ubah error (termasuk error Supabase / fetch) menjadi teks yang bisa dibaca manusia */
function errText(e) {
  if (e === null || e === undefined) return '(tanpa pesan error)';
  if (typeof e === 'string') return e;
  if (typeof e !== 'object') return String(e);

  const parts = [];
  ['message', 'details', 'hint', 'code', 'status', 'statusText', 'name'].forEach(k => {
    const val = e[k];
    if (val !== undefined && val !== null && val !== '') parts.push(k + ': ' + val);
  });
  if (e.stack && typeof e.stack === 'string') {
    const first = e.stack.split('\n').slice(0, 3).join(' <- ');
    parts.push('lokasi: ' + first);
  }
  if (!parts.length) {
    try { return JSON.stringify(e); } catch (x) { return Object.prototype.toString.call(e); }
  }
  let out = parts.join(' | ');
  const msg = String(e.message || '');
  if (/Failed to fetch|NetworkError|Load failed|ERR_/i.test(msg)) {
    out += '\n→ Kemungkinan: tidak ada koneksi internet, koneksi diblokir, atau alamat Supabase salah.';
  }
  return out;
}

function logPush(kind, msg, detail) {
  if (_inLog) return null;
  _inLog = true;
  try {
    const entry = {
      t: new Date(),
      kind: kind,
      msg: textify(msg),
      detail: detail === undefined || detail === null || detail === '' ? '' : textify(detail)
    };
    LOG.push(entry);
    while (LOG.length > LOG_MAX) LOG.shift();

    if (kind === 'ERROR') showDiagPanel(
      '❌ ' + entry.msg,
      (entry.detail ? entry.detail + '\n' : '') + 'Waktu: ' + entry.t.toLocaleString('id-ID'),
      'error'
    );

    renderLogList();
    updateStatusPill();
    return entry;
  } finally {
    _inLog = false;
  }
}
const logInfo = (m, d) => logPush('INFO', m, d);
const logOk   = (m, d) => logPush('OK',   m, d);
const logWarn = (m, d) => logPush('WARN', m, d);
const logErr  = (m, d) => logPush('ERROR', m, d);

/* Tangkap SEMUA error runtime supaya tidak mati diam-diam di HP */
window.addEventListener('error', function (e) {
  logErr('Error runtime: ' + (e.message || 'tidak diketahui'),
    (e.filename || 'berkas tak diketahui') + ' baris ' + (e.lineno || '?') + (e.error && e.error.stack ? '\n' + e.error.stack.split('\n').slice(0, 3).join('\n') : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  logErr('Promise gagal tanpa penanganan', errText(e.reason));
});

/* Semua console.error/warn dari kode lain (dan pustaka) ikut muncul di panel visual */
(function hookConsole() {
  const ce = console.error.bind(console);
  const cw = console.warn.bind(console);
  console.error = function () {
    const args = Array.prototype.slice.call(arguments);
    ce.apply(null, args);
    const first = args[0];
    if (String(first).indexOf('Error runtime:') === 0) return;
    logPush('ERROR', args.map(textify).join(' '));
  };
  console.warn = function () {
    const args = Array.prototype.slice.call(arguments);
    cw.apply(null, args);
    logPush('WARN', args.map(textify).join(' '));
  };
})();

/* ---- Panel error melayang (terbaca di HP) ---- */
let lastDiagText = '';
function showDiagPanel(title, body, kind) {
  const panel = document.getElementById('diag-panel');
  const t = document.getElementById('diag-panel-title');
  const b = document.getElementById('diag-panel-body');
  if (!panel || !t || !b) return;
  lastDiagText = title + '\n' + body;
  t.textContent = title;
  b.textContent = body;
  panel.classList.remove('warn', 'ok');
  if (kind === 'warn') panel.classList.add('warn');
  if (kind === 'ok') panel.classList.add('ok');
  panel.style.display = 'block';
  panel.scrollTop = 0;
}
function hideDiagPanel() {
  const panel = document.getElementById('diag-panel');
  if (panel) panel.style.display = 'none';
}
function copyDiagText() {
  copyText(lastDiagText || 'Tidak ada pesan.', 'Pesan error dikopi ke clipboard.');
}

function copyText(text, okMsg) {
  const done = () => logInfo(okMsg || 'Teks dikopi.');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      return;
    }
  } catch (e) {}
  fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch (e) {
    logWarn('Gagal mengopi otomatis. Salin manual dari kotak log.', errText(e));
  }
}

function copyLogToClipboard() {
  if (!LOG.length) { logInfo('Log masih kosong.'); return; }
  const txt = LOG.map(e => '[' + e.t.toLocaleString('id-ID') + '] ' + e.kind + ' — ' + e.msg + (e.detail ? '\n    ' + e.detail : '')).join('\n');
  copyText('Kalender Canvas ' + APP_VERSION + ' — Log\n' + txt, 'Log (' + LOG.length + ' baris) dikopi ke clipboard.');
}
function clearLog() {
  LOG.length = 0;
  hideDiagPanel();
  logInfo('Log dibersihkan.');
  renderLogList();
}

function renderLogList() {
  const box = document.getElementById('log-list');
  if (!box) return;
  if (!LOG.length) {
    box.innerHTML = '<div class="log-row k-INFO">Belum ada catatan log. Aktivitas sinkronisasi akan muncul di sini.</div>';
    return;
  }
  let html = '';
  const start = Math.max(0, LOG.length - 80);
  for (let i = start; i < LOG.length; i++) {
    const e = LOG[i];
    html += '<div class="log-row k-' + e.kind + '">' +
      '<span class="lr-time">' + e.t.toLocaleTimeString('id-ID', { hour12: false }) + '</span> ' +
      '<b>' + e.kind + '</b> — ' + escapeHtml(e.msg) +
      (e.detail ? '<span class="lr-detail">' + escapeHtml(e.detail) + '</span>' : '') +
      '</div>';
  }
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

/* ---- Indikator status sinkronisasi ---- */
function setSync(state, label) {
  syncState = state;
  if (label) lastSyncLabel = label;
  updateStatusPill();
}
function updateStatusPill() {
  const pill = document.getElementById('status-pill');
  const txt = document.getElementById('status-pill-text');
  if (!pill || !txt) return;
  const errCount = LOG.filter(e => e.kind === 'ERROR').length;
  let cls = 'st-load', label = 'Memuat…';
  if (syncState === 'ok') { cls = 'st-ok'; label = 'Sinkron'; }
  else if (syncState === 'error') { cls = 'st-err'; label = 'Gagal'; }
  else if (syncState === 'local') { cls = 'st-local'; label = 'Mode Lokal'; }
  else if (syncState === 'loading') { cls = 'st-load'; label = 'Menyinkron…'; }
  if (errCount > 0 && syncState !== 'loading') label += ' (' + errCount + ')';
  pill.className = 'status-pill ' + cls;
  txt.textContent = label;
}

/* ================================================================
   3. INISIALISASI SUPABASE + LAPISAN AKSES DATA
   ================================================================ */
function sdkReady() {
  return !!(window.supabase && typeof window.supabase.createClient === 'function');
}

/* Token sesi dikirim sebagai header x-cal-token pada setiap request (dipakai kebijakan RLS ketat, bila diaktifkan) */
function makeClient(token) {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { 'x-cal-token': token } : {} }
  });
}

async function initSupabase() {
  if (!sdkReady()) {
    logWarn('Pustaka Supabase tidak tersedia di halaman ini — berjalan MODE LOKAL.',
      'Status boot: ' + ((window.__APP_BOOT && window.__APP_BOOT.sdk) || 'tidak diketahui'));
    setSync('local', 'pustaka cloud tidak termuat');
    return false;
  }
  try {
    supabaseClient = makeClient(session ? session.token : null);
    logOk('Klien Supabase dibuat.', SUPABASE_URL);
  } catch (e) {
    logErr('Gagal membuat klien Supabase.', errText(e));
    supabaseClient = null;
    setSync('error', 'klien gagal dibuat');
    return false;
  }
  const test = await sbCall('uji koneksi awal', c => c.from('cal_profiles').select('id').limit(1));
  if (!test.ok) {
    setSync('error', 'koneksi gagal');
    return false;
  }
  return true;
}

/* Semua akses Supabase lewat sini: tidak ada lagi kegagalan yang hilang diam-diam */
async function sbCall(desc, fn) {
  if (!supabaseClient) {
    logWarn('Supabase belum siap — "' + desc + '" dilewati (mode lokal).');
    return { ok: false, offline: true, data: null, error: null };
  }
  try {
    const res = await fn(supabaseClient);
    if (res && res.error) {
      logErr('Supabase gagal — ' + desc, errText(res.error));
      const em = String(res.error.message || '') + ' ' + String(res.error.code || '');
      if (/schema cache|does not exist|PGRST20\d|42703|42P01|22P02/i.test(em)) {
        logWarn('Skema Supabase tidak cocok dengan aplikasi (kolom/tabel/tipe id).',
          'Jalankan kalender_schema.sql di SQL Editor Supabase, lalu muat ulang aplikasi.');
      }
      return { ok: false, offline: false, data: null, error: res.error };
    }
    logOk('Supabase berhasil — ' + desc);
    return { ok: true, offline: false, data: res ? res.data : null, error: null };
  } catch (e) {
    logErr('Supabase error tak terduga — ' + desc, errText(e));
    return { ok: false, offline: false, data: null, error: e };
  }
}

/* ---- Data aplikasi ---- */
let appData = {
  activeProfileId: 'p_default',
  profiles: [
    { id: 'p_default', name: 'Profil A', color: '#60a5fa', notes: {}, synced: false }
  ],
  tags: ['Catatan', 'Penting', 'Ide', 'Deadline', 'Routine']
};

function getActiveProfile() {
  if (!Array.isArray(appData.profiles) || appData.profiles.length === 0) {
    appData.profiles = [{ id: 'p_default', name: 'Profil A', color: '#60a5fa', notes: {}, synced: false }];
    appData.activeProfileId = 'p_default';
  }
  let p = appData.profiles.find(x => x.id === appData.activeProfileId);
  if (!p) { p = appData.profiles[0]; appData.activeProfileId = p.id; }
  if (!p.notes || typeof p.notes !== 'object') p.notes = {};
  return p;
}
function noteCountOf(p) {
  let n = 0;
  Object.values((p && p.notes) || {}).forEach(arr => { if (Array.isArray(arr)) n += arr.length; });
  return n;
}
function totalLocalNotes() {
  let n = 0;
  appData.profiles.forEach(p => { n += noteCountOf(p); });
  return n;
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem('kalender_canvas_app_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      const foreign = parsed && parsed.ownerMainId && session && parsed.ownerMainId !== session.mainId;
      if (foreign) {
        logWarn('Cache lokal milik akun lain — dibuang demi privasi.');
        localStorage.removeItem(CACHE_KEY);
      } else if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
        appData.profiles = parsed.profiles;
        appData.activeProfileId = parsed.activeProfileId || parsed.profiles[0].id;
        if (Array.isArray(parsed.tags) && parsed.tags.length) appData.tags = parsed.tags;
        logInfo('Cache lokal dibaca: ' + appData.profiles.length + ' profil, ' + totalLocalNotes() + ' catatan.');
      }
    }
  } catch (e) {
    logWarn('Cache lokal tidak bisa dibaca.', errText(e));
  }
  getActiveProfile();
}
function saveLocalCache() {
  if (session) appData.ownerMainId = session.mainId;
  try {
    localStorage.setItem('kalender_canvas_app_data', JSON.stringify(appData));
  } catch (e) {
    logWarn('Gagal menyimpan cache lokal (penyimpanan HP penuh?).', errText(e));
  }
}

/* ---- Muat profil dari Supabase (cloud jadi sumber kebenaran) ---- */
async function loadProfilesFromSupabase() {
  if (!session || !/^[\w-]+$/.test(session.mainId)) {
    logWarn('Belum login — daftar profil tidak dimuat.');
    return false;
  }
  const mid = session.mainId;
  // Kolom dipilih eksplisit: birth_date sengaja TIDAK pernah diminta/dikirim ke aplikasi
  const r = await sbCall('muat daftar profil', c =>
    c.from('cal_profiles').select('id,name,color,created_at,owner_id,type,is_main')
      .or('id.eq.' + mid + ',owner_id.eq.' + mid).order('created_at', { ascending: true }));
  if (!r.ok) return false;

  const rows = r.data || [];
  if (!rows.length) {
    logWarn('Tidak ada profil untuk akun ini di server.', 'Pastikan baris Main Profile memiliki is_main = true.');
    return false;
  }

  const notesById = {};
  appData.profiles.forEach(p => { notesById[p.id] = p.notes || {}; });

  appData.profiles = rows.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color || '#60a5fa',
    notes: notesById[row.id] || {},
    synced: true,
    ownerId: row.owner_id || null,
    isMain: row.is_main === true || row.type === 'main'
  }));
  appData.profiles.sort((a, b) => (b.isMain - a.isMain));   // Main Profile selalu pertama

  if (!appData.profiles.find(p => p.id === appData.activeProfileId)) {
    appData.activeProfileId = appData.profiles[0].id;
  }
  logInfo('Profil dari server: ' + appData.profiles.length + ' (' + appData.profiles.map(p => p.name).join(', ') + ').');
  return true;
}

/* Simpan baris profil tanpa upsert: kolom id & birth_date tidak boleh diubah oleh klien */
async function saveProfileRow(p, desc) {
  const u = await sbCall(desc + ' (perbarui)', c =>
    c.from('cal_profiles').update({ name: p.name, color: p.color }).eq('id', p.id).select('id'));
  if (!u.ok) return u;
  if (u.data && u.data.length) return u;
  return sbCall(desc + ' (baru)', c =>
    c.from('cal_profiles').insert([{ id: p.id, name: p.name, color: p.color, owner_id: session ? session.mainId : null }]));
}

/* ---- Muat catatan profil aktif ---- */
async function fetchActiveProfileNotes() {
  const p = getActiveProfile();
  const r = await sbCall('muat catatan profil "' + p.name + '"', c =>
    c.from('cal_items').select('*').eq('profile_id', p.id).order('created_at', { ascending: true }));
  if (!r.ok) return false;

  p.notes = {};
  (r.data || []).forEach(item => {
    if (!p.notes[item.date_key]) p.notes[item.date_key] = [];
    p.notes[item.date_key].push({
      id: item.id,
      text: item.text,
      tag: item.tag || 'Catatan',
      done: !!item.done,
      end_date: item.end_date || null,
      routine_meta: item.routine_meta || (item.tag === 'Routine' ? {} : null),
      createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
    });
  });
  logInfo('Catatan "' + p.name + '" dari server: ' + (r.data || []).length + ' item.');
  return true;
}

/* ---- Sinkron penuh: profil + catatan ---- */
async function syncAll(reason) {
  if (!supabaseClient) { setSync('local'); saveLocalCache(); return false; }
  setSync('loading');
  logInfo('Mulai sinkronisasi (' + reason + ')…');
  let ok = false;
  try {
    const okP = await loadProfilesFromSupabase();
    const okN = okP ? await fetchActiveProfileNotes() : false;
    ok = okP && okN;
  } catch (e) {
    logErr('Sinkronisasi gagal total.', errText(e));
    ok = false;
  }
  lastSyncAt = Date.now();
  setSync(ok ? 'ok' : 'error');
  applyThemeColor();
  saveLocalCache();
  render();
  return ok;
}

async function retrySyncNow() {
  hideDiagPanel();
  showDiagPanel('🔄 Sinkronisasi ulang…', 'Sedang menghubungi Supabase…', 'warn');
  const ok = await syncAll('permintaan pengguna');
  if (ok) {
    showDiagPanel('✅ Sinkronisasi Berhasil',
      'Profil & catatan sudah tersimpan di Supabase.\nWaktu: ' + new Date().toLocaleString('id-ID'), 'ok');
    setTimeout(hideDiagPanel, 2500);
  }
  return ok;
}

/* ---- Pastikan profil ada di server sebelum menyimpan catatan (cegah error foreign key) ---- */
async function ensureProfileOnServer(p) {
  if (!supabaseClient || !p) return false;
  if (p.synced) return true;
  const r = await saveProfileRow(p, 'simpan profil "' + p.name + '" ke server');
  if (r.ok) p.synced = true;
  return r.ok;
}

/* ---- Unggah seluruh data lokal (termasuk hasil impor) ke Supabase ---- */
async function pushLocalDataToSupabase() {
  const status = document.getElementById('backup-status');
  if (status) status.textContent = 'Mengunggah data lokal ke Supabase…';

  if (!supabaseClient) {
    logErr('Tidak bisa mengunggah: Supabase belum siap.');
    if (status) status.textContent = 'Gagal: Supabase belum siap (lihat panel error).';
    return;
  }

  let profilOk = 0, itemOk = 0, itemGagal = 0;
  for (const p of appData.profiles) {
    const rp = await saveProfileRow(p, 'unggah profil "' + p.name + '"');
    if (rp.ok) { p.synced = true; profilOk++; } else continue;

    const rows = [];
    Object.entries(p.notes || {}).forEach(([dateKey, arr]) => {
      (arr || []).forEach(n => rows.push({
        id: n.id, profile_id: p.id, date_key: dateKey, text: n.text, tag: n.tag || 'Catatan',
        done: !!n.done, end_date: n.end_date || null, routine_meta: n.routine_meta || null
      }));
    });
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const ri = await sbCall('unggah ' + chunk.length + ' catatan "' + p.name + '"', c =>
        c.from('cal_items').upsert(chunk, { onConflict: 'id' }));
      if (ri.ok) itemOk += chunk.length; else itemGagal += chunk.length;
    }
  }

  saveLocalCache();
  const msg = profilOk + ' profil & ' + itemOk + ' catatan terunggah' + (itemGagal ? (', ' + itemGagal + ' gagal') : '') + '.';
  if (itemGagal) logErr('Sebagian catatan gagal diunggah ke Supabase.', msg);
  else logOk('Unggah data lokal ke Supabase selesai.', msg);
  if (status) status.textContent = msg;
  await syncAll('setelah unggah data lokal');
}

/* ================================================================
   4. PERHITUNGAN KALENDER (Masehi, Hijri, Pasaran)
   ================================================================ */
let state = { y: new Date().getFullYear(), m: new Date().getMonth() };
let selectedDateKey = null;
let HOLIDAYS = {};
let GHOL = {};
const gcalLoaded = new Set();
let HIJRI_START = [];
const gcalDisabled = new Set();   // tahun yang libur tambahannya sudah menyerah dimuat
const gcalAttempts = {};


const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const PASARAN = ['Wage','Kliwon','Legi','Pahing','Pon'];
const HIJRI_MONTHS = ['','Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Syaban','Ramadan','Syawal','Dzulqa\'dah','Dzulhijjah'];

const PALETTES = ['#60a5fa','#34d399','#a78bfa','#fbbf24','#f43f5e','#22d3ee','#fb7185','#f97316'];

function toArabicDigits(num) {
  const digits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).split('').map(d => digits[parseInt(d, 10)] !== undefined ? digits[parseInt(d, 10)] : d).join('');
}
function getJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
function getPasaran(jdn) { return PASARAN[((jdn + 2) % 5 + 5) % 5]; }

function makeFormatter() {
  for (const cal of ['islamic-umalqura', 'islamic-civil']) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
      if (f.resolvedOptions().calendar.indexOf('islamic') === 0) return f;
    } catch (e) {}
  }
  return null;
}
const HIJRI_FMT = makeFormatter();

function intlHijri(y, m, d) {
  if (!HIJRI_FMT) return { d: 0, m: 1, y: 0 };
  try {
    const parts = HIJRI_FMT.formatToParts(new Date(y, m - 1, d, 12));
    const g = t => { const f = parts.find(p => p.type === t); return f ? +f.value : 0; };
    return { d: g('day'), m: g('month'), y: g('year') };
  } catch (e) { return { d: 0, m: 1, y: 0 }; }
}
function getHijri(y, m, d, jdn) {
  let s = null, n = null;
  for (let i = 0; i < HIJRI_START.length; i++) {
    if (HIJRI_START[i].jdn <= jdn) { s = HIJRI_START[i]; n = HIJRI_START[i + 1] || null; }
    else break;
  }
  if (s) {
    const diff = jdn - s.jdn;
    if ((n && jdn < n.jdn) || (!n && diff <= 28)) return { d: diff + 1, m: s.m, y: s.y };
  }
  return intlHijri(y, m, d);
}
function parseHijriData(data) {
  return Object.entries(data)
    .filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .map(([k, v]) => { const [a, b, c] = k.split('-').map(Number); return { jdn: getJDN(a, b, c), y: v[0], m: v[1] }; })
    .sort((a, b) => a.jdn - b.jdn);
}
function dateKeyOf(t) {
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

/* ---- Muat data statis (libur nasional & tabel hijri) dengan error visual ---- */
async function loadStaticData() {
  try {
    const r = await fetch('./holidays.json?v=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status + ' saat mengambil ./holidays.json');
    HOLIDAYS = await r.json();
    try { localStorage.setItem('holidays_cache', JSON.stringify(HOLIDAYS)); } catch (e) {}
    logOk('Data libur nasional dimuat (' + Object.keys(HOLIDAYS).length + ' entri).');
  } catch (e) {
    let pakaiCache = false;
    try {
      const c = localStorage.getItem('holidays_cache');
      if (c) { HOLIDAYS = JSON.parse(c); pakaiCache = true; }
    } catch (x) {}
    if (pakaiCache) logWarn('Gagal memuat holidays.json — memakai cache lokal.', errText(e));
    else logErr('Gagal memuat holidays.json.', errText(e));
  }

  try {
    const r2 = await fetch('./hijri.json?v=' + Date.now());
    if (!r2.ok) throw new Error('HTTP ' + r2.status + ' saat mengambil ./hijri.json');
    const data = await r2.json();
    HIJRI_START = parseHijriData(data);
    try { localStorage.setItem('hijri_cache', JSON.stringify(data)); } catch (e) {}
    logOk('Tabel Hijri dimuat (' + HIJRI_START.length + ' titik acuan).');
  } catch (e) {
    let pakaiCache = false;
    try {
      const c = localStorage.getItem('hijri_cache');
      if (c) { HIJRI_START = parseHijriData(JSON.parse(c)); pakaiCache = true; }
    } catch (x) {}
    if (pakaiCache) logWarn('Gagal memuat hijri.json — memakai cache lokal.', errText(e));
    else logWarn('Gagal memuat hijri.json — memakai perhitungan Intl bawaan HP.', errText(e));
  }
  render();
}

/* ---- Kalender Google (opsional, untuk hari libur tambahan) ---- */
function parseGcal(items) {
  const out = {};
  for (const ev of items || []) {
    if (!ev.start || !ev.start.date) continue;
    const end = new Date(ev.end.date + 'T00:00:00');
    for (let t = new Date(ev.start.date + 'T00:00:00'); t < end; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
      out[dateKeyOf(t)] = ev.summary;
    }
  }
  return out;
}
async function loadGcalYear(y) {
  if (!GCAL_KEY || GCAL_KEY.indexOf('ISI') === 0 || gcalLoaded.has(y) || gcalDisabled.has(y)) return;
  gcalAttempts[y] = (gcalAttempts[y] || 0) + 1;
  if (gcalAttempts[y] > 2) { gcalDisabled.add(y); return; }
  gcalLoaded.add(y);
  const ck = 'gcal_' + y;
  try {
    const c = localStorage.getItem(ck);
    if (c) { Object.assign(GHOL, JSON.parse(c)); render(); }
  } catch (e) {}
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GCAL_ID) + '/events' +
      '?key=' + GCAL_KEY + '&singleEvents=true&orderBy=startTime&maxResults=250' +
      '&timeMin=' + y + '-01-01T00:00:00Z&timeMax=' + (y + 1) + '-01-01T00:00:00Z';
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' dari Google Calendar API');
    const out = parseGcal((await r.json()).items);
    Object.assign(GHOL, out);
    try { localStorage.setItem(ck, JSON.stringify(out)); } catch (e) {}
    logInfo('Libur tambahan Google Calendar ' + y + ' dimuat (' + Object.keys(out).length + ' tanggal).');
    render();
  } catch (e) {
    gcalLoaded.delete(y);
    if (gcalAttempts[y] >= 2) {
      gcalDisabled.add(y);
      logWarn('Libur tambahan Google Calendar dinonaktifkan untuk tahun ' + y + ' setelah 2 percobaan gagal. Daftar libur utama tetap dari holidays.json.',
        errText(e) + (/403|blocked|referer/i.test(String(e && e.message)) ? '\n→ Kunci Google dibatasi domain: fitur ini hanya jalan di alamat resmi aplikasi (GitHub Pages).' : ''));
    } else {
      logWarn('Libur tambahan Google Calendar gagal dimuat (tidak fatal — daftar libur utama tetap dari holidays.json).',
        errText(e) + (/403|blocked|referer/i.test(String(e && e.message)) ? '\n→ Kunci Google dibatasi domain: fitur ini hanya jalan di alamat resmi aplikasi (GitHub Pages).' : ''));
    }
    render();
  }
}

/* ================================================================
   5. RENDER KALENDER
   ================================================================ */
/* ---- util tanggal berbasis kunci 'YYYY-MM-DD' (bebas zona waktu/DST) ---- */
const pad2 = n => String(n).padStart(2, '0');
function keyToParts(k) { const a = String(k).split('-'); return [parseInt(a[0], 10), parseInt(a[1], 10), parseInt(a[2], 10)]; }
function todayKey() { const t = new Date(); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); }
function diffDaysKeys(fromKey, toKey) {
  const a = keyToParts(fromKey), b = keyToParts(toKey);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}
function fmtDayMonth(k, withYear) { const p = keyToParts(k); return p[2] + ' ' + BLN[p[1] - 1] + (withYear ? ' ' + p[0] : ''); }
function fmtRange(a, b) {
  if (a === b) return fmtDayMonth(a, false);
  const p = keyToParts(a), q = keyToParts(b);
  if (p[0] === q[0] && p[1] === q[1]) return p[2] + '–' + q[2] + ' ' + BLN[p[1] - 1];
  if (p[0] === q[0]) return p[2] + ' ' + BLN[p[1] - 1] + ' – ' + q[2] + ' ' + BLN[q[1] - 1];
  return p[2] + ' ' + BLN[p[1] - 1] + ' ' + p[0] + ' – ' + q[2] + ' ' + BLN[q[1] - 1] + ' ' + q[0];
}
function deadlineBadge(key) {
  const diff = diffDaysKeys(todayKey(), key);
  if (diff > 0) return { text: 'H-' + diff, late: false };
  if (diff === 0) return { text: 'Hari ini', late: false };
  return { text: 'Lewat ' + (-diff) + 'h', late: true };
}

/* ---- aturan Routine: rentang start_date s.d. end_date (tanpa end_date = 1 hari) ---- */
function routineEnd(n, key) { return n.end_date || key; }
function inRoutineRange(n, key, dk) { return n.tag === 'Routine' && dk >= key && dk <= routineEnd(n, key); }

function findNote(p, id) {
  let r = null;
  Object.entries((p && p.notes) || {}).forEach(([k, arr]) => (arr || []).forEach(n => { if (n.id === id) r = { n: n, key: k }; }));
  return r;
}

function notesForDate(p, dateKey) {
  const out = [];
  Object.entries((p && p.notes) || {}).forEach(([dKey, arr]) => {
    (arr || []).forEach(n => {
      if (dKey === dateKey || inRoutineRange(n, dKey, dateKey)) out.push(n);
    });
  });
  return out;
}

/* ---- Kotak ringkasan di bawah kalender (urutan & pemisah sesuai spesifikasi) ---- */
function renderSummary(p, monthHolidays, box) {
  if (!box) return;
  const y = state.y, m = state.m;
  const lastD = new Date(y, m + 1, 0).getDate();
  const pre = y + '-' + pad2(m + 1) + '-';
  const monthStart = pre + '01', monthEnd = pre + pad2(lastD);
  const tk = todayKey();
  const penting = [], biasa = [], deadline = [], routine = [];

  Object.entries(p.notes || {}).forEach(([key, arr]) => (arr || []).forEach(n => {
    const tag = n.tag || 'Catatan';
    if (tag === 'Routine') {
      const end = routineEnd(n, key);
      if (key <= monthEnd && end >= monthStart) routine.push({ n: n, key: key, end: end });
    } else if (tag === 'Deadline') {
      const kp = keyToParts(key);
      const gap = (kp[0] * 12 + kp[1] - 1) - (y * 12 + m);   // 0 = bulan ini, >0 = bulan-bulan sebelumnya
      if (gap >= 0 && gap <= DEADLINE_LOOKAHEAD_MONTHS) deadline.push({ n: n, key: key });
    } else if (key.indexOf(pre) === 0) {
      (tag === 'Penting' ? penting : biasa).push({ n: n, key: key });
    }
  }));
  const byDate = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : (a.n.createdAt || 0) - (b.n.createdAt || 0);
  [penting, biasa, deadline, routine].forEach(a => a.sort(byDate));

  const title = (cls, text) => '<div class="info-section-title ' + cls + '"><span>' + text + '</span></div>';
  const sections = [];

  if (monthHolidays.length) {
    let h = title('holiday-title-color', 'Libur Nasional &amp; Cuti') + '<ul class="sum-list">';
    monthHolidays.forEach(x => { h += '<li><span class="date-red">' + x.d + ' ' + BLN[m] + '</span>: ' + escapeHtml(x.desc) + '</li>'; });
    sections.push({ id: 'libur', html: h + '</ul>' });
  }
  if (penting.length) {
    let h = title('sec-penting', 'Catatan Penting') + '<ul class="sum-list">';
    penting.forEach(x => { h += '<li><span class="sec-penting" style="font-weight:700">' + fmtDayMonth(x.key, false) + '</span>: ' + escapeHtml(x.n.text) + '</li>'; });
    sections.push({ id: 'penting', html: h + '</ul>' });
  }
  if (biasa.length) {
    let h = title('sec-biasa', 'Catatan Biasa &amp; Ide') + '<ul class="sum-list">';
    biasa.forEach(x => {
      const ide = x.n.tag === 'Ide' ? ' <span class="note-tag-badge badge-ide" style="font-size:.6rem;padding:1px 6px">Ide</span>' : '';
      h += '<li><span class="sec-biasa" style="font-weight:700">' + fmtDayMonth(x.key, false) + '</span>: ' + escapeHtml(x.n.text) + ide + '</li>';
    });
    sections.push({ id: 'biasa', html: h + '</ul>' });
  }
  if (deadline.length) {
    let h = title('sec-deadline', 'Catatan Deadline') + '<ul class="sum-list">';
    deadline.forEach(x => {
      const b = deadlineBadge(x.key);
      h += '<li><span class="sec-deadline" style="font-weight:700">' + fmtDayMonth(x.key, keyToParts(x.key)[0] !== y) + '</span>: ' +
        escapeHtml(x.n.text) + ' <span class="dl-badge' + (b.late ? ' late' : '') + '">' + b.text + '</span></li>';
    });
    sections.push({ id: 'deadline', html: h + '</ul>' });
  }
  if (routine.length) {
    let h = title('sec-routine', 'Catatan Routine') + '<ul class="sum-list">';
    routine.forEach(x => {
      // checkbox hanya untuk HARI INI, dan hanya jika hari ini ada di dalam rentang routine
      let chk = '';
      if (tk >= x.key && tk <= x.end) {
        const done = !!(x.n.routine_meta && x.n.routine_meta[tk]);
        chk = '<input type="checkbox" class="rt-check" ' + (done ? 'checked' : '') +
          ' onchange="toggleNoteDone(\'' + x.n.id + '\', this.checked, \'' + tk + '\')" /><span class="rt-hint">hari ini</span>';
      }
      h += '<li><span class="sec-routine" style="font-weight:700">' + fmtRange(x.key, x.end) + '</span>: ' + escapeHtml(x.n.text) + chk + '</li>';
    });
    sections.push({ id: 'routine', html: h + '</ul>' });
  }

  if (!sections.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  let out = '';
  sections.forEach((s, i) => {
    if (i > 0) {
      const prev = sections[i - 1].id;
      // sesuai spesifikasi: tidak ada garis pemisah antara Deadline dan Routine
      out += (prev === 'deadline' && s.id === 'routine') ? '<div class="sum-spacer"></div>' : '<div class="info-divider"></div>';
    }
    out += s.html;
  });
  box.innerHTML = out;
  box.style.display = 'block';
}

const DOT_TAGS = ['Catatan', 'Penting', 'Ide', 'Deadline', 'Routine'];

function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  const holidayList = document.getElementById('holiday-list');
  if (!head || !subh || !cal) {
    logErr('Elemen kalender tidak ditemukan di halaman (#big/#small/#cal).');
    return;
  }

  applyThemeColor();
  loadGcalYear(state.y);

  const first = new Date(state.y, state.m, 1);
  const last = new Date(state.y, state.m + 1, 0);
  const lastD = last.getDate();
  const now = new Date();

  head.textContent = BLN[state.m] + ' ' + state.y;

  const h1 = getHijri(state.y, state.m + 1, 1, getJDN(state.y, state.m + 1, 1));
  const h2 = getHijri(state.y, state.m + 1, lastD, getJDN(state.y, state.m + 1, lastD));
  subh.textContent = h1.d + ' ' + HIJRI_MONTHS[h1.m] + ' ' + h1.y + ' H - ' + h2.d + ' ' + HIJRI_MONTHS[h2.m] + ' ' + h2.y + ' H';

  const fd = (first.getDay() + 6) % 7;
  let html = '<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h, i) => {
    let cls = 'd-blue';
    if (i >= 4) cls = 'd-green';
    if (i === 6) cls = 'd-red';
    html += '<div class="' + cls + '">' + h + '</div>';
  });
  html += '</div><div class="grid">';

  for (let i = 0; i < fd; i++) html += '<div class="cell empty"></div>';

  const monthHolidays = [];
  const activeProfile = getActiveProfile();

  for (let d = 1; d <= lastD; d++) {
    const wd = (new Date(state.y, state.m, d).getDay() + 6) % 7;
    const jdn = getJDN(state.y, state.m + 1, d);
    const hj = getHijri(state.y, state.m + 1, d, jdn);
    const ps = getPasaran(jdn);
    const isToday = now.getFullYear() === state.y && now.getMonth() === state.m && now.getDate() === d;
    const dateKey = state.y + '-' + String(state.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');

    // Check if any note on this day is 'Penting'
    const notesArr = notesForDate(activeProfile, dateKey);
    const isPenting = Array.isArray(notesArr) && notesArr.some(n => n.tag === 'Penting');
    const isRoutine = Array.isArray(notesArr) && notesArr.some(n => n.tag === 'Routine');
    const isDeadline = Array.isArray(notesArr) && notesArr.some(n => n.tag === 'Deadline');
    const isIde = Array.isArray(notesArr) && notesArr.some(n => n.tag === 'Ide');

    const holidayDesc = HOLIDAYS[dateKey] || GHOL[dateKey];
    if (holidayDesc) monthHolidays.push({ d: d, desc: holidayDesc });

    let cellCls = 'cell';
    if (isToday) cellCls += ' today';
    if (wd === 6 || holidayDesc) cellCls += ' holiday-cell';
    if (isPenting) cellCls += ' penting-cell';
    if (isRoutine) cellCls += ' routine-cell';
    if (isDeadline) cellCls += ' deadline-cell';
    if (isIde) cellCls += ' ide-cell';

    // Multi-dot: satu titik per kategori yang ada di tanggal ini, warna sesuai kategori
    let dotHtml = '';
    if (Array.isArray(notesArr) && notesArr.length) {
      const present = {};
      notesArr.forEach(n => { present[DOT_TAGS.indexOf(n.tag) !== -1 ? n.tag : 'Catatan'] = true; });
      const dots = DOT_TAGS.filter(t => present[t]).map(t =>
        '<span class="dot dot-' + t.toLowerCase() + '" title="' + t + '" onclick="event.stopPropagation();openDateNotes(\'' + dateKey + '\',\'' + t + '\')"></span>'
      ).join('');
      dotHtml = '<div class="note-indicators">' + dots + '</div>';
    }

    html += '<div class="' + cellCls + '" onclick="openDateNotes(\'' + dateKey + '\')" title="' + d + ' ' + BLN[state.m] + ' ' + state.y + '">' +
      '<div class="h">' + toArabicDigits(hj.d) + '</div>' +
      '<div class="g">' + d + '</div>' +
      '<div class="p">' + ps + '</div>' +
      dotHtml +
      '</div>';
  }

  const trailingEmpty = (7 - ((fd + lastD) % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) html += '<div class="cell empty"></div>';
  html += '</div>';
  cal.innerHTML = html;

  renderSummary(activeProfile, monthHolidays, holidayList);

  renderDrawerQuickProfiles();
}

function prevMonth() { state.m--; if (state.m < 0) { state.m = 11; state.y--; } render(); }
function nextMonth() { state.m++; if (state.m > 11) { state.m = 0; state.y++; } render(); }
function goToday() { const d = new Date(); state.y = d.getFullYear(); state.m = d.getMonth(); render(); }

function applyThemeColor() {
  const p = getActiveProfile();
  document.documentElement.style.setProperty('--profile-color', p.color);
  const headerDot = document.getElementById('header-profile-dot');
  const headerName = document.getElementById('header-profile-name');
  const cardDot = document.getElementById('card-profile-dot');
  const cardName = document.getElementById('card-profile-name');
  const cardNotes = document.getElementById('card-notes-count');
  if (headerDot) headerDot.style.background = p.color;
  if (headerName) headerName.textContent = p.name;
  if (cardDot) cardDot.style.background = p.color;
  if (cardName) cardName.textContent = p.name;
  if (cardNotes) cardNotes.textContent = noteCountOf(p) + ' catatan';
}

/* ================================================================
   6. KANVAS CATATAN PER TANGGAL (dengan rollback bila gagal simpan)
   ================================================================ */
function setNoteFormStatus(text) {
  const el = document.getElementById('note-form-status');
  if (el) el.textContent = text || '';
}

function openDateNotes(dateKey, focusTag) {
  selectedDateKey = dateKey;
  const parts = dateKey.split('-');
  const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);

  const dateObj = new Date(y, m - 1, d);
  const dayName = HARI[dateObj.getDay()];
  const jdn = getJDN(y, m, d);
  const hj = getHijri(y, m, d, jdn);
  const ps = getPasaran(jdn);
  const holidayDesc = HOLIDAYS[dateKey] || GHOL[dateKey];

  const masehiEl = document.getElementById('note-modal-masehi');
  const subEl = document.getElementById('note-modal-sub');
  const profLabel = document.getElementById('note-modal-profile-label');
  const p = getActiveProfile();

  if (masehiEl) masehiEl.textContent = dayName + ', ' + d + ' ' + BLN[m - 1] + ' ' + y;
  if (subEl) {
    let subText = ps + ' • ' + hj.d + ' ' + HIJRI_MONTHS[hj.m] + ' ' + hj.y + ' H';
    if (holidayDesc) subText += ' • (Libur: ' + holidayDesc + ')';
    subEl.textContent = subText;
  }
  if (profLabel) profLabel.textContent = p.name;

  cancelEdit();
  renderNotesList();
  openModal('modal-date-notes');
  if (focusTag) {   // ketuk dot -> sorot catatan kategori itu
    const hits = document.querySelectorAll('#note-items-container .note-item[data-tag="' + focusTag + '"]');
    hits.forEach(el => { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); });
    if (hits[0] && hits[0].scrollIntoView) hits[0].scrollIntoView({ block: 'nearest' });
  }
}

let editingNote = null;   // { id, key } saat form dipakai untuk mengedit

function setCategory(cat) {
  const hid = document.getElementById('selected-note-tag');
  if (hid) hid.value = cat;
  document.querySelectorAll('.btn-category').forEach(b => b.classList.toggle('active', b.textContent.trim() === cat));
  const box = document.getElementById('routine-input-container');
  if (box) box.style.display = (cat === 'Routine') ? 'block' : 'none';
  if (cat === 'Routine') {
    const inp = document.getElementById('input-routine-end-date');
    const startKey = editingNote ? editingNote.key : selectedDateKey;
    if (inp && startKey) inp.min = startKey;
  }
}
function selectCategory(cat) { setCategory(cat); }

function resetNoteForm() {
  editingNote = null;
  const end = document.getElementById('input-routine-end-date');
  if (end) { end.value = ''; end.removeAttribute('min'); }
  setCategory('Catatan');
  const save = document.getElementById('btn-save-note');
  if (save) save.textContent = '+ Simpan';
  const cancel = document.getElementById('btn-cancel-edit');
  if (cancel) cancel.style.display = 'none';
}

function cancelEdit() {
  const wasEditing = !!editingNote;
  resetNoteForm();
  if (wasEditing) { const i = document.getElementById('input-note-text'); if (i) i.value = ''; }
  setNoteFormStatus('');
}

function startEditNote(noteId) {
  const p = getActiveProfile();
  const f = findNote(p, noteId);
  if (!f) return;
  editingNote = { id: noteId, key: f.key };
  const input = document.getElementById('input-note-text');
  if (input) input.value = f.n.text;
  setCategory(f.n.tag || 'Catatan');
  const end = document.getElementById('input-routine-end-date');
  if (end) end.value = (f.n.tag === 'Routine' && f.n.end_date) ? f.n.end_date : '';

  const save = document.getElementById('btn-save-note');
  if (save) {
    save.textContent = 'Simpan Perubahan';
    let cancel = document.getElementById('btn-cancel-edit');
    if (!cancel) {
      cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.id = 'btn-cancel-edit';
      cancel.className = 'btn-secondary';
      cancel.textContent = 'Batal';
      cancel.onclick = cancelEdit;
      save.parentNode.insertBefore(cancel, save);
    }
    cancel.style.display = '';
  }
  setNoteFormStatus('Mengedit catatan — ubah teks atau kategori, lalu simpan.');
  if (input) input.focus();
}
function handleEditNote(noteId) { startEditNote(noteId); }

async function saveEditedNote() {
  const ed = editingNote;
  if (!ed) return;
  const p = getActiveProfile();
  const f = findNote(p, ed.id);
  if (!f) { cancelEdit(); return; }
  const input = document.getElementById('input-note-text');
  const newText = input ? input.value.trim() : '';
  if (!newText) { setNoteFormStatus('Catatan masih kosong.'); return; }
  const hid = document.getElementById('selected-note-tag');
  const tag = (hid && hid.value) || 'Catatan';
  const endEl = document.getElementById('input-routine-end-date');
  const endVal = endEl && endEl.value ? endEl.value : null;
  if (tag === 'Routine') {
    if (!endVal) { setNoteFormStatus('Routine butuh Tanggal Selesai (End Date).'); return; }
    if (endVal < f.key) { setNoteFormStatus('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }
  }

  const n = f.n;
  const backup = { text: n.text, tag: n.tag, end_date: n.end_date, routine_meta: n.routine_meta };
  n.text = newText;
  n.tag = tag;
  n.end_date = (tag === 'Routine') ? endVal : null;
  n.routine_meta = (tag === 'Routine') ? (n.routine_meta || {}) : null;

  resetNoteForm();
  if (input) input.value = '';
  renderNotesList();
  render();

  if (!supabaseClient) {
    saveLocalCache();
    setNoteFormStatus('Perubahan tersimpan di HP saja (mode lokal).');
    return;
  }
  const r = await sbCall('ubah catatan (' + f.key + ')', c =>
    c.from('cal_items').update({ text: n.text, tag: n.tag, end_date: n.end_date, routine_meta: n.routine_meta }).eq('id', n.id));
  if (!r.ok) {
    Object.assign(n, backup);
    renderNotesList();
    render();
    setNoteFormStatus('GAGAL menyimpan perubahan ke cloud — dikembalikan. Lihat panel error.');
    return;
  }
  saveLocalCache();
  setSync('ok');
  setNoteFormStatus('Perubahan tersimpan ✓');
  setTimeout(() => setNoteFormStatus(''), 2500);
}

function getBadgeClass(tag) {
    const mapping = {
        'Catatan': 'badge-catatan',
        'Penting': 'badge-penting',
        'Ide': 'badge-ide',
        'Deadline': 'badge-deadline',
        'Routine': 'badge-routine'
    };
    return mapping[tag] || 'note-tag-badge';
}

function renderNotesList() {
  const container = document.getElementById('note-items-container');
  if (!container || !selectedDateKey) return;
  const p = getActiveProfile();
  const dk = selectedDateKey;

  const rows = [];
  Object.entries(p.notes || {}).forEach(([key, arr]) => (arr || []).forEach(n => {
    if (key === dk || inRoutineRange(n, key, dk)) rows.push({ n: n, key: key });
  }));
  // Penting selalu ter-pin di atas, sisanya urut waktu dibuat
  rows.sort((a, b) => ((b.n.tag === 'Penting') - (a.n.tag === 'Penting')) || ((a.n.createdAt || 0) - (b.n.createdAt || 0)));

  if (!rows.length) {
    container.innerHTML = '<div class="empty-notes-hint">Belum ada catatan pada tanggal ini di ' + escapeHtml(p.name) + '.<br>Gunakan form di bawah untuk menambahkan.</div>';
    return;
  }

  let html = '';
  rows.forEach(({ n, key }) => {
    const tag = n.tag || 'Catatan';
    const isRoutine = tag === 'Routine';
    // Checkbox HANYA untuk Routine dan HANYA jika tanggal yang dibuka ada di dalam rentangnya
    const showCheck = isRoutine && inRoutineRange(n, key, dk);
    const isDone = showCheck && !!(n.routine_meta && n.routine_meta[dk]);
    const checkbox = showCheck
      ? '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="toggleNoteDone(\'' + n.id + '\', this.checked, \'' + dk + '\')" style="width:18px;height:18px;cursor:pointer;accent-color:var(--c-routine);flex-shrink:0" />'
      : '';
    const textStyle = isDone ? 'text-decoration:line-through;opacity:0.6' : '';

    let meta = '<span class="note-tag-badge ' + getBadgeClass(tag) + '">' + escapeHtml(tag) + '</span>';
    if (isRoutine) meta += '<span style="font-size:0.65rem;color:var(--sub)">' + fmtRange(key, routineEnd(n, key)) + '</span>';
    if (tag === 'Deadline') { const b = deadlineBadge(key); meta += '<span class="dl-badge' + (b.late ? ' late' : '') + '">' + b.text + '</span>'; }

    html += '<div class="note-item' + (tag === 'Penting' ? ' is-penting' : '') + '" data-tag="' + escapeHtml(tag) + '">' +
      '<div class="note-item-left">' +
        '<div style="display:flex;align-items:center;gap:8px">' + checkbox +
          '<span class="note-item-text" style="' + textStyle + '">' + escapeHtml(n.text) + '</span></div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + meta + '</div>' +
      '</div>' +
      '<div class="note-item-actions">' +
        '<button class="btn-secondary" onclick="handleEditNote(\'' + n.id + '\')" title="Edit catatan">Edit</button>' +
        '<button class="btn-danger" onclick="handleDeleteNote(\'' + n.id + '\')" title="Hapus catatan">Hapus</button>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;
}

async function handleAddNote(e) {
  e.preventDefault();
  if (editingNote) { return saveEditedNote(); }
  const input = document.getElementById('input-note-text');
  const tagSelect = document.getElementById('select-note-tag');
  const btn = document.getElementById('btn-save-note');
  if (!input || !selectedDateKey) return;

  const text = input.value.trim();
  if (!text) { setNoteFormStatus('Catatan masih kosong.'); return; }

  const tag = document.getElementById('selected-note-tag') ? document.getElementById('selected-note-tag').value : 'Catatan';
  const routineEndDate = document.getElementById('input-routine-end-date') ? document.getElementById('input-routine-end-date').value || null : null;
  const p = getActiveProfile();
  const dateKey = selectedDateKey;
  if (tag === 'Routine') {
    if (!routineEndDate) { setNoteFormStatus('Routine butuh Tanggal Selesai (End Date).'); return; }
    if (routineEndDate < dateKey) { setNoteFormStatus('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }
  }
  const noteId = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const newNote = { 
    id: noteId, 
    text: text, 
    tag: tag, 
    end_date: (tag === 'Routine' ? routineEndDate : null), 
    createdAt: Date.now(),
    routine_meta: (tag === 'Routine' ? {} : null)
  };

  if (!p.notes) p.notes = {};
  if (!Array.isArray(p.notes[dateKey])) p.notes[dateKey] = [];
  p.notes[dateKey].push(newNote);

  // Tampilkan dulu (optimistic UI), lalu simpan ke server
  input.value = '';
  resetNoteForm();
  setNoteFormStatus('Menyimpan ke Supabase…');
  if (btn) btn.disabled = true;
  renderNotesList();
  render();

  if (!supabaseClient) {
    saveLocalCache();
    setNoteFormStatus('Tersimpan di HP saja (mode lokal — cloud tidak aktif).');
    if (btn) btn.disabled = false;
    logWarn('Catatan disimpan lokal saja karena Supabase tidak aktif.');
    return;
  }

  // Tambahkan data baru (v26)
  const itemData = { 
      id: noteId, 
      profile_id: p.id, 
      date_key: dateKey, 
      text: text, 
      tag: tag,
      done: false,
      end_date: newNote.end_date,
      routine_meta: newNote.routine_meta
  };

  await ensureProfileOnServer(p);
  const r = await sbCall('simpan catatan "' + text.slice(0, 24) + '" (' + dateKey + ')', c =>
      c.from('cal_items').insert([itemData]));

  if (!r.ok) {
    // Rollback
    p.notes[dateKey] = p.notes[dateKey].filter(n => n.id !== noteId);
    if (p.notes[dateKey].length === 0) delete p.notes[dateKey];
    renderNotesList();
    render();
    input.value = text;
    setCategory(tag);
    const endBack = document.getElementById('input-routine-end-date'); if (endBack && routineEndDate) endBack.value = routineEndDate;
    setNoteFormStatus('GAGAL disimpan ke cloud. Pesan error ada di panel merah bawah layar.');
    if (btn) btn.disabled = false;
    return;
  }

  setNoteFormStatus('Tersimpan di Supabase ✓');
  if (btn) btn.disabled = false;
  saveLocalCache();
  setSync('ok');
  setTimeout(() => setNoteFormStatus(''), 2500);
}

async function toggleNoteDone(noteId, isDone, dateKeyOverride) {
  const dk = dateKeyOverride || selectedDateKey;
  if (!dk) return;
  const p = getActiveProfile();
  const f = findNote(p, noteId);
  if (!f) return;
  const note = f.n;
  if (note.tag !== 'Routine') return;                       // hanya Routine yang punya checkbox
  if (!inRoutineRange(note, f.key, dk)) {                   // aturan ketat: di luar rentang = tolak
    renderNotesList(); render();
    return;
  }

  // Checkbox bersifat HARIAN: setiap tanggal punya status sendiri di routine_meta[tanggal]
  if (!note.routine_meta) note.routine_meta = {};
  const prev = !!note.routine_meta[dk];
  if (isDone) note.routine_meta[dk] = true; else delete note.routine_meta[dk];
  renderNotesList(); render();

  if (!supabaseClient) { saveLocalCache(); return; }

  const meta = note.routine_meta;
  const r = await sbCall('update centang routine "' + note.text.slice(0, 16) + '" (' + dk + ')', c =>
    c.from('cal_items').update({ routine_meta: meta }).eq('id', noteId));
  if (!r.ok) {
    if (prev) note.routine_meta[dk] = true; else delete note.routine_meta[dk];
    renderNotesList(); render();
    setNoteFormStatus('Gagal update centang di cloud.');
  } else {
    saveLocalCache();
    setSync('ok');
  }
}

async function handleDeleteNote(noteId) {
  const p = getActiveProfile();
  let dateKey = null, removed = null;
  Object.entries(p.notes || {}).forEach(([k, list]) => {
    const f = (list || []).find(n => n.id === noteId);
    if (f) { dateKey = k; removed = f; }
  });
  if (!removed) return;
  const arr = p.notes[dateKey];

  p.notes[dateKey] = arr.filter(n => n.id !== noteId);
  if (p.notes[dateKey].length === 0) delete p.notes[dateKey];
  renderNotesList();
  render();

  if (!supabaseClient) {
    saveLocalCache();
    setNoteFormStatus('Dihapus dari HP saja (mode lokal).');
    return;
  }

  const r = await sbCall('hapus catatan (' + dateKey + ')', c =>
    c.from('cal_items').delete().eq('id', noteId));

  if (!r.ok) {
    // Rollback: kembalikan catatan yang sebenarnya belum terhapus di server
    if (!p.notes[dateKey]) p.notes[dateKey] = [];
    p.notes[dateKey].push(removed);
    renderNotesList();
    render();
    setNoteFormStatus('GAGAL menghapus di cloud — catatan dikembalikan. Lihat panel error.');
    return;
  }
  saveLocalCache();
  setSync('ok');
}

/* ================================================================
   7. DRAWER & MANAJEMEN PROFIL
   ================================================================ */
function toggleDrawer(open) {
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  if (!backdrop || !panel) return;
  if (open) {
    renderDrawerQuickProfiles();
    updateAccountUi();
    applyThemeColor();
    backdrop.classList.add('active');
    panel.classList.add('active');
  } else {
    backdrop.classList.remove('active');
    panel.classList.remove('active');
  }
}

function renderDrawerQuickProfiles() {
  const container = document.getElementById('drawer-quick-profiles');
  if (!container) return;
  let html = '';
  appData.profiles.forEach(p => {
    const isSelected = p.id === appData.activeProfileId;
    html += '<div class="profile-chip' + (isSelected ? ' selected' : '') + '" onclick="switchProfile(\'' + p.id + '\')">' +
      '<div class="profile-chip-left">' +
      '<span class="chip-dot" style="background:' + (p.color || '#60a5fa') + '"></span>' +
      '<span style="font-weight:' + (isSelected ? '700' : '500') + '">' + escapeHtml(p.name) + '</span>' +
      '</div>' +
      '<span style="font-size:0.7rem;color:var(--sub)">' + noteCountOf(p) + ' ctt</span>' +
      '</div>';
  });
  container.innerHTML = html;
}

async function switchProfile(profileId) {
  if (!appData.profiles.find(p => p.id === profileId)) return;
  appData.activeProfileId = profileId;
  applyThemeColor();
  toggleDrawer(false);
  render();
  saveLocalCache();
  if (supabaseClient) {
    setSync('loading');
    const ok = await fetchActiveProfileNotes();
    setSync(ok ? 'ok' : 'error');
  }
  render();
}

function openManageProfilesModal() {
  toggleDrawer(false);
  renderManageProfiles();
  openModal('modal-manage-profiles');
}

function renderManageProfiles() {
  const container = document.getElementById('manage-profiles-list');
  if (!container) return;
  let html = '';
  appData.profiles.forEach(p => {
    const isOnly = appData.profiles.length <= 1 || p.isMain === true;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="chip-dot" style="background:' + (p.color || '#60a5fa') + '"></span>' +
      '<span style="font-weight:600">' + escapeHtml(p.name) + '</span>' +
      (p.isMain ? '<span style="font-size:0.6rem;color:var(--profile-color);border:1px solid var(--profile-color);border-radius:4px;padding:0 5px">Utama</span>' : '') +
      '<span style="font-size:0.65rem;color:var(--sub)">' + noteCountOf(p) + ' ctt' + (p.synced ? ' • ☁️' : ' • ⚠️ lokal') + '</span>' +
      '</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem" onclick="promptRenameProfile(\'' + p.id + '\')">Ubah Nama</button>' +
      (!isOnly ? '<button class="btn-danger" onclick="handleDeleteProfile(\'' + p.id + '\')">Hapus</button>' : '') +
      '</div>' +
      '</div>';
  });
  container.innerHTML = html;
}

function setProfileFormStatus(t) {
  const el = document.getElementById('profile-form-status');
  if (el) el.textContent = t || '';
}

async function handleCreateProfile(e) {
  e.preventDefault();
  const input = document.getElementById('input-new-profile-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  const color = PALETTES[appData.profiles.length % PALETTES.length];
  const newId = 'p_' + Date.now();
  const newProf = { id: newId, name: name, color: color, notes: {}, synced: false, ownerId: session ? session.mainId : null, isMain: false };

  appData.profiles.push(newProf);
  appData.activeProfileId = newId;
  input.value = '';
  setProfileFormStatus('Menyimpan profil ke Supabase…');
  renderManageProfiles();
  applyThemeColor();
  render();

  if (!supabaseClient) {
    saveLocalCache();
    setProfileFormStatus('Profil tersimpan di HP saja (mode lokal).');
    return;
  }

  const r = await sbCall('buat profil "' + name + '"', c =>
    c.from('cal_profiles').insert([{ id: newId, name: name, color: color, owner_id: session ? session.mainId : null }]));

  if (!r.ok) {
    appData.profiles = appData.profiles.filter(p => p.id !== newId);
    appData.activeProfileId = appData.profiles[0].id;
    renderManageProfiles();
    applyThemeColor();
    render();
    setProfileFormStatus('GAGAL membuat profil di cloud — dibatalkan. Lihat panel error.');
    return;
  }

  newProf.synced = true;
  saveLocalCache();
  setSync('ok');
  setProfileFormStatus('Profil "' + name + '" tersimpan di cloud ✓');
  setTimeout(() => setProfileFormStatus(''), 2500);
}

async function promptRenameProfile(id) {
  const p = appData.profiles.find(x => x.id === id);
  if (!p) return;
  const newName = prompt('Masukkan nama baru untuk profil:', p.name);
  if (!newName || !newName.trim() || newName.trim() === p.name) return;

  const oldName = p.name;
  p.name = newName.trim();
  renderManageProfiles();
  applyThemeColor();
  render();

  if (!supabaseClient) { saveLocalCache(); setProfileFormStatus('Nama diubah di HP saja (mode lokal).'); return; }

  const r = await sbCall('ubah nama profil menjadi "' + p.name + '"', c =>
    c.from('cal_profiles').update({ name: p.name }).eq('id', id));

  if (!r.ok) {
    p.name = oldName;
    renderManageProfiles();
    applyThemeColor();
    render();
    setProfileFormStatus('GAGAL mengubah nama di cloud — dikembalikan. Lihat panel error.');
    return;
  }
  saveLocalCache();
  setSync('ok');
  setProfileFormStatus('Nama profil diperbarui di cloud ✓');
}

async function handleDeleteProfile(id) {
  const target = appData.profiles.find(x => x.id === id);
  if (target && target.isMain) {
    alert('Profil Utama tidak bisa dihapus.');
    return;
  }
  if (appData.profiles.length <= 1) {
    alert('Tidak bisa menghapus profil terakhir.');
    return;
  }
  const p = appData.profiles.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Hapus profil "' + p.name + '" beserta seluruh catatannya?')) return;

  const backupProfiles = JSON.parse(JSON.stringify(appData.profiles));
  const backupActive = appData.activeProfileId;

  appData.profiles = appData.profiles.filter(x => x.id !== id);
  if (appData.activeProfileId === id) appData.activeProfileId = appData.profiles[0].id;
  renderManageProfiles();
  applyThemeColor();
  render();

  if (!supabaseClient) { saveLocalCache(); setProfileFormStatus('Dihapus dari HP saja (mode lokal).'); return; }

  const r = await sbCall('hapus profil "' + p.name + '"', c =>
    c.from('cal_profiles').delete().eq('id', id));

  if (!r.ok) {
    appData.profiles = backupProfiles;
    appData.activeProfileId = backupActive;
    renderManageProfiles();
    applyThemeColor();
    render();
    setProfileFormStatus('GAGAL menghapus profil di cloud — dikembalikan. Lihat panel error.');
    return;
  }
  saveLocalCache();
  setSync('ok');
  setProfileFormStatus('Profil dihapus di cloud ✓');
}

/* ================================================================
   8. WARNA TEMA PROFIL
   ================================================================ */
function openThemeModal() {
  toggleDrawer(false);
  const p = getActiveProfile();
  const nameEl = document.getElementById('theme-profile-target-name');
  if (nameEl) nameEl.textContent = p.name;
  const box = document.getElementById('theme-swatches-box');
  if (!box) return;
  let html = '';
  PALETTES.forEach(col => {
    const isSel = (p.color || '').toLowerCase() === col.toLowerCase();
    html += '<div class="swatch' + (isSel ? ' selected' : '') + '" style="background:' + col + ';color:' + col + '" onclick="setProfileColor(\'' + col + '\')"></div>';
  });
  box.innerHTML = html;
  openModal('modal-theme');
}

async function setProfileColor(col) {
  const p = getActiveProfile();
  const oldCol = p.color;
  p.color = col;
  applyThemeColor();
  openThemeModal();
  render();

  if (!supabaseClient) { saveLocalCache(); return; }

  const r = await sbCall('ubah warna profil "' + p.name + '"', c =>
    c.from('cal_profiles').update({ color: col }).eq('id', p.id));

  if (!r.ok) {
    p.color = oldCol;
    applyThemeColor();
    openThemeModal();
    render();
    logWarn('Warna profil dikembalikan karena gagal disimpan di cloud.');
    return;
  }
  saveLocalCache();
  setSync('ok');
}

/* ================================================================
   9. TAGS, PENCARIAN, EKSPOR/IMPOR
   ================================================================ */
function openTagsModal() {
  toggleDrawer(false);
  const container = document.getElementById('tags-list-container');
  if (!container) return;
  let html = '';
  appData.tags.forEach(t => {
    html += '<span class="note-tag-badge" style="font-size:0.8rem;padding:4px 10px">' + escapeHtml(t) + '</span>';
  });
  container.innerHTML = html;
  openModal('modal-tags');
}

function openSearchModal() {
  toggleDrawer(false);
  const input = document.getElementById('input-global-search');
  const results = document.getElementById('search-results-box');
  if (input) input.value = '';
  if (results) results.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Ketik kata kunci untuk mencari di semua profil…</div>';
  openModal('modal-search');
}

function handleGlobalSearch(query) {
  const resultsBox = document.getElementById('search-results-box');
  if (!resultsBox) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    resultsBox.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Ketik kata kunci untuk mencari di semua profil…</div>';
    return;
  }
  const matches = [];
  appData.profiles.forEach(p => {
    Object.entries(p.notes || {}).forEach(([dateKey, notesArr]) => {
      (notesArr || []).forEach(note => {
        if (note.text.toLowerCase().indexOf(q) !== -1 || (note.tag && note.tag.toLowerCase().indexOf(q) !== -1)) {
          matches.push({ profileName: p.name, profileColor: p.color, dateKey: dateKey, text: note.text, tag: note.tag });
        }
      });
    });
  });

  if (!matches.length) {
    resultsBox.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Tidak ditemukan catatan yang cocok.</div>';
    return;
  }

  let html = '';
  matches.forEach(m => {
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;cursor:pointer" onclick="jumpToSearchResult(\'' + m.dateKey + '\')">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;color:var(--sub)">' +
      '<span style="font-weight:700;color:var(--text)">' + m.dateKey + '</span>' +
      '<span style="display:flex;align-items:center;gap:4px">' +
      '<span class="chip-dot" style="background:' + m.profileColor + '"></span>' +
      '<span>' + escapeHtml(m.profileName) + '</span>' +
      '</span></div>' +
      '<div style="font-size:0.85rem">' + escapeHtml(m.text) + '</div>' +
      '</div>';
  });
  resultsBox.innerHTML = html;
}

function jumpToSearchResult(dateKey) {
  closeModal('modal-search');
  const parts = dateKey.split('-');
  state.y = parseInt(parts[0], 10);
  state.m = parseInt(parts[1], 10) - 1;
  render();
  openDateNotes(dateKey);
}

function exportDataJSON() {
  try {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appData, null, 2));
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'kalender-canvas-backup-' + dateStr + '.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
    const st = document.getElementById('backup-status');
    if (st) st.textContent = 'File cadangan diunduh.';
    logOk('Backup JSON dibuat (' + appData.profiles.length + ' profil, ' + totalLocalNotes() + ' catatan).');
  } catch (e) {
    logErr('Gagal membuat file cadangan.', errText(e));
  }
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const st = document.getElementById('backup-status');
  const reader = new FileReader();
  reader.onerror = function () { logErr('Gagal membaca file cadangan.', 'FileReader error'); };
  reader.onload = async function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && Array.isArray(imported.profiles) && imported.profiles.length) {
        appData = imported;
        getActiveProfile();
        saveLocalCache();
        applyThemeColor();
        render();
        closeModal('modal-backup');
        logOk('Data cadangan dipulihkan secara lokal.');
        if (supabaseClient) {
          if (st) st.textContent = 'Data dipulihkan. Mengunggah ke Supabase…';
          await pushLocalDataToSupabase();
        } else if (st) {
          st.textContent = 'Data dipulihkan lokal (cloud tidak aktif).';
        }
      } else {
        logErr('Format file cadangan tidak valid.', 'Properti "profiles" tidak ditemukan.');
        if (st) st.textContent = 'Format file cadangan tidak valid.';
      }
    } catch (err) {
      logErr('Gagal membaca file JSON.', errText(err));
      if (st) st.textContent = 'Gagal membaca file JSON: ' + err.message;
    }
  };
  reader.readAsText(file);
}

/* ================================================================
   10. MODAL, DIAGNOSTIK, DAN UTILITAS
   ================================================================ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function maskedKey() {
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 14) return '(tidak ada / terlalu pendek)';
  return SUPABASE_ANON_KEY.slice(0, 10) + '…' + SUPABASE_ANON_KEY.slice(-4) + ' (' + SUPABASE_ANON_KEY.length + ' karakter)';
}

function renderDiagStatus() {
  const box = document.getElementById('diag-status-box');
  if (!box) return;
  const p = getActiveProfile();
  const serverNotes = noteCountOf(p);
  const rows = [
    ['Versi aplikasi', APP_VERSION],
    ['Pustaka Supabase', sdkReady() ? 'tersedia' : 'TIDAK tersedia'],
    ['Status boot SDK', (window.__APP_BOOT && window.__APP_BOOT.sdk) || 'tidak diketahui'],
    ['Klien terhubung', supabaseClient ? 'ya' : 'belum'],
    ['Alamat server', SUPABASE_URL],
    ['Kunci anon (disamarkan)', maskedKey()],
    ['Status sinkron', syncState],
    ['Sinkron terakhir', lastSyncAt ? new Date(lastSyncAt).toLocaleString('id-ID') : lastSyncLabel],
    ['Profil aktif', p.name + ' (' + p.id + ')' + (p.synced ? ' • tersimpan di cloud' : ' • belum di cloud')],
    ['Jumlah profil', String(appData.profiles.length)],
    ['Catatan profil aktif', String(serverNotes)],
    ['Total catatan (klien)', String(totalLocalNotes())],
    ['Kesalahan tercatat', String(LOG.filter(e => e.kind === 'ERROR').length)],
    ['Penyimpanan lokal', (function () { try { return localStorage.getItem('kalender_canvas_app_data') ? 'ada' : 'kosong'; } catch (e) { return 'tidak bisa diakses'; } })()],
    ['Online (navigator)', navigator.onLine ? 'ya' : 'TIDAK (mode pesawat?)'],
    ['Halaman', location.href]
  ];
  let html = '';
  rows.forEach(r => { html += '<div class="diag-kv"><b>' + escapeHtml(r[0]) + '</b><span>' + escapeHtml(r[1]) + '</span></div>'; });
  box.innerHTML = html;
}

function openDiagnostics() {
  hideDiagPanel();
  renderDiagStatus();
  renderLogList();
  openModal('modal-diagnostics');
}

async function runConnectionTest() {
  const out = document.getElementById('diag-test-result');
  const lines = [];
  const push = t => { lines.push(t); if (out) out.textContent = lines.join('\n'); };
  push('=== TES KONEKSI ' + new Date().toLocaleString('id-ID') + ' ===');
  push('navigator.onLine: ' + navigator.onLine);
  push('SDK Supabase    : ' + (sdkReady() ? 'siap' : 'TIDAK ADA'));
  push('Alamat          : ' + SUPABASE_URL);

  if (!sdkReady()) {
    push('HASIL: GAGAL — pustaka Supabase tidak termuat. Cek koneksi internet lalu muat ulang paksa.');
    logErr('Tes koneksi gagal: pustaka Supabase tidak termuat.');
    renderDiagStatus();
    return;
  }
  if (!supabaseClient) {
    push('Klien belum dibuat — mencoba membuat sekarang…');
    const okInit = await initSupabase();
    push('Inisialisasi klien: ' + (okInit ? 'berhasil' : 'GAGAL'));
  }
  if (!supabaseClient) { renderDiagStatus(); return; }

  push('Menguji GET cal_profiles …');
  const r1 = await sbCall('tes: baca cal_profiles', c => c.from('cal_profiles').select('id,name,color'));
  push('  hasil   : ' + (r1.ok ? 'BERHASIL' : 'GAGAL'));
  push('  jumlah  : ' + (Array.isArray(r1.data) ? r1.data.length : 0) + ' profil');
  push('  data    : ' + JSON.stringify(r1.data || null).slice(0, 300));
  if (!r1.ok && r1.error) push('  error   : ' + errText(r1.error));

  push('Menguji GET cal_items …');
  const r2 = await sbCall('tes: baca cal_items', c => c.from('cal_items').select('id,date_key').limit(5));
  push('  hasil   : ' + (r2.ok ? 'BERHASIL' : 'GAGAL'));
  push('  data    : ' + JSON.stringify(r2.data || null).slice(0, 300));
  if (!r2.ok && r2.error) push('  error   : ' + errText(r2.error));

  push('Menguji TULIS (insert + hapus baris uji) …');
  const tid = 'p_test_' + Date.now();
  const r3 = await sbCall('tes: tulis cal_profiles', c =>
    c.from('cal_profiles').insert([{ id: tid, name: 'Tes Koneksi', color: '#60a5fa', owner_id: session ? session.mainId : null }]));
  push('  insert  : ' + (r3.ok ? 'BERHASIL' : 'GAGAL'));
  if (!r3.ok && r3.error) push('  error   : ' + errText(r3.error));
  if (r3.ok) {
    const r4 = await sbCall('tes: bersihkan baris uji', c => c.from('cal_profiles').delete().eq('id', tid));
    push('  cleanup : ' + (r4.ok ? 'BERHASIL' : 'GAGAL'));
  }

  const sukses = r1.ok && r2.ok && r3.ok;
  push('');
  push(sukses
    ? 'HASIL AKHIR: ✅ SEMUA BERHASIL — baca & tulis Supabase berfungsi.'
    : 'HASIL AKHIR: ❌ ADA YANG GAGAL — lihat baris error di atas (biasanya kunci/internet/aturan RLS).');

  if (sukses) { setSync('ok'); lastSyncAt = Date.now(); }
  else setSync('error');
  renderDiagStatus();
  renderLogList();
}

/* ---- Akses cepat via pil status ---- */
function bindStatusPill() {
  const pill = document.getElementById('status-pill');
  if (pill) pill.addEventListener('click', openDiagnostics);
}

/* ---- Deteksi kembali ke depan (mis. buka dari HP lain) ---- */
let lastVisibleSync = 0;
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && supabaseClient && Date.now() - lastVisibleSync > 15000) {
    lastVisibleSync = Date.now();
    syncAll('aplikasi kembali aktif');
  }
});

/* ================================================================
   11. INISIALISASI AMAN (semua klik dipasang dengan pemeriksa null)
   ================================================================ */
function bind(id, handler) {
  const el = document.getElementById(id);
  if (!el) { logWarn('Elemen "' + id + '" tidak ditemukan — aksi ini tidak dipasang.'); return; }
  el.addEventListener('click', handler);
}

function bindAllUi() {
  bind('prev', prevMonth);
  bind('next', nextMonth);
  bind('today', goToday);
  bind('btn-profile-menu', () => toggleDrawer(true));
  bind('btn-close-drawer', () => toggleDrawer(false));
  bind('drawer-backdrop', () => toggleDrawer(false));
  bind('menu-btn-manage-profiles', openManageProfilesModal);
  bind('menu-btn-backup', () => { toggleDrawer(false); openModal('modal-backup'); });
  bind('menu-btn-theme', openThemeModal);
  bind('menu-btn-tags', openTagsModal);
  bind('menu-btn-search', openSearchModal);
  bind('menu-btn-diagnostics', () => { toggleDrawer(false); openDiagnostics(); });
  bind('menu-btn-hardreload', () => {
    toggleDrawer(false);
    logInfo('Muat ulang paksa dijalankan (melewati cache).');
    setTimeout(() => { location.replace(location.pathname + '?r=' + Date.now()); }, 300);
  });
  bind('menu-btn-help', () => { toggleDrawer(false); openModal('modal-help'); });
  bind('menu-btn-about', () => { toggleDrawer(false); openModal('modal-about'); });
  bind('menu-btn-logout', handleLogout);
  bindStatusPill();

  const form = document.getElementById('form-add-note');
  if (form) form.addEventListener('submit', handleAddNote);

  const touchArea = document.getElementById('touch-area');
  if (touchArea) {
    let touchStartX = 0;
    touchArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    touchArea.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) > 60) { if (dx < 0) nextMonth(); else prevMonth(); }
    }, { passive: true });
  }

  window.addEventListener('online', () => { logInfo('Koneksi internet kembali terdeteksi.'); if (supabaseClient) syncAll('koneksi kembali'); });
  window.addEventListener('offline', () => { logWarn('Tidak ada koneksi internet (mode offline).'); setSync('error', 'offline'); });
}

/* ================================================================
   11. AUTENTIKASI — nama, lalu verifikasi tanggal lahir (DIVERIFIKASI DI SERVER)
   Tanggal lahir tidak pernah dibaca ke aplikasi: server hanya menjawab cocok/tidak.
   ================================================================ */
const auth = { step: 'loading', name: '', picked: null, mode: 'login', busy: false };
const aid = id => document.getElementById(id);

function loadSession() {
  try {
    const r = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (r && r.token && r.mainId) session = r;
  } catch (e) { session = null; }
  return session;
}
function saveSession(x) {
  session = x;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(x)); } catch (e) {}
}
function clearSession() {
  session = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function authSetError(msg) { const e = aid('auth-error'); if (e) e.textContent = msg || ''; }
function authHide() { const scr = aid('auth-screen'); if (scr) scr.style.display = 'none'; }
function authBusy(on) {
  auth.busy = on;
  document.querySelectorAll('#auth-screen button, #auth-screen input').forEach(b => { b.disabled = on; });
}

function authShow(step) {
  auth.step = step;
  const show = (id, on) => { const e = aid(id); if (e) e.style.display = on ? '' : 'none'; };
  show('auth-loading', step === 'loading');
  show('auth-form-name', step === 'name');
  show('auth-step-pick', step === 'pick');
  show('auth-form-birth', step === 'birth');
  const sub = aid('auth-sub');
  if (sub) sub.textContent = ({ loading: 'Memuat…', name: 'Masukkan nama untuk masuk', pick: 'Pilih profilmu', birth: 'Verifikasi tanggal lahir' })[step] || '';
  authSetError('');
  const scr = aid('auth-screen');
  if (scr) scr.style.display = 'flex';
  const focusId = step === 'name' ? 'auth-input-name' : (step === 'birth' ? 'auth-input-birth' : null);
  if (focusId) setTimeout(() => { const i = aid(focusId); if (i && !i.disabled) i.focus(); }, 60);
}

function authReasonText(res) {
  switch (res && res.reason) {
    case 'wrong': return 'Tanggal lahir tidak cocok. Coba lagi.';
    case 'locked': return 'Terlalu banyak percobaan salah. Coba lagi dalam ' + Math.max(1, Math.ceil((res.retry_after_sec || 60) / 60)) + ' menit.';
    case 'no_birth': return 'Profil ini belum punya tanggal lahir terdaftar. Isi kolom birth_date di Supabase lebih dulu.';
    case 'name_taken': return 'Nama itu sudah dipakai Profil Utama lain. Tambahkan inisial atau nama belakang.';
    case 'bad_name': return 'Nama tidak valid (2–40 karakter).';
    case 'bad_birth': return 'Tanggal lahir tidak valid.';
    case 'not_found': return 'Profil tidak ditemukan. Mulai lagi dari awal.';
    default: return 'Verifikasi gagal.';
  }
}
function authNetText(err) {
  if (err && /PGRST202|Could not find the function|does not exist/i.test(errText(err))) {
    return 'Fungsi login belum ada di database. Jalankan kalender_schema.sql di Supabase.';
  }
  return 'Tidak bisa terhubung ke server. Periksa internet, lalu coba lagi.';
}

async function authSubmitName(e) {
  if (e) e.preventDefault();
  if (auth.busy) return;
  const name = (aid('auth-input-name').value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) { authSetError('Nama minimal 2 huruf.'); return; }
  if (!supabaseClient) { authSetError('Masuk membutuhkan koneksi internet dan pustaka cloud.'); return; }
  auth.name = name;
  authBusy(true); authSetError('');
  const r = await sbCall('cari nama profil', c => c.rpc('cal_find_main', { p_name: name }));
  authBusy(false);
  if (!r.ok) { authSetError(authNetText(r.error)); return; }
  const list = Array.isArray(r.data) ? r.data : [];
  if (!list.length) { auth.mode = 'register'; auth.picked = null; authOpenBirth(); return; }
  authRenderCandidates(list);
  authShow('pick');
}

function authRenderCandidates(list) {
  const box = aid('auth-candidates');
  if (!box) return;
  box.textContent = '';
  list.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'auth-cand';
    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = c.color || '#60a5fa';
    const t = document.createElement('span');
    t.textContent = c.name;
    b.appendChild(dot); b.appendChild(t);
    b.onclick = () => { auth.picked = c; auth.mode = 'login'; authOpenBirth(); };
    box.appendChild(b);
  });
}

function authOpenBirth() {
  authShow('birth');
  const hint = aid('auth-birth-hint'), btn = aid('auth-birth-btn'), inp = aid('auth-input-birth');
  if (inp) { inp.value = ''; inp.max = todayKey(); inp.min = '1900-01-01'; }
  if (auth.mode === 'register') {
    if (hint) hint.textContent = 'Nama "' + auth.name + '" belum terdaftar. Masukkan tanggal lahir untuk membuat Profil Utama baru. Tanggal ini dipakai untuk verifikasi setiap kali kamu masuk.';
    if (btn) btn.textContent = 'Buat Profil & Masuk';
  } else {
    if (hint) hint.textContent = 'Verifikasi: masukkan tanggal lahir untuk "' + auth.picked.name + '".';
    if (btn) btn.textContent = 'Masuk';
  }
}

async function authSubmitBirth(e) {
  if (e) e.preventDefault();
  if (auth.busy) return;
  const inp = aid('auth-input-birth');
  const birth = inp ? inp.value : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) { authSetError('Isi tanggal lahir.'); return; }
  if (birth > todayKey() || birth < '1900-01-01') { authSetError('Tanggal lahir tidak valid.'); return; }
  if (!supabaseClient) { authSetError('Masuk membutuhkan koneksi internet dan pustaka cloud.'); return; }

  authBusy(true); authSetError('');
  const r = (auth.mode === 'register')
    ? await sbCall('buat Main Profile baru', c => c.rpc('cal_register_main', { p_name: auth.name, p_birth: birth, p_color: PALETTES[0] }))
    : await sbCall('verifikasi login', c => c.rpc('cal_login', { p_id: auth.picked.id, p_birth: birth }));
  authBusy(false);
  if (inp) inp.value = '';                 // tanggal lahir tidak dibiarkan tersimpan di layar
  if (!r.ok) { authSetError(authNetText(r.error)); return; }
  const res = r.data || {};
  if (res.ok && res.token && res.profile) { await authSuccess(res); return; }
  authSetError(authReasonText(res));
}

async function authSuccess(res) {
  saveSession({ token: res.token, mainId: res.profile.id, name: res.profile.name });
  supabaseClient = makeClient(session.token);
  authHide();
  logOk('Masuk sebagai "' + res.profile.name + '".');
  await enterApp();
}

/* Masuk ke kalender: cache lokal hanya dipakai jika milik akun ini */
async function enterApp() {
  let legacyRaw = null;
  try { legacyRaw = localStorage.getItem(CACHE_KEY); } catch (e) {}
  loadLocalCache();
  if (!appData.profiles.some(p => p.id === session.mainId)) {
    // cache kosong / bukan milik akun ini: mulai dari kerangka bersih
    try {
      if (legacyRaw && !JSON.parse(legacyRaw).ownerMainId && !localStorage.getItem('kalender_cache_legacy')) {
        localStorage.setItem('kalender_cache_legacy', legacyRaw);   // jaring pengaman data lama
      }
    } catch (e) {}
    appData = {
      activeProfileId: session.mainId,
      profiles: [{ id: session.mainId, name: session.name, color: PALETTES[0], notes: {}, synced: true, ownerId: session.mainId, isMain: true }],
      tags: ['Catatan', 'Penting', 'Ide', 'Deadline', 'Routine']
    };
  }
  updateAccountUi();
  applyThemeColor();
  try { render(); } catch (e) { logErr('Gagal render kalender.', errText(e)); }
  if (supabaseClient) await syncAll('masuk akun'); else saveLocalCache();
  updateAccountUi();
  renderDiagStatus();
}

function updateAccountUi() {
  const n = aid('account-name');
  if (n) n.textContent = session ? session.name : '—';
}

/* Keluar: hapus sesi + bersihkan data di perangkat ini (data cloud tetap aman) */
async function handleLogout() {
  toggleDrawer(false);
  let msg = 'Keluar dari akun "' + (session ? session.name : '') + '"?\nData di perangkat ini akan dibersihkan; data di cloud tetap aman.';
  if (syncState !== 'ok') msg += '\n\n⚠️ Status sinkron belum OK — catatan yang belum terunggah akan hilang dari perangkat ini.';
  if (!confirm(msg)) return;
  const tok = session ? session.token : null;
  if (tok && supabaseClient) { try { await sbCall('keluar akun', c => c.rpc('cal_logout', { p_token: tok })); } catch (e) {} }
  resetToLoggedOut();
  authShow('name');
}

function resetToLoggedOut() {
  clearSession();
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
  appData = {
    activeProfileId: 'p_default',
    profiles: [{ id: 'p_default', name: 'Profil A', color: '#60a5fa', notes: {}, synced: false }],
    tags: ['Catatan', 'Penting', 'Ide', 'Deadline', 'Routine']
  };
  selectedDateKey = null;
  supabaseClient = sdkReady() ? makeClient(null) : null;
  document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
  ['cal', 'holiday-list', 'note-items-container'].forEach(id => { const e = aid(id); if (e) e.innerHTML = ''; });
  const ni = aid('auth-input-name'); if (ni) ni.value = '';
  const bi = aid('auth-input-birth'); if (bi) bi.value = '';
  auth.name = ''; auth.picked = null; auth.mode = 'login';
  try { applyThemeColor(); } catch (e) {}
  updateAccountUi();
}

function bindAuthUi() {
  const f1 = aid('auth-form-name'); if (f1) f1.addEventListener('submit', authSubmitName);
  const f2 = aid('auth-form-birth'); if (f2) f2.addEventListener('submit', authSubmitBirth);
  const nb = aid('auth-btn-newprofile'); if (nb) nb.onclick = () => { auth.mode = 'register'; auth.picked = null; authOpenBirth(); };
  const b1 = aid('auth-back-1'); if (b1) b1.onclick = () => authShow('name');
  const b2 = aid('auth-back-2'); if (b2) b2.onclick = () => authShow(auth.mode === 'register' ? 'name' : 'pick');
}

async function initApp() {
  logInfo('Kalender Canvas ' + APP_VERSION + ' mulai dimuat.', 'Halaman: ' + location.href);
  logInfo('Waktu perangkat: ' + new Date().toLocaleString('id-ID'));

  // Error yang tertangkap sebelum app.js jalan (dari index.html)
  try {
    (window.__APP_BOOT && window.__APP_BOOT.errors ? window.__APP_BOOT.errors : []).forEach(e => {
      logErr('Error awal halaman: ' + e.msg);
    });
  } catch (e) {}

  bindAllUi();
  bindAuthUi();
  loadSession();
  authShow('loading');                       // layar tertutup sampai status login jelas

  updateStatusPill();
  loadStaticData();                          // libur + tabel hijri (data publik)

  const siap = await initSupabase();

  if (!session) {
    authShow('name');
    if (!siap) authSetError('Pustaka cloud/koneksi belum siap — masuk membutuhkan internet.');
    renderDiagStatus();
    return;
  }

  // Ada sesi tersimpan di localStorage:
  // JANGAN keluarkan pengguna hanya karena timeout/masalah jaringan.
  // Cukup validasi jika server merespons secara eksplisit.
  if (siap) {
    try {
      const who = await sbCall('cek sesi', c => c.rpc('cal_whoami', { p_token: session.token }));
      // Hanya keluarkan user jika server MENGEMBALIKAN respons resmi ok === false (sesi dicabut di cloud)
      if (who.ok && who.data && who.data.ok === false) {
        logWarn('Sesi dicabut dari server — silakan masuk ulang.');
        resetToLoggedOut();
        authShow('name');
        authSetError('Sesi dicabut dari server. Silakan masuk lagi.');
        return;
      }
      if (who.ok && who.data && who.data.ok && who.data.profile) {
        session.name = who.data.profile.name;
        saveSession(session);
      }
    } catch (e) {
      logWarn('Gagal cek sesi ke cloud (offline/lambat), tetap gunakan sesi lokal.', errText(e));
    }
  }

  // Masuk ke aplikasi dengan sesi lokal yang ada
  authHide();
  await enterApp();
  logInfo('Inisialisasi selesai. Status: ' + syncState + '.');
}

/* Jalankan dengan penangkap error terakhir agar tidak pernah gagal diam-diam */
(function boot() {
  const start = function () {
    initApp().catch(e => {
      logErr('Inisialisasi aplikasi gagal total.', errText(e));
      try { render(); } catch (x) {}
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();