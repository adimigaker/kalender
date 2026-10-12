const SUPABASE_URL = 'https://eogdtpkiwzlarllnxsrj.supabase.co';
const SUPABASE_ANON = 'eyJhbG...YOyI'; // sama seperti PS21
const STORE='kalender_data_v1';
let state={profiles:[],items:[],active:null,key:''};
let syncTimer=null;

function getKey(){
  if(state.key) return state.key;
  let k=localStorage.getItem('kal_key')||prompt('Masukkan calendar_key (buat sendiri & simpan)');
  if(!k)return '';
  state.key=k;localStorage.setItem('kal_key',k);return k;
}

async function supabase(q){
  const k=getKey(); if(!k) throw new Error('no key');
  const url=SUPABASE_URL+q+(q.includes('?')?'&':'?')+'calendar_key=eq.'+encodeURIComponent(k);
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON,'Content-Type':'application/json','Prefer':'return=representation'}});
  if(!r.ok) throw new Error(r.status);
  return r.json();
}

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
  (state.items.filter(x=>x.profile_id===state.active)).forEach(it=>{
    const d=document.createElement('div'); d.className='item';
    d.innerHTML='<div class="item-title">'+escapeHtml(it.title)+'</div><div class="item-time">'+escapeHtml(it.start_at||'-')+(it.end_at?(' - '+it.end_at):'')+'</div>'+ (it.desc?('<div>'+escapeHtml(it.desc)+'</div>'):'');
    grid.appendChild(d);
  });
}

function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));}

async function load(){
  try{const k=getKey(); if(!k)return;
    state.profiles=await supabase('/rest/v1/cal_profiles?select=*');
    state.items=await supabase('/rest/v1/cal_items?select=*');
    if(!state.active&&state.profiles[0]) state.active=state.profiles[0].id;
    render();
  }catch(e){console.error(e);}
}

document.getElementById('new-profile').onclick=async()=>{
  const name=prompt('Nama profil (mis. Jurnal Keseharian)');
  if(!name)return;
  await supabase('/rest/v1/cal_profiles'); // dummy? better POST
};
load(); setInterval(load,10000);
