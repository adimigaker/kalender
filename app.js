const SUPABASE_URL='https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NDEzNTksImV4cCI6MjA3NDUxNzM1OX0.5iQ8Az3LpGXpXW-GqMwf1u9B0U1-B3LGoS2aNRc4PpU';
let state={profiles:[],items:[],active:null,key:'kalender',y:new Date().getFullYear(),m:new Date().getMonth()};

function getKey(){return state.key;}
function authHeaders(){return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};}

// Pasaran Jawa (Legi=0, Pahing=1, Pon=2, Wage=3, Kliwon=4)
// Anchor: Jan 1 2000 = JD 2451545 = Wage (3)
function getPasaran(y,m,d){
  const jd=Math.floor((1461*(y+4800+Math.floor((m-14)/12)))/4)+Math.floor((367*(m-2-12*Math.floor((m-14)/12)))/12)-Math.floor((3*Math.floor((y+4900+Math.floor((m-14)/12))/100))/4)+d-32075;
  const idx=((jd-2451545+3)%5+5)%5;
  return ['Legi','Pahing','Pon','Wage','Kliwon'][idx];
}

async function sel(q){
  const k=getKey(); const s=q.includes('?')?'&':'?';
  let url=SUPABASE_URL+q+s+'calendar_key=eq.'+encodeURIComponent(k);
  if(q.includes('cal_items'))url+='&deleted_at=is.null';
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});
  if(!r.ok)return[];
  return r.json();
}

async function render(){
  const head=document.getElementById('big');
  const subh=document.getElementById('small');
  const first=new Date(state.y,state.m,1), last=new Date(state.y,state.m+1,0);
  const now=new Date();
  const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  
  head.textContent=`${BLN[state.m]} ${state.y}`;
  // Intl Hijri
  const hj=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'numeric'}).format(new Date(state.y,state.m,15));
  subh.textContent=`Masehi / Hijriyah / Jawa`;

  const fd=(first.getDay()+6)%7;
  let html='<div class="dow">';
  ['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].forEach((h,i)=>{
    let c='blue'; if(i>=4) c='green'; if(i==6) c='red';
    html+=`<div style="color:var(--${c})">${h}</div>`;
  });
  html+='</div><div class="grid">';
  for(let i=0;i<fd;i++) html+='<div class="cell empty"></div>';
  for(let d=1;d<=last.getDate();d++){
    const wd=(new Date(state.y,state.m,d).getDay()+6)%7;
    const hjD=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric'}).format(new Date(state.y,state.m,d));
    const ps=getPasaran(state.y,state.m,d);
    const today=(now.getFullYear()==state.y&&now.getMonth()==state.m&&now.getDate()==d);
    
    let borderStyle = wd==6 ? 'border-color:var(--red)' : '';
    let boxStyle = today ? 'box-shadow:0 0 0 1px var(--blue) inset' : '';
    
    html+=`<div class="cell" style="${borderStyle};${boxStyle}">
      <div class="h" style="color:var(--blue)">${hjD}</div>
      <div class="g" style="font-weight:bold">${d}</div>
      <div class="p">${ps}</div>
    </div>`;
  }
  html+='</div>';
  document.getElementById('cal').innerHTML=html;
}

document.getElementById('prev').onclick=()=>{state.m--;if(state.m<0){state.m=11;state.y--;}render();};
document.getElementById('next').onclick=()=>{state.m++;if(state.m>11){state.m=0;state.y++;}render();};
document.getElementById('today').onclick=()=>{const d=new Date();state.y=d.getFullYear();state.m=d.getMonth();render();};

render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
