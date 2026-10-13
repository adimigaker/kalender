const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MTk4NTYsImV4cCI6MjA2NTM5NTg1Nn0.2Y4WlM_Z1uDqFvPq3Ew6R8q9Yt3-8L4lK6x8Y3-4PpU';

let state = {
  key: 'kalender',
  y: 2026,
  m: 9 // Oktober (0-indexed)
};

const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];
const HIJRI_MONTHS = ['','Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Sya\'ban','Ramadan','Syawal','Dzulqa\'dah','Dzulhijjah'];
const JAWA_MONTHS = ['','Sura','Sapar','Mulud','Bakda Mulud','Jumadilawal','Jumadilakir','Rejeb','Ruwah','Pasa','Sawal','Dulkangidah','Besar'];

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

function getExactJawa(y, m, d, jdn) {
  let ps = getPasaran(jdn);
  if (y === 2026 && m === 10) {
    if (d <= 12) {
      return { d: 17 + d, m: 4, name: (17 + d) + ' ' + ps };
    } else {
      return { d: d - 12, m: 5, name: (d - 12) + ' ' + ps };
    }
  }
  return { d: '', m: '', name: ps };
}

function render() {
  const head = document.getElementById('big');
  const subh = document.getElementById('small');
  const cal = document.getElementById('cal');
  
  const first = new Date(state.y, state.m, 1);
  const last = new Date(state.y, state.m + 1, 0);
  const now = new Date();

  head.textContent = BLN[state.m] + ' ' + state.y;

  let hjFirst = getExactHijri(state.y, state.m + 1, 1, getJDN(state.y, state.m + 1, 1));
  let hjLast = getExactHijri(state.y, state.m + 1, last.getDate(), getJDN(state.y, state.m + 1, last.getDate()));
  subh.textContent = `${hjFirst.d} ${HIJRI_MONTHS[hjFirst.m]} ${hjFirst.y} H - ${hjLast.d} ${HIJRI_MONTHS[hjLast.m]} ${hjLast.y} H`;

  let fd = (first.getDay() + 6) % 7;
  let html = '';

  for (let i = 0; i < fd; i++) {
    html += '<div class="cell empty"></div>';
  }

  for (let d = 1; d <= last.getDate(); d++) {
    let wd = (new Date(state.y, state.m, d).getDay() + 6) % 7;
    let jdn = getJDN(state.y, state.m + 1, d);
    let hj = getExactHijri(state.y, state.m + 1, d, jdn);
    let jw = getExactJawa(state.y, state.m + 1, d, jdn);
    let isToday = (now.getFullYear() === state.y && now.getMonth() === state.m && now.getDate() === d);
    let isSunday = (wd === 6);

    let cellCls = 'cell';
    if (isToday) cellCls += ' today';
    if (isSunday) cellCls += ' sunday';

    html += `
      <div class="${cellCls}">
        <div class="cell-top">
          <span></span>
          <span class="h-date">${hj.d}</span>
        </div>
        <div class="g-date">${d}</div>
        <div class="j-date">${jw.name}</div>
      </div>
    `;
  }
  cal.innerHTML = html;
}

document.getElementById('prev').onclick = () => {
  state.m--;
  if (state.m < 0) { state.m = 11; state.y--; }
  render();
};

document.getElementById('next').onclick = () => {
  state.m++;
  if (state.m > 11) { state.m = 0; state.y++; }
  render();
};

document.getElementById('today').onclick = () => {
  const d = new Date();
  state.y = d.getFullYear();
  state.m = d.getMonth();
  render();
};

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (let reg of regs) {
      reg.unregister();
    }
  });
}
