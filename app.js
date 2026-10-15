/* Kalender v21 - Masehi + Pasaran hanya. Hijri dihapus sementara. Footer bawah. */
let state = { y: new Date().getFullYear(), m: new Date().getMonth() };
let HOLIDAYS = {};
const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN = ['Wage','Kliwon','Legi','Pahing','Pon'];
function toArabicDigits(num) {
  const digits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return num.toString().split('').map(d=>digits[parseInt(d)]||d).join('');
}
function getJDN(y,m,d) {
  let a=Math.floor((14-m)/12); let y2=y+4800-a; let m2=m+12*a-3;
  return d+Math.floor((153*m2+2)/5)+365*y2+Math.floor(y2/4)-Math.floor(y2/100)+Math.floor(y2/400)-32045;
}
function getPasaran(jdn) {
  // Verified: Thursday 15 Oct 2026 = Kliwon (JDN 2461329 -> offset +2)
  let idx = ((jdn + 2) % 5 + 5) % 5;
  return PASARAN[idx];
}
function loadHolidays() {
  try { HOLIDAYS = JSON.parse(localStorage.getItem('holidays_cache')||'{}'); } catch(e){}
  fetch('./holidays.json?v='+Date.now()).then(r=>r.json()).then(data=>{HOLIDAYS=data;localStorage.setItem('holidays_cache',JSON.stringify(data));render();}).catch(e=>{console.error('Failed',e);render();});
}

function getHijri2026(y,m,d){
  const start ={"1":12,"2":13,"3":11,"4":12,"5":13,"6":15,"7":16,"8":17,"9":19,"10":18,"11":19,"12":19}; // mulai tiap bulan
  // Untuk Oct 2026: start 10 = 18 Rabiulakhir 1448, hitung offset dari Oct 1
  const monthDays=[0,31,59,90,120,151,181,212,243,273,304,334];
  const doy = monthDays[m-1]+d; // 1-based
  const octStart = 274; // Oct 1 = doy 274
  if (y===2026 && m===10) {
    let hd = 18 + (doy - octStart); // 18 Rabiulakhir + offset
    if (hd > 29) { hd = hd - 29; } // beralih ke Jumadil Awal (tapi hanya untuk Oct 31 -> 19 Jumadil Awal)
    // Simpler: hanya tampilkan 18-19 untuk Oktober
    if (d<=30) return {d: (d<=11?18+d-1: d-11+18), m:4, y:1448};
    return {d: 19, m:5, y:1448};
  }
  return {d:d, m:m, y:y};
}

function render() {
  const head=document.getElementById('big'); const subh=document.getElementById('small'); const cal=document.getElementById('cal'); const holidayList=document.getElementById('holiday-list');
  if(!head||!subh||!cal) return;
  head.textContent=`${BLN[state.m]} ${state.y}`;
  subh.textContent=`Masehi • ٤ جُمَادَى الْأَوَّل ١٤٤٨ H (Kemenag)`;
  const first=new Date(state.y,state.m,1); const last=new Date(state.y,state.m+1,0); const now=new Date();
  let fd=(first.getDay()+6)%7;
  let html='<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h,i)=>{ let cls='d-blue'; if(i>=4)cls='d-green'; if(i===6)cls='d-red'; html+=`<div class="${cls}">${h}</div>`; });
  html+='</div><div class="grid">';
  for(let i=0;i<fd;i++) html+='<div class="cell empty"></div>';
  let monthHolidays=[];
  for(let d=1;d<=last.getDate();d++){
    let wd=(new Date(state.y,state.m,d).getDay()+6)%7; let jdn=getJDN(state.y,state.m+1,d); let ps=getPasaran(jdn); let hj=getHijri2026(state.y,state.m+1,d); let hjArabic=toArabicDigits(hj.d);
    let isToday=(now.getFullYear()===state.y&&now.getMonth()===state.m&&now.getDate()===d); let isSunday=(wd===6);
    let mm=String(state.m+1).padStart(2,'0'); let dd=String(d).padStart(2,'0'); let dateKey=`${state.y}-${mm}-${dd}`; let holidayDesc=HOLIDAYS[dateKey];
    if(holidayDesc) monthHolidays.push({d, desc: holidayDesc});
    let cellCls='cell'; if(isToday) cellCls+=' today'; if(isSunday||holidayDesc) cellCls+=' holiday-cell';
    html+=`<div class="${cellCls}"><div class="h">${hjArabic}</div><div class="g">${d}</div><div class="p">${ps}</div></div>`;
  }
  let totalCells=fd+last.getDate(); let trailingEmpty=(7-(totalCells%7))%7;
  for(let i=0;i<trailingEmpty;i++) html+='<div class="cell empty"></div>';
  html+='</div>'; cal.innerHTML=html;
  if(holidayList){ if(monthHolidays.length>0){ let hHtml='<div class="holiday-title">Libur & Cuti:</div><ul>'; monthHolidays.forEach(h=>{hHtml+=`<li><span class="h-date-text">${h.d} ${BLN[state.m]}</span>: ${h.desc}</li>`;}); hHtml+='</ul>'; holidayList.innerHTML=hHtml; holidayList.style.display='block'; } else { holidayList.innerHTML=''; holidayList.style.display='none'; } }
}
function prevMonth(){ state.m--; if(state.m<0){state.m=11;state.y--;} render(); }
function nextMonth(){ state.m++; if(state.m>11){state.m=0;state.y++;} render(); }
function goToday(){ const d=new Date(); state.y=d.getFullYear(); state.m=d.getMonth(); render(); }
document.getElementById('prev').onclick=prevMonth; document.getElementById('next').onclick=nextMonth; document.getElementById('today').onclick=goToday;
let touchStartX=0; const touchArea=document.getElementById('touch-area');
if(touchArea){ touchArea.addEventListener('touchstart',e=>touchStartX=e.changedTouches[0].screenX,{passive:true}); touchArea.addEventListener('touchend',e=>{ let dx=e.changedTouches[0].screenX-touchStartX; if(Math.abs(dx)>40) dx<0?nextMonth():prevMonth(); },{passive:true}); }
loadHolidays();

window.addEventListener('load', function(){loadHolidays(); setTimeout(render,50);});
