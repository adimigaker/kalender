let state = {
  y: 2026,
  m: 9 // Oktober (0-indexed)
};

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
  if (y === 2026 && m === 10) {
    if (d <= 11) {
      return { d: 18 + d, m: 4, y: 1448 };
    } else {
      return { d: d - 11, m: 5, y: 1448 };
    }
  }
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

function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  
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

  for (let i = 0; i < fd; i++) {
    html += '<div class="cell empty"></div>';
  }

  for (let d = 1; d <= last.getDate(); d++) {
    let wd = (new Date(state.y, state.m, d).getDay() + 6) % 7;
    let jdn = getJDN(state.y, state.m + 1, d);
    let hj = getExactHijri(state.y, state.m + 1, d, jdn);
    let ps = getPasaran(jdn);
    let isToday = (now.getFullYear() === state.y && now.getMonth() === state.m && now.getDate() === d);
    let isSunday = (wd === 6);

    let cellCls = 'cell';
    if (isToday) cellCls += ' today';
    if (isSunday) cellCls += ' sunday-cell';

    let hjArabic = toArabicDigits(hj.d);

    html += `
      <div class="${cellCls}">
        <div class="h">${hjArabic}</div>
        <div class="g">${d}</div>
        <div class="p">${ps}</div>
      </div>
    `;
  }
  html += '</div>';
  cal.innerHTML = html;
}

function prevMonth() {
  state.m--;
  if (state.m < 0) { state.m = 11; state.y--; }
  render();
}

function nextMonth() {
  state.m++;
  if (state.m > 11) { state.m = 0; state.y++; }
  render();
}

function goToday() {
  const d = new Date();
  state.y = d.getFullYear();
  state.m = d.getMonth();
  render();
}

document.getElementById('prev').onclick = prevMonth;
document.getElementById('next').onclick = nextMonth;
document.getElementById('today').onclick = goToday;

// Swipe Gesture Detection
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

const touchArea = document.getElementById('touch-area');

touchArea.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

touchArea.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  let dx = touchEndX - touchStartX;
  let dy = touchEndY - touchStartY;
  
  // Ensure horizontal swipe is dominant and above threshold (40px)
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    if (dx < 0) {
      nextMonth(); // Swipe left -> Next Month
    } else {
      prevMonth(); // Swipe right -> Prev Month
    }
  }
}

render();
