/* Kalender v19 - 2026 Hijri sync fix */
let state = {
  y: new Date().getFullYear(),
  m: new Date().getMonth()
};

let HOLIDAYS = {};

const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];
const HIJRI_MONTHS = ['','Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Sya\'ban','Ramadan','Syawal','Dzulqa\'dah','Dzulhijjah'];

function toArabicDigits(num) {
  const digits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return num.toString().split('').map(d => digits[parseInt(d)] || d).join('');
}

function getJDN(y, m, d) {
  let a = Math.floor((14 - m) / 12);
  let y2 = y + 4800 - a;
  let m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

function getPasaran(jdn) {
  let idx = ((jdn + 1) % 5 + 5) % 5;
  return PASARAN[idx];
}

function getExactHijri(y, m, d, jdn) {
  // 2026 Hijri calendar data (authoritative user-provided)
  // Authoritative user-provided data for 2026; do NOT invent for other years
  // For 2027+, fetch from credible external source (e.g., Umm al-Qura / official hijri-date npm lib)
  // If source unavailable, ask user to provide data — do NOT guess
  if (y !== 2026) {
    // Fallback to algorithmic for non-2026
    let days = jdn - 1948439;
    let hy = Math.floor((30 * days + 10646) / 10631);
    function mStart(yr, mo) {
      return 1948439 + (yr - 1) * 354 + Math.floor((3 + 11 * yr) / 30) + Math.round(29.5001 * (mo - 1)) + Math.floor((mo - 1) / 2);
    }
    while (mStart(hy + 1, 1) <= jdn) hy++;
    while (mStart(hy, 1) > jdn) hy--;
    let hm = 1;
    while (hm < 12 && mStart(hy, hm + 1) <= jdn) hm++;
    let hd = jdn - mStart(hy, hm) + 1;
    return { d: hd, m: hm, y: hy };
  }

  // Day-of-year for 2026 (non-leap)
  const monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const doy = monthDays[m - 1] + d; // 1-based

  // User-provided 2026 month boundaries (first day of each Gregorian month)
  // Source: authoritative user data + screenshot verification (November 2026)
  // Month codes: 1=Muharram 2=Safar 3=Rabiulawal 4=Rabiulakhir 5=Jumadilawal 6=Jumadilakhir 7=Rajab 8=Syakban 9=Ramadan 10=Syawal 11=Zulkaiddah 12=Zulhijjah
  const hijriStart = [
    { doy: 1,    h: 12, m: 7,  y: 1447 }, // Jan 01
    { doy: 32,   h: 13, m: 8,  y: 1447 }, // Feb 01
    { doy: 60,   h: 11, m: 9,  y: 1447 }, // Mar 01
    { doy: 91,   h: 12, m: 10, y: 1447 }, // Apr 01
    { doy: 121,  h: 13, m: 11, y: 1447 }, // May 01
    { doy: 152,  h: 15, m: 12, y: 1447 }, // Jun 01
    { doy: 182,  h: 16, m: 1,  y: 1448 }, // Jul 01
    { doy: 213,  h: 17, m: 2,  y: 1448 }, // Aug 01
    { doy: 244,  h: 19, m: 3,  y: 1448 }, // Sep 01
    { doy: 274,  h: 18, m: 4,  y: 1448 }, // Oct 01: 18 Rabiulakhir 1448
    { doy: 305,  h: 19, m: 5,  y: 1448 }, // Nov 01: 19 Jumadil Awal (screenshot verified)
    { doy: 335,  h: 19, m: 6,  y: 1448 }, // Dec 01: 19 Jumadil Akhir (calculated from Nov 30 = 18)
    { doy: 366,  h: 20, m: 7,  y: 1448 }, // Jan 01, 2027: 20 Rajab 1448 (calculated from Dec 31 = 19 Jumadil Akhir + 1)
  ];

  // Find the segment
  for (let i = 0; i < hijriStart.length - 1; i++) {
    if (doy >= hijriStart[i].doy && doy < hijriStart[i + 1].doy) {
      let start = hijriStart[i];
      let offset = doy - start.doy;
      let hd = start.h + offset;
      let hm = start.m;
      let hy = start.y;

      // Hijri month lengths for 1447-1448 (authoritative)
      const hijriMonthLen = {
        1447: { 7: 30, 8: 30, 9: 29, 10: 30, 11: 29, 12: 30 },
        1448: { 1: 30, 2: 29, 3: 30, 4: 29, 5: 30, 6: 29, 7: 30 }
      };

      while (hd > (hijriMonthLen[hy]?.[hm] || 30)) {
        hd -= (hijriMonthLen[hy]?.[hm] || 30);
        hm++;
        if (hm > 12) { hm = 1; hy++; }
      }
      return { d: hd, m: hm, y: hy };
    }
  }
  // Fallback (should not reach)
  return { d: 1, m: 1, y: 1447 };
}

async function loadHolidays() {
  try {
    const res = await fetch('./holidays.json?v=' + Date.now());
    HOLIDAYS = await res.json();
  } catch(e) {
    console.error('Failed to load holidays', e);
  }
  render();
}

function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  const holidayList = document.getElementById('holiday-list');
  
  if (!head || !subh || !cal) return;

  const first = new Date(state.y, state.m, 1);
  const last = new Date(state.y, state.m + 1, 0);
  const now = new Date();

  head.textContent = `${BLN[state.m]} ${state.y}`;

  let hjFirst = getExactHijri(state.y, state.m + 1, 1, getJDN(state.y, state.m + 1, 1));
  let hjLast = getExactHijri(state.y, state.m + 1, last.getDate(), getJDN(state.y, state.m + 1, last.getDate()));
  subh.textContent = `${hjFirst.d} ${HIJRI_MONTHS[hjFirst.m]} ${hjFirst.y} H - ${hjLast.d} ${HIJRI_MONTHS[hjLast.m]} ${hjLast.y} H`;

  let fd = (first.getDay() + 6) % 7;
  let html = '<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h, i) => {
    let cls = 'd-blue';
    if (i >= 4) cls = 'd-green';
    if (i === 6) cls = 'd-red';
    html += `<div class="${cls}">${h}</div>`;
  });
  html += '</div><div class="grid">';

  for (let i = 0; i < fd; i++) html += '<div class="cell empty"></div>';

  let monthHolidays = [];

  for (let d = 1; d <= last.getDate(); d++) {
    let wd = (new Date(state.y, state.m, d).getDay() + 6) % 7;
    let jdn = getJDN(state.y, state.m + 1, d);
    let hj = getExactHijri(state.y, state.m + 1, d, jdn);
    let ps = getPasaran(jdn);
    let isToday = (now.getFullYear() === state.y && now.getMonth() === state.m && now.getDate() === d);
    let isSunday = (wd === 6);

    let mm = String(state.m + 1).padStart(2, '0');
    let dd = String(d).padStart(2, '0');
    let dateKey = `${state.y}-${mm}-${dd}`;
    let holidayDesc = HOLIDAYS[dateKey];

    if (holidayDesc) monthHolidays.push({d, desc: holidayDesc});

    let cellCls = 'cell';
    if (isToday) cellCls += ' today';
    if (isSunday || holidayDesc) cellCls += ' holiday-cell';

    let hjArabic = toArabicDigits(hj.d);

    html += `<div class="${cellCls}"><div class="h">${hjArabic}</div><div class="day-wrap"><div class="g">${d}</div><div class="p">${ps}</div></div></div>`;
  }

  let totalCells = fd + last.getDate();
  let trailingEmpty = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) html += '<div class="cell empty"></div>';

  html += '</div>';
  cal.innerHTML = html;

  if (holidayList) {
    if (monthHolidays.length > 0) {
      let hHtml = '<div class="holiday-title">Libur & Cuti:</div><ul>';
      monthHolidays.forEach(h => {
        hHtml += `<li><span class="h-date-text">${h.d} ${BLN[state.m]}</span>: ${h.desc}</li>`;
      });
      hHtml += '</ul>';
      holidayList.innerHTML = hHtml;
      holidayList.style.display = 'block';
    } else {
      holidayList.innerHTML = '';
      holidayList.style.display = 'none';
    }
  }
}

function prevMonth() { state.m--; if(state.m < 0){state.m=11;state.y--;} render(); }
function nextMonth() { state.m++; if(state.m > 11){state.m=0;state.y++;} render(); }
function goToday() { const d=new Date(); state.y=d.getFullYear(); state.m=d.getMonth(); render(); }

document.getElementById('prev').onclick = prevMonth;
document.getElementById('next').onclick = nextMonth;
document.getElementById('today').onclick = goToday;

// Swipe Gesture
let touchStartX = 0;
const touchArea = document.getElementById('touch-area');
if (touchArea) {
  touchArea.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive:true});
  touchArea.addEventListener('touchend', e => {
      let dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) > 40) dx < 0 ? nextMonth() : prevMonth();
  }, {passive:true});
}

loadHolidays();
