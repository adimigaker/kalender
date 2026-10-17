/* Kalender Canvas v22 - Masehi + Hijriyah (Intl + Kemenag) + Pasaran + Libur + Canvas Multi-Profil */

let state = { y: new Date().getFullYear(), m: new Date().getMonth() };
let selectedDateKey = null; // tanggal yang sedang dibuka di modal catatan
let HOLIDAYS = {};   // manual dari holidays.json (koreksi / tambahan, menang atas Google)
let GHOL = {};       // otomatis dari Google Calendar
const GCAL_KEY = '«redacted:AIza…»';
const GCAL_ID = 'id.indonesian#holiday@group.v.calendar.google.com';
const gcalLoaded = new Set();
let HIJRI_START = []; // koreksi awal bulan Kemenag: [{jdn, y, m}], urut naik

const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const PASARAN = ['Wage','Kliwon','Legi','Pahing','Pon'];
const HIJRI_MONTHS = ['','Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Syaban','Ramadan','Syawal','Dzulqa\'dah','Dzulhijjah'];

const PALETTES = [
  '#60a5fa', // Blue
  '#34d399', // Emerald
  '#a78bfa', // Purple / Violet
  '#fbbf24', // Amber
  '#f43f5e', // Rose
  '#22d3ee', // Cyan
  '#fb7185', // Pink
  '#f97316'  // Orange
];

/* ---------- SISTEM PROFIL & CATATAN (CANVAS) ---------- */
const STORAGE_KEY = 'kalender_canvas_app_data';

let appData = {
  activeProfileId: 'p_default',
  profiles: [
    {
      id: 'p_default',
      name: 'Profil A',
      color: '#60a5fa',
      notes: {} // format: { "YYYY-MM-DD": [ { id, text, tag, createdAt } ] }
    }
  ],
  tags: ['Catatan', 'Penting', 'Ide', 'Deadline', 'Routine']
};

function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        appData = parsed;
      }
    }
  } catch (e) {
    console.error('Gagal membaca data profil lokal:', e);
  }
  // Pastikan active profile valid
  if (!getActiveProfile()) {
    appData.activeProfileId = appData.profiles[0].id;
  }
  applyThemeColor();
}

function saveAppData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error('Gagal menyimpan data aplikasi:', e);
  }
}

function getActiveProfile() {
  return appData.profiles.find(p => p.id === appData.activeProfileId) || appData.profiles[0];
}

function applyThemeColor() {
  const p = getActiveProfile();
  if (p && p.color) {
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

    // Hitung total catatan profil
    let totalNotes = 0;
    Object.values(p.notes || {}).forEach(arr => { if (Array.isArray(arr)) totalNotes += arr.length; });
    if (cardNotes) cardNotes.textContent = `${totalNotes} catatan`;
  }
}

/* ---------- PERHITUNGAN ASTRONOMI & KALENDER ---------- */
function toArabicDigits(num) {
  const digits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).split('').map(d => digits[parseInt(d)] ?? d).join('');
}

function getJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

function getPasaran(jdn) {
  // Kamis 15 Okt 2026 = Kliwon (offset +2)
  return PASARAN[((jdn + 2) % 5 + 5) % 5];
}

function makeFormatter() {
  for (const cal of ['islamic-umalqura', 'islamic-civil']) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
      if (f.resolvedOptions().calendar.startsWith('islamic')) return f;
    } catch (e) {}
  }
  return null;
}
const HIJRI_FMT = makeFormatter();

function intlHijri(y, m, d) {
  if (!HIJRI_FMT) return { d: 0, m: 1, y: 0 };
  const parts = HIJRI_FMT.formatToParts(new Date(y, m - 1, d, 12));
  const g = t => +parts.find(p => p.type === t).value;
  return { d: g('day'), m: g('month'), y: g('year') };
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

function fetchJSON(url, cacheKey) {
  try { const c = localStorage.getItem(cacheKey); if (c) var cached = JSON.parse(c); } catch (e) {}
  const live = fetch(url + '?v=' + Date.now())
    .then(r => r.json())
    .then(data => { try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {} return data; });
  return { cached, live };
}

function loadData() {
  const h = fetchJSON('./holidays.json', 'holidays_cache');
  const k = fetchJSON('./hijri.json', 'hijri_cache');
  if (h.cached) HOLIDAYS = h.cached;
  if (k.cached) HIJRI_START = parseHijriData(k.cached);
  render();
  h.live.then(d => { HOLIDAYS = d; render(); }).catch(e => console.error('holidays gagal', e));
  k.live.then(d => { HIJRI_START = parseHijriData(d); render(); }).catch(e => console.error('hijri gagal', e));
}

function dateKeyOf(t) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

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
  if (!GCAL_KEY || GCAL_KEY.startsWith('ISI') || gcalLoaded.has(y)) return;
  gcalLoaded.add(y);
  const ck = 'gcal_' + y;
  try { const c = localStorage.getItem(ck); if (c) { Object.assign(GHOL, JSON.parse(c)); render(); } } catch (e) {}
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GCAL_ID)}/events` +
      `?key=${GCAL_KEY}&singleEvents=true&orderBy=startTime&maxResults=250` +
      `&timeMin=${y}-01-01T00:00:00Z&timeMax=${y + 1}-01-01T00:00:00Z`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const out = parseGcal((await r.json()).items);
    Object.assign(GHOL, out);
    try { localStorage.setItem(ck, JSON.stringify(out)); } catch (e) {}
    render();
  } catch (e) {
    gcalLoaded.delete(y);
    console.error('Google Calendar gagal', e);
  }
}

/* ---------- RENDER GRID KALENDER (LOCKED DESIGN 1x1) ---------- */
function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  const holidayList = document.getElementById('holiday-list');
  if (!head || !subh || !cal) return;

  applyThemeColor();
  loadGcalYear(state.y);

  const first = new Date(state.y, state.m, 1);
  const last = new Date(state.y, state.m + 1, 0);
  const lastD = last.getDate();
  const now = new Date();

  head.textContent = `${BLN[state.m]} ${state.y}`;

  const h1 = getHijri(state.y, state.m + 1, 1, getJDN(state.y, state.m + 1, 1));
  const h2 = getHijri(state.y, state.m + 1, lastD, getJDN(state.y, state.m + 1, lastD));
  subh.textContent = `${h1.d} ${HIJRI_MONTHS[h1.m]} ${h1.y} H - ${h2.d} ${HIJRI_MONTHS[h2.m]} ${h2.y} H`;

  const fd = (first.getDay() + 6) % 7;
  let html = '<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h, i) => {
    let cls = 'd-blue';
    if (i >= 4) cls = 'd-green';
    if (i === 6) cls = 'd-red';
    html += `<div class="${cls}">${h}</div>`;
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
    const dateKey = `${state.y}-${String(state.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const holidayDesc = HOLIDAYS[dateKey] || GHOL[dateKey];
    if (holidayDesc) monthHolidays.push({ d, desc: holidayDesc });

    let cellCls = 'cell';
    if (isToday) cellCls += ' today';
    if (wd === 6 || holidayDesc) cellCls += ' holiday-cell';

    // Cek apakah ada catatan di tanggal ini untuk profil aktif
    const hasNotes = activeProfile && activeProfile.notes && Array.isArray(activeProfile.notes[dateKey]) && activeProfile.notes[dateKey].length > 0;
    const dotHtml = hasNotes ? `<div class="note-indicators"><span class="note-badge-dot"></span></div>` : '';

    html += `<div class="${cellCls}" onclick="openDateNotes('${dateKey}')" title="${d} ${BLN[state.m]} ${state.y} - Klik untuk catatan">` +
      `<div class="h">${toArabicDigits(hj.d)}</div>` +
      `<div class="g">${d}</div>` +
      `<div class="p">${ps}</div>` +
      dotHtml +
      `</div>`;
  }

  const trailingEmpty = (7 - ((fd + lastD) % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) html += '<div class="cell empty"></div>';
  html += '</div>';
  cal.innerHTML = html;

  if (holidayList) {
    // Kumpulkan juga catatan profil aktif untuk bulan ini (state.y, state.m)
    const monthUserNotes = [];
    if (activeProfile && activeProfile.notes) {
      for (let d = 1; d <= lastD; d++) {
        const dateKey = `${state.y}-${String(state.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const notesArr = activeProfile.notes[dateKey];
        if (Array.isArray(notesArr) && notesArr.length > 0) {
          notesArr.forEach(n => {
            monthUserNotes.push({ d, text: n.text, tag: n.tag || 'Catatan' });
          });
        }
      }
    }

    let hasContent = false;
    let containerHtml = '';

    // Bagian Libur Nasional & Cuti (Warna Merah)
    if (monthHolidays.length > 0) {
      hasContent = true;
      containerHtml += `<div class="info-section-title holiday-title-color"><span>Libur Nasional & Cuti</span></div><ul>`;
      monthHolidays.forEach(h => {
        containerHtml += `<li><span class="date-red">${h.d} ${BLN[state.m]}</span>: ${escapeHtml(h.desc)}</li>`;
      });
      containerHtml += `</ul>`;
    }

    // Jika ada catatan pengguna di bulan ini, tampilkan dengan divider dan warna biru
    if (monthUserNotes.length > 0) {
      if (hasContent) {
        containerHtml += `<div class="info-divider"></div>`;
      }
      hasContent = true;
      containerHtml += `<div class="info-section-title user-title-color"><span>Catatan ${escapeHtml(activeProfile.name)}</span></div><ul>`;
      monthUserNotes.forEach(note => {
        containerHtml += `<li><span class="date-blue">${note.d} ${BLN[state.m]}</span>: ${escapeHtml(note.text)} <span style="font-size:0.65rem;color:var(--sub)">[${escapeHtml(note.tag)}]</span></li>`;
      });
      containerHtml += `</ul>`;
    }

    if (hasContent) {
      holidayList.innerHTML = containerHtml;
      holidayList.style.display = 'block';
    } else {
      holidayList.innerHTML = '';
      holidayList.style.display = 'none';
    }
  }

  renderDrawerQuickProfiles();
}

function prevMonth() { state.m--; if (state.m < 0) { state.m = 11; state.y--; } render(); }
function nextMonth() { state.m++; if (state.m > 11) { state.m = 0; state.y++; } render(); }
function goToday() { const d = new Date(); state.y = d.getFullYear(); state.m = d.getMonth(); render(); }

/* ---------- KANVAS CATATAN PER TANGGAL (MODAL) ---------- */
function openDateNotes(dateKey) {
  selectedDateKey = dateKey;
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  const dateObj = new Date(y, m - 1, d);
  const dayName = HARI[dateObj.getDay()];
  const jdn = getJDN(y, m, d);
  const hj = getHijri(y, m, d, jdn);
  const ps = getPasaran(jdn);
  const holidayDesc = HOLIDAYS[dateKey] || GHOL[dateKey];

  const masehiEl = document.getElementById('note-modal-masehi');
  const subEl = document.getElementById('note-modal-sub');
  const profLabel = document.getElementById('note-modal-profile-label');

  if (masehiEl) masehiEl.textContent = `${dayName}, ${d} ${BLN[m - 1]} ${y}`;
  if (subEl) {
    let subText = `${ps} • ${hj.d} ${HIJRI_MONTHS[hj.m]} ${hj.y} H`;
    if (holidayDesc) subText += ` • (Libur: ${holidayDesc})`;
    subEl.textContent = subText;
  }
  const activeP = getActiveProfile();
  if (profLabel) profLabel.textContent = activeP.name;

  renderNotesList();
  openModal('modal-date-notes');
}

function renderNotesList() {
  const container = document.getElementById('note-items-container');
  if (!container || !selectedDateKey) return;
  const p = getActiveProfile();
  const notes = (p.notes && p.notes[selectedDateKey]) || [];

  if (notes.length === 0) {
    container.innerHTML = `<div class="empty-notes-hint">Belum ada catatan pada tanggal ini di ${p.name}.<br>Gunakan form di bawah untuk menambahkan.</div>`;
    return;
  }

  let html = '';
  notes.forEach(note => {
    html += `
      <div class="note-item">
        <div class="note-item-left">
          <span class="note-item-text">${escapeHtml(note.text)}</span>
          <span class="note-tag-badge">${escapeHtml(note.tag || 'Catatan')}</span>
        </div>
        <button class="btn-danger" onclick="handleDeleteNote('${note.id}')" title="Hapus catatan">Hapus</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function handleAddNote(e) {
  e.preventDefault();
  const input = document.getElementById('input-note-text');
  const tagSelect = document.getElementById('select-note-tag');
  if (!input || !selectedDateKey) return;

  const text = input.value.trim();
  if (!text) return;
  const tag = tagSelect ? tagSelect.value : 'Catatan';

  const p = getActiveProfile();
  if (!p.notes) p.notes = {};
  if (!Array.isArray(p.notes[selectedDateKey])) p.notes[selectedDateKey] = [];

  p.notes[selectedDateKey].push({
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    text: text,
    tag: tag,
    createdAt: Date.now()
  });

  saveAppData();
  input.value = '';
  renderNotesList();
  render(); // update dot indicator di kalender
}

function handleDeleteNote(noteId) {
  if (!selectedDateKey) return;
  const p = getActiveProfile();
  if (!p.notes || !p.notes[selectedDateKey]) return;

  p.notes[selectedDateKey] = p.notes[selectedDateKey].filter(n => n.id !== noteId);
  if (p.notes[selectedDateKey].length === 0) {
    delete p.notes[selectedDateKey];
  }

  saveAppData();
  renderNotesList();
  render();
}

/* ---------- DRAWER & PROFIL SWITCHER ---------- */
function toggleDrawer(open) {
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  if (open) {
    renderDrawerQuickProfiles();
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
    let noteCount = 0;
    Object.values(p.notes || {}).forEach(arr => { if (Array.isArray(arr)) noteCount += arr.length; });

    html += `
      <div class="profile-chip ${isSelected ? 'selected' : ''}" onclick="switchProfile('${p.id}')">
        <div class="profile-chip-left">
          <span class="chip-dot" style="background:${p.color || '#60a5fa'}"></span>
          <span style="font-weight:${isSelected ? '700' : '500'}">${escapeHtml(p.name)}</span>
        </div>
        <span style="font-size:0.7rem;color:var(--sub)">${noteCount} ctt</span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function switchProfile(profileId) {
  const exists = appData.profiles.find(p => p.id === profileId);
  if (!exists) return;
  appData.activeProfileId = profileId;
  saveAppData();
  applyThemeColor();
  render();
  toggleDrawer(false);
}

/* ---------- KELOLA PROFIL (MANAGE PROFILES) ---------- */
function openManageProfilesModal() {
  toggleDrawer(false);
  const container = document.getElementById('manage-profiles-list');
  if (!container) return;

  let html = '';
  appData.profiles.forEach(p => {
    const isOnly = appData.profiles.length <= 1;
    html += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="chip-dot" style="background:${p.color}"></span>
          <span style="font-weight:600">${escapeHtml(p.name)}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem" onclick="promptRenameProfile('${p.id}')">Ubah Nama</button>
          ${!isOnly ? `<button class="btn-danger" onclick="handleDeleteProfile('${p.id}')">Hapus</button>` : ''}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  openModal('modal-manage-profiles');
}

function handleCreateProfile(e) {
  e.preventDefault();
  const input = document.getElementById('input-new-profile-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  // Pilih warna secara acak dari palet
  const colorIndex = appData.profiles.length % PALETTES.length;
  const color = PALETTES[colorIndex];

  const newId = 'p_' + Date.now();
  appData.profiles.push({
    id: newId,
    name: name,
    color: color,
    notes: {}
  });
  appData.activeProfileId = newId;
  saveAppData();

  input.value = '';
  closeModal('modal-manage-profiles');
  render();
}

function promptRenameProfile(id) {
  const p = appData.profiles.find(x => x.id === id);
  if (!p) return;
  const newName = prompt('Masukkan nama baru untuk profil:', p.name);
  if (newName && newName.trim() && newName.trim() !== p.name) {
    p.name = newName.trim();
    saveAppData();
    openManageProfilesModal(); // refresh list
    render();
  }
}

function handleDeleteProfile(id) {
  if (appData.profiles.length <= 1) {
    alert('Tidak bisa menghapus profil terakhir.');
    return;
  }
  const p = appData.profiles.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Hapus profil "${p.name}" beserta seluruh catatannya?`)) return;

  appData.profiles = appData.profiles.filter(x => x.id !== id);
  if (appData.activeProfileId === id) {
    appData.activeProfileId = appData.profiles[0].id;
  }
  saveAppData();
  openManageProfilesModal();
  render();
}

/* ---------- EKSPOR & IMPOR DATA (JSON) ---------- */
function exportDataJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appData, null, 2));
  const dateStr = new Date().toISOString().split('T')[0];
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `kalender-canvas-backup-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && Array.isArray(imported.profiles) && imported.profiles.length > 0) {
        appData = imported;
        if (!getActiveProfile()) appData.activeProfileId = appData.profiles[0].id;
        saveAppData();
        render();
        closeModal('modal-backup');
        alert('Data berhasil dipulihkan!');
      } else {
        alert('Format file cadangan tidak valid.');
      }
    } catch (err) {
      alert('Gagal membaca file JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- WARNA TEMA PROFIL ---------- */
function openThemeModal() {
  toggleDrawer(false);
  const p = getActiveProfile();
  const nameEl = document.getElementById('theme-profile-target-name');
  if (nameEl) nameEl.textContent = p.name;

  const box = document.getElementById('theme-swatches-box');
  if (!box) return;

  let html = '';
  PALETTES.forEach(col => {
    const isSel = p.color.toLowerCase() === col.toLowerCase();
    html += `<div class="swatch ${isSel ? 'selected' : ''}" style="background:${col};color:${col}" onclick="setProfileColor('${col}')"></div>`;
  });
  box.innerHTML = html;
  openModal('modal-theme');
}

function setProfileColor(col) {
  const p = getActiveProfile();
  p.color = col;
  saveAppData();
  applyThemeColor();
  openThemeModal(); // refresh swatches
  render();
}

/* ---------- TAGS & FILTER ---------- */
function openTagsModal() {
  toggleDrawer(false);
  const container = document.getElementById('tags-list-container');
  if (!container) return;
  let html = '';
  appData.tags.forEach(t => {
    html += `<span class="note-tag-badge" style="font-size:0.8rem;padding:4px 10px">${escapeHtml(t)}</span>`;
  });
  container.innerHTML = html;
  openModal('modal-tags');
}

/* ---------- PENCARIAN GLOBAL ---------- */
function openSearchModal() {
  toggleDrawer(false);
  const input = document.getElementById('input-global-search');
  const results = document.getElementById('search-results-box');
  if (input) input.value = '';
  if (results) results.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Ketik kata kunci untuk mencari di semua profil...</div>';
  openModal('modal-search');
}

function handleGlobalSearch(query) {
  const resultsBox = document.getElementById('search-results-box');
  if (!resultsBox) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    resultsBox.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Ketik kata kunci untuk mencari di semua profil...</div>';
    return;
  }

  const matches = [];
  appData.profiles.forEach(p => {
    Object.entries(p.notes || {}).forEach(([dateKey, notesArr]) => {
      notesArr.forEach(note => {
        if (note.text.toLowerCase().includes(q) || (note.tag && note.tag.toLowerCase().includes(q))) {
          matches.push({
            profileName: p.name,
            profileColor: p.color,
            dateKey: dateKey,
            text: note.text,
            tag: note.tag
          });
        }
      });
    });
  });

  if (matches.length === 0) {
    resultsBox.innerHTML = '<div style="font-size:0.75rem;color:var(--sub);text-align:center;padding:12px">Tidak ditemukan catatan yang cocok.</div>';
    return;
  }

  let html = '';
  matches.forEach(m => {
    html += `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;cursor:pointer" onclick="jumpToSearchResult('${m.dateKey}')">
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;color:var(--sub)">
          <span style="font-weight:700;color:var(--text)">${m.dateKey}</span>
          <span style="display:flex;align-items:center;gap:4px">
            <span class="chip-dot" style="background:${m.profileColor}"></span>
            <span>${escapeHtml(m.profileName)}</span>
          </span>
        </div>
        <div style="font-size:0.85rem">${escapeHtml(m.text)}</div>
      </div>
    `;
  });
  resultsBox.innerHTML = html;
}

function jumpToSearchResult(dateKey) {
  closeModal('modal-search');
  const [yStr, mStr] = dateKey.split('-');
  state.y = parseInt(yStr, 10);
  state.m = parseInt(mStr, 10) - 1;
  render();
  openDateNotes(dateKey);
}

/* ---------- MODAL HELPERS ---------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

/* ---------- EVENT LISTENERS & INITIALIZATION ---------- */
document.getElementById('prev').onclick = prevMonth;
document.getElementById('next').onclick = nextMonth;
document.getElementById('today').onclick = goToday;

// Hamburger drawer triggers
document.getElementById('btn-profile-menu').onclick = () => toggleDrawer(true);
document.getElementById('btn-close-drawer').onclick = () => toggleDrawer(false);
document.getElementById('drawer-backdrop').onclick = () => toggleDrawer(false);

// Drawer menu item buttons
document.getElementById('menu-btn-manage-profiles').onclick = openManageProfilesModal;
document.getElementById('menu-btn-backup').onclick = () => { toggleDrawer(false); openModal('modal-backup'); };
document.getElementById('menu-btn-theme').onclick = openThemeModal;
document.getElementById('menu-btn-tags').onclick = openTagsModal;
document.getElementById('menu-btn-search').onclick = openSearchModal;
document.getElementById('menu-btn-help').onclick = () => { toggleDrawer(false); openModal('modal-help'); };
document.getElementById('menu-btn-about').onclick = () => { toggleDrawer(false); openModal('modal-about'); };

// Touch swipe gesture on calendar
let touchStartX = 0;
const touchArea = document.getElementById('touch-area');
if (touchArea) {
  touchArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  touchArea.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 40) dx < 0 ? nextMonth() : prevMonth();
  }, { passive: true });
}

// Start
loadAppData();
loadData();
