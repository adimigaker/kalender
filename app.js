const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NDEzNTksImV4cCI6MjA3NDUxNzM1OX0.5iQ8Az3LpGXpXW-GqMwf1u9B0U1-B3LGoS2aNRc4PpU';

let state={profiles:[],items:[],active:null,key:'kalender'};

function getKey(){ return state.key; }
function authHeaders(){return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};}

async function sel(q){
  const k=getKey();
  const s=q.includes('?')?'&':'?';
  let url=SUPABASE_URL+q+s+'calendar_key=eq.'+encodeURIComponent(k);
  if(q.includes('cal_items')) url+='&deleted_at=is.null';
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});
  if(!r.ok){ const t=await r.text(); alert('ERR'+r.status+':'+t); throw new Error('ERR'+r.status); }
  return r.json();
}
async function ins(t,obj){
  const k=getKey();
  obj.calendar_key=k;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+t,{method:'POST',headers:authHeaders(),body:JSON.stringify(obj)});
  if(!r.ok){ const txt=await r.text(); alert(txt); throw new Error(txt); }
  return r.json();
}

function esc(s){return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));}

function render(){
  const prof=document.getElementById('profiles'); prof.innerHTML='';
  state.profiles.forEach(p=>{
    const b=document.createElement('button');
    b.className='profile-btn'+(state.active===p.id?' active':'');
    b.textContent=p.name; b.onclick=()=>{state.active=p.id;render();}; prof.appendChild(b);
  });
  const grid=document.getElementById('grid'); grid.innerHTML='';
  const items=state.items.filter(x=>x.profile_id===state.active).sort((a,b)=> (a.start_at||'')>(b.start_at||'')?1:-1);
  if(items.length===0){ grid.innerHTML='<div class="card"><h2>Kosong</h2><div>Belum ada catatan</div></div>'; return;}
  items.forEach(it=>{
    const d=document.createElement('div'); d.className='item';
    const w=it.all_day?'Seharian':(it.start_at||'')+(it.end_at?(' - '+it.end_at):'');
    d.innerHTML='<div class="item-title">'+esc(it.title)+'</div><div class="item-time">'+esc(w)+'</div>'+ (it.description?('<div>'+esc(it.description)+'</div>'):'')+(it.location?('<div>'+esc(it.location)+'</div>'):'');
    grid.appendChild(d);
  });
}

async function load(){
  try{
    state.profiles=await sel('/rest/v1/cal_profiles?select=*');
    state.items=await sel('/rest/v1/cal_items?select=*');
    if(state.profiles.length===0){
      const r=await ins('cal_profiles',{name:'Profil A (Jurnal Keseharian)'});
      state.profiles=r; state.active=r[0].id;
    }else if(!state.active){ state.active=state.profiles[0].id; }
    render();
  }catch(e){ console.error(e); }
}

document.getElementById('new-profile').onclick=async()=>{
  const name=prompt('Nama profil'); if(!name)return;
  try{ const r=await ins('cal_profiles',{name}); state.profiles.push(r[0]); state.active=r[0].id; render(); }catch(e){}
};
document.getElementById('new-item').onclick=async()=>{
  if(!state.active){alert('Buat profil dulu');return;}
  const title=prompt('Judul'); if(!title)return;
  const desc=prompt('Deskripsi (opsional)')||null;
  const loc=prompt('Lokasi (opsional)')||null;
  const start=prompt('Waktu mulai ISO8601 (kosongkan kalau seharian)')||null;
  try{ const r=await ins('cal_items',{profile_id:state.active,title,description:desc,location:loc,start_at:start||null,all_day:start?false:true}); state.items.push(r[0]); render(); }catch(e){}
};

load(); setInterval(load,10000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
