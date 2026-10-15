/* Kalender v24 - Masehi + Hijriyah (Intl + koreksi Kemenag) + Pasaran + Libur (Google Calendar + manual) */
let state = { y: new Date().getFullYear(), m: new Date().getMonth() };
let HOLIDAYS = {};   // manual dari holidays.json (koreksi / tambahan, menang atas Google)
let GHOL = {};       // otomatis dari Google Calendar
const GCAL_KEY = 'AIzaSyC1l9UXl2evZOf4ZSZMEVeZwfZ4mFK6EW0';
const GCAL_ID = 'id.indonesian#holiday@group.v.calendar.google.com';
const gcalLoaded = new Set();
let HIJRI_START = []; // koreksi awal bulan Kemenag: [{jdn, y, m}], urut naik

const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN = ['Wage','Kliwon','Legi','Pahing','Pon'];
const HIJRI_MONTHS = ['','Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Syaban','Ramadan','Syawal','Dzulqa\'dah','Dzulhijjah'];

function toArabicDigits(num) {
  const digits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).split('').map(d => digits[parseInt(d)] ?? d).join('');
}

function getJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

function getPasaran(jdn) {
  // Terverifikasi: Kamis 15 Okt 2026 = Kliwon
  return PASARAN[((jdn + 2) % 5 + 5) % 5];
}

/* ---------- HIJRIYAH ---------- */
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
  const parts = HIJRI_FMT.formatToParts(new Date(y, m - 1, d, 12)); // jam 12 siang, aman dari geser zona waktu
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
    // jika awal bulan berikutnya diketahui, pasti valid; jika tidak, percaya sampai hari ke-29
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

/* ---------- LOAD DATA ---------- */
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
  render(); // tampil dulu dari cache / Intl, jangan menunggu jaringan
  h.live.then(d => { HOLIDAYS = d; render(); }).catch(e => console.error('holidays gagal', e));
  k.live.then(d => { HIJRI_START = parseHijriData(d); render(); }).catch(e => console.error('hijri gagal', e));
}


/* ---------- LIBUR DARI GOOGLE CALENDAR ---------- */
function dateKeyOf(t) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function parseGcal(items) {
  const out = {};
  for (const ev of items || []) {
    if (!ev.start || !ev.start.date) continue; // hanya event sehari penuh
    const end = new Date(ev.end.date + 'T00:00:00'); // end.date eksklusif
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
    gcalLoaded.delete(y); // boleh dicoba lagi saat ganti bulan
    console.error('Google Calendar gagal', e);
  }
}

/* ---------- RENDER ---------- */
function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  const holidayList = document.getElementById('holiday-list');
  if (!head || !subh || !cal) return;
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

    html += `<div class="${cellCls}"><div class="h">${toArabicDigits(hj.d)}</div><div class="g">${d}</div><div class="p">${ps}</div></div>`;
  }

  const trailingEmpty = (7 - ((fd + lastD) % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) html += '<div class="cell empty"></div>';
  html += '</div>';
  cal.innerHTML = html;

  if (holidayList) {
    if (monthHolidays.length) {
      let hHtml = '<div class="holiday-title">Libur & Cuti:</div><ul>';
      monthHolidays.forEach(h => { hHtml += `<li><span class="h-date-text">${h.d} ${BLN[state.m]}</span>: ${h.desc}</li>`; });
      holidayList.innerHTML = hHtml + '</ul>';
      holidayList.style.display = 'block';
    } else {
      holidayList.innerHTML = '';
      holidayList.style.display = 'none';
    }
  }
}

function prevMonth() { state.m--; if (state.m < 0) { state.m = 11; state.y--; } render(); }
function nextMonth() { state.m++; if (state.m > 11) { state.m = 0; state.y++; } render(); }
function goToday() { const d = new Date(); state.y = d.getFullYear(); state.m = d.getMonth(); render(); }

document.getElementById('prev').onclick = prevMonth;
document.getElementById('next').onclick = nextMonth;
document.getElementById('today').onclick = goToday;

let touchStartX = 0;
const touchArea = document.getElementById('touch-area');
if (touchArea) {
  touchArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  touchArea.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 40) dx < 0 ? nextMonth() : prevMonth();
  }, { passive: true });
}

loadData();
