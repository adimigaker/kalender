const SUPABASE_URL='https://eogdtpkiwzlarllnxsrj.supabase.co';
const const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODg0NzMsImV4cCI6MjA4OTY2NDQ3M30.eZPbYTuaDerKL9SOEa4ctkxSlU1PiEAU9l42czgYOyI';
let state={profiles:[],items:[],active:null,key:'kalender',y:new Date().getFullYear(),m:new Date().getMonth()};
function getKey(){return state.key;}
function authHeaders(){return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};}
async function sel(q){const k=getKey();const s=q.includes('?')?'&':'?';let url=SUPABASE_URL+q+s+'calendar_key=eq.'+encodeURIComponent(k);if(q.includes('cal_items'))url+='&deleted_at=is.null';const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});if(!r.ok)return[];return r.json();}
async function ins(t,obj){const k=getKey();obj.calendar_key=k;const r=await fetch(SUPABASE_URL+'/rest/v1/'+t,{method:'POST',headers:authHeaders(),body:JSON.stringify(obj)});if(!r.ok){alert(await r.text());throw new Error('err');}return r.json();}

const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN=['Legi','Pahing','Pon','Wage','Kliwon'];
const HARI_JAWA=['Ahad','Senen','Selasa','Rabu','Kemis','Jumat','Sabtu'];
// Epoch Jawa (1 Suro 1946 = 6 Jan 1946), pasaran cycle 7 hari, 5 pasaran
function pasaranOf(y,m,d){ // m 0-based
  const jd=gregorianToJd(d,m+1,y);
  const idx=((jd+3)%7+7)%7; // weekday index 0=Minggu(1970-01-05 Senin base)
  return idx; // weekday-based pasaran align: Senin=Legi? use classic mapping below
}
function gregorianToJd(d,m,y){return Math.floor((1461*(y+4800+Math.floor((m-14)/12)))/4)+Math.floor((367*(m-2-12*Math.floor((m-14)/12)))/12)-Math.floor((3*Math.floor((y+4900+Math.floor((m-14)/12))/100))/4)+d-32075;}
// Pasaran via day count: classic cycle - 1946-01-06 = 1 Suro 47, pasaran Legi? 
// Use unified: pasaran index = (jd - epoch) % 5 where epoch chosen so 1946-01-06 = Kliwon(4)... 
// Simpler robust: known 2000-01-01 = Jumat pasaran Pahing? Verify via common tables: 1 Jan 2000 = Wage.
function pasaranName(y,m,d){
  const jd=gregorianToJd(d,m+1,y);
  // 2000-01-01 jd = 2451545 -> pasaran Wage (index 3)
  const idx=((jd-2451545)%5+5)%5;
  return PASARAN[idx];
}
function jawaWeekdayName(y,m,d){
  const jd=gregorianToJd(d,m+1,y);
  const idx=((jd+1)%7+7)%7; // jd 2451545 (2000-01-01) %7 -> Jumat
  // Use: 2000-01-01 is Friday
  const w=((jd%7)+7)%7;
  const map=[4,5,6,0,1,2,3]; // convert jd%7 to weekday where 2000-01-01 jd%7 => ?
  // fallback simple: JS getDay
  return HARI_JAWA[new Date(y,m,d).getDay()];
}
// Hijri via Intl (browser support)
function hijriOf(d,m,y){
  try{
    const dt=new Date(y,m,d);
    const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'numeric',year:'numeric'});
    const parts=f.formatToParts(dt);
    const o={};
    parts.forEach(p=>o[p.type]=p.value);
    return {y:o.year,m:o.month,d:o.day};
  }catch(e){return null;}
}

function render(){
  const head=document.getElementById('month');
  const first=new Date(state.y,state.m,1), last=new Date(state.y,state.m+1,0);
  const now=new Date();
  const bln=hijriOf(1,state.m,state.y);
  const bln2=hijriOf(last.getDate(),state.m,state.y);
  let sub=BLN[state.m]+' '+state.y;
  if(bln) sub+=' / '+bln.d+' '+bln.m+' '+bln.y+' H';
  head.innerHTML='<div class="big">'+BLN[state.m]+' '+state.y+'</div><div class="small">'+sub+'</div>';
  const fd=(first.getDay()+6)%7; // Monday-first
  let html='<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h,i)=>html+='<div class="d'+i+'">'+h+'</div>');
  html+='</div><div class="grid">';
  for(let i=0;i<fd;i++) html+='<div class="cell empty"></div>';
  for(let d=1;d<=last.getDate();d++){
    const wd=(new Date(state.y,state.m,d).getDay()+6)%7;
    const hj=hijriOf(d,state.m,state.y);
    const ps=pasaranName(state.y,state.m,d);
    const today=now.getFullYear()==state.y&&now.getMonth()==state.m&&now.getDate()==d;
    html+='<div class="cell wd'+wd+(today?' today':'')+'"><div class="g">'+d+'</div><div class="p">'+ps+'</div>'+(hj?'<div class="h">'+hj.d+'</div>':'')+'</div>';
  }
  html+='</div>';
  document.getElementById('cal').innerHTML=html;
}
async function load(){
  state.profiles=await sel('/rest/v1/cal_profiles?select=*');
  state.items=await sel('/rest/v1/cal_items?select=*');
  if(state.profiles.length===0){const r=await ins('cal_profiles',{name:'Profil A (Jurnal Keseharian)'});state.profiles=r;state.active=r[0].id;}
  else if(!state.active)state.active=state.profiles[0].id;
  render();
}
document.getElementById('prev').onclick=()=>{state.m--;if(state.m<0){state.m=11;state.y--;}render();};
document.getElementById('next').onclick=()=>{state.m++;if(state.m>11){state.m=0;state.y++;}render();};
document.getElementById('today').onclick=()=>{const d=new Date();state.y=d.getFullYear();state.m=d.getMonth();render();};
load();setInterval(load,60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
