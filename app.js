const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODg0NzMsImV4cCI6MjA4OTY2NDQ3M30.eZPbYTuaDerKL9SOEa4ctkxSlU1PiEAU9l42czgYOyI';
let state={profiles:[],items:[],active:null,key:'kalender',y:new Date().getFullYear(),m:new Date().getMonth()};

function getKey(){return state.key;}
function authHeaders(){return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};}

async function sel(q){
  const k=getKey(); const s=q.includes('?')?'&':'?';
  let url=SUPABASE_URL+q+s+'calendar_key=eq.'+encodeURIComponent(k);
  if(q.includes('cal_items')) url+='&deleted_at=is.null';
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});
  if(!r.ok) return [];
  return r.json();
}
async function ins(t,obj){
  const k=getKey(); obj.calendar_key=k;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+t,{method:'POST',headers:authHeaders(),body:JSON.stringify(obj)});
  if(!r.ok){ alert(await r.text()); throw new Error('err'); }
  return r.json();
}

function monthName(m){return ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][m];}

function render(){
  const head=document.getElementById('month'); head.textContent=monthName(state.m)+' '+state.y;
  const first=new Date(state.y,state.m,1), last=new Date(state.y,state.m+1,0);
  const fd=first.getDay(); // 0 sun
  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.25rem">';
  for(let i=0;i<fd;i++) html+='<div></div>';
  for(let d=1;d<=last.getDate();d++){
    html+='<div style="padding:.5rem;border:1px solid #334155;border-radius:.5rem;min-height:70px;font-size:.9rem">'+d+'</div>';
  }
  html+='</div>';
  document.getElementById('cal').innerHTML=html;
}

async function load(){
  state.profiles=await sel('/rest/v1/cal_profiles?select=*');
  state.items=await sel('/rest/v1/cal_items?select=*');
  if(state.profiles.length===0){
    const r=await ins('cal_profiles',{name:'Profil A (Jurnal Keseharian)'});
    state.profiles=r; state.active=r[0].id;
  }else if(!state.active) state.active=state.profiles[0].id;
  render();
}

document.getElementById('prev').onclick=()=>{state.m--; if(state.m<0){state.m=11;state.y--;} render();};
document.getElementById('next').onclick=()=>{state.m++; if(state.m>11){state.m=0;state.y++;} render();};
document.getElementById('today').onclick=()=>{const d=new Date(); state.y=d.getFullYear(); state.m=d.getMonth(); render();};

load(); setInterval(load,60000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
