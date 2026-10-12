const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZ2R0cGtpd3psYXJsbG54c3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NDEzNTksImV4cCI6MjA3NDUxNzM1OX0.5iQ8Az3LpGXpXW-GqMwf1u9B0U1-B3LGoS2aNRc4PpU';
const STORE='kalender_data_v1';
let state={profiles:[],items:[],active:null,key:''};

function getKey(){
  if(state.key) return state.key;
  let k=localStorage.getItem('kal_key');
  if(!k){ k=prompt('Masukkan calendar_key (buat sendiri & simpan)'); if(!k)return ''; localStorage.setItem('kal_key',k);}
  state.key=k; return k;
}

function authHeaders(){
  return {apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'};
}

async function supabaseSelect(q){
  const k=getKey(); if(!k) throw new Error('no key');
  const sep=q.includes('?')?'&':'?';
  const url=SUPABASE_URL+q+sep+'calendar_key=eq.'+encodeURIComponent(k)+'&deleted_at=is.null';
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON}});
  if(!r.ok) throw new Error(r.status);
  return r.json();
}

async function supabaseInsert(table, obj){
  const k=getKey(); if(!k) throw new Error('no key');
  obj.calendar_key=k;
  const url=SUPABASE_URL+'/rest/v1/'+table;
  const r=await fetch(url,{method:'POST',headers:authHeaders(),body:JSON.stringify(obj)});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));}

function render(){
  const prof=document.getElementById('profiles'); prof.innerHTML='';
  state.profiles.forEach(p=>{
    const b=document.createElement('button');
    b.className='profile-btn'+(state.active===p.id?' active':'');
    b.textContent=p.name;
    b.onclick=()=>{state.active=p.id;render();};
    prof.appendChild(b);
  });
  const grid=document.getElementById('grid'); grid.innerHTML='';
  const items=state.items.filter(x=>x.profile_id===state.active).sort((a,b)=>(a.start_at||'')>=(b.start_at||'')?1:-1);
  if(items.length===0){ grid.innerHTML='<div class="card"><h2>Belum ada catatan</h2><div>Klik "+ Tambah Catatan" untuk mulai.</div></div>'; return;}
  items.forEach(it=>{
    const d=document.createElement('div'); d.className='item';
    const waktu=(it.all_day?'Seharian':((it.start_at||'-')+(it.end_at?(' - '+it.end_at):'')));
    d.innerHTML='<div class="item-title">'+escapeHtml(it.title)+'</div><div class="item-time">'+escapeHtml(waktu)+'</div>'+ (it.description?('<div>'+escapeHtml(it.description)+'</div>'):'')+(it.location?('<div>'+escapeHtml(it.location)+'</div>'):'');
    grid.appendChild(d);
  });
}

async function load(){
  try{const k=getKey(); if(!k)return;
    state.profiles=await supabaseSelect('/rest/v1/cal_profiles?select=*');
    state.items=await supabaseSelect('/rest/v1/cal_items?select=*');
    if(!state.active&&state.profiles.length>0) state.active=state.profiles[0].id;
    else if(state.profiles.length===0){ /* no profile, create default */ }
    render();
  }catch(e){console.error(e);}
}

document.getElementById('new-profile').onclick=async()=>{
  const name=prompt('Nama profil (mis. Jurnal Keseharian, Jadwal Shift, Jadwal Upload)');
  if(!name)return;
  const res=await supabaseInsert('cal_profiles',{name});
  state.profiles.push(res[0]);
  state.active=res[0].id;
  render();
};

document.getElementById('new-item').onclick=async()=>{
  const title=prompt('Judul catatan (mis. Olahraga 07:00)');
  if(!title)return;
  if(!state.active){ alert('Buat profil dulu'); return; }
  const desc=prompt('Deskripsi (opsional)')||null;
  const loc=prompt('Lokasi (opsional)')||null;
  const start=prompt('Waktu mulai (ISO 8601 opsional, contoh 2026-10-12T07:00:00+07:00)')||null;
  const res=await supabaseInsert('cal_items',{profile_id:state.active,title,description:desc,location:loc,start_at:start,all_day:start?false:true});
  state.items.push(res[0]);
  render();
};

load(); setInterval(load,10000);
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
