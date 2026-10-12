const SUPABASE_URL='https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NDEzNTksImV4cCI6MjA3NDUxNzM1OX0.5iQ8Az3LpGXpXW-GqMwf1u9B0U1-B3LGoS2aNRc4PpU';
let state={profiles:[],items:[],active:null,key:'kalender',y:new Date().getFullYear(),m:new Date().getMonth()};
function getKey(){return state.key;}
function authHeaders(){return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};}

async function sel(q){
  try {
    const k=getKey(); const s=q.includes('?')?'&':'?';
    let url=SUPABASE_URL+q+s+'calendar_key=eq.'+encodeURIComponent(k);
    if(q.includes('cal_items'))url+='&deleted_at=is.null';
    const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});
    if(!r.ok)return[];
    return r.json();
  }catch(e){return [];}
}

async function ins(t,obj){
  const k=getKey(); obj.calendar_key=k;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+t,{method:'POST',headers:authHeaders(),body:JSON.stringify(obj)});
  if(!r.ok){ const txt=await r.text(); console.error(txt); throw new Error('err'); }
  return r.json();
}

const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const PASARAN=['Legi','Pahing','Pon','Wage','Kliwon'];

function gregorianToJd(d,m,y){return Math.floor((1461*(y+4800+Math.floor((m-14)/12)))/4)+Math.floor((367*(m-2-12*Math.floor((m-14)/12)))/12)-Math.floor((3*Math.floor((y+4900+Math.floor((m-14)/12))/100))/4)+d-32075;}

function pasaranName(y,m,d){
  const jd=gregorianToJd(d,m+1,y);
  const idx=((jd-2451545)%5+5)%5;
  return PASARAN[idx];
}

function hijriOf(d,m,y){
  try{
    const dt=new Date(y,m,d);
    const f=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'numeric'});
    const parts=f.formatToParts(dt);
    const o={};
    parts.forEach(p=>o[p.type]=p.value);
    return o.day || '';
  }catch(e){return '';}
}

function render(){
  const head=document.getElementById('big');
  const subh=document.getElementById('small');
  const first=new Date(state.y,state.m,1), last=new Date(state.y,state.m+1,0);
  const now=new Date();
  const hjFirst=hijriOf(1,state.m,state.y);
  const hjLast=hijriOf(last.getDate(),state.m,state.y);
  let sub=BLN[state.m]+' '+state.y;
  head.textContent=BLN[state.m]+' '+state.y;
  if(subh) subh.textContent=sub;

  const fd=(first.getDay()+6)%7;
  let html='<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h,i)=>html+='<div class="d'+i+'">'+h+'</div>');
  html+='</div><div class="grid">';
  for(let i=0;i<fd;i++) html+='<div class="cell empty"></div>';
  for(let d=1;d<=last.getDate();d++){
    const wd=(new Date(state.y,state.m,d).getDay()+6)%7;
    const hj=hijriOf(d,state.m,state.y);
    const ps=pasaranName(state.y,state.m,d);
    const today=now.getFullYear()==state.y&&now.getMonth()==state.m&&now.getDate()==d;
    html+='<div class="cell wd'+wd+(today?' today':'')+'"><div class="h">'+hj+'</div><div class="g">'+d+'</div><div class="p">'+ps+'</div></div>';
  }
  html+='</div>';
  const cal=document.getElementById('cal');
  if(cal) cal.innerHTML=html;
}

async function load(){
  state.profiles=await sel('/rest/v1/cal_profiles?select=*');
  state.items=await sel('/rest/v1/cal_items?select=*');
  if(state.profiles.length===0){
    try{
      const r=await ins('cal_profiles',{name:'Profil A (Jurnal Keseharian)'});
      state.profiles=r; state.active=r[0].id;
    }catch(e){}
  }else if(!state.active) state.active=state.profiles[0].id;
  render();
}

document.getElementById('prev').onclick=()=>{state.m--;if(state.m<0){state.m=11;state.y--;}render();};
document.getElementById('next').onclick=()=>{state.m++;if(state.m>11){state.m=0;state.y++;}render();};
document.getElementById('today').onclick=()=>{const d=new Date();state.y=d.getFullYear();state.m=d.getMonth();render();};

load(); setInterval(load,60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
