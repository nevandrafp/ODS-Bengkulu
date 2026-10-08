/* =========================================================================
   LOGIN (NIP + password, tersimpan di Supabase tabel app_users)
   - Sesi login disimpan di localStorage supaya tidak perlu login ulang
     setiap refresh (sampai user klik "Keluar").
   - Selama belum login, #appShell (seluruh dashboard) disembunyikan dan
     hanya #loginScreen yang tampil.
   - CATATAN KEAMANAN: lihat komentar di js/supabase-client.js (AuthDB) dan
     data/supabase-schema.sql — ini login sederhana berbasis tabel, cocok
     untuk trial/internal, bukan pengganti sistem auth production-grade.
   ========================================================================= */

const AUTH_STORAGE_KEY = 'fieldhub_session_user';

function getSessionUser(){
  try{ return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||'null'); }
  catch(e){ return null; }
}
function setSessionUser(user){
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}
function clearSessionUser(){
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function showApp(user){
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('appShell').classList.add('flex');
  const nameEl = document.getElementById('headerUserName');
  const avatarEl = document.getElementById('headerUserAvatar');
  if(nameEl) nameEl.textContent = user.nama || user.nip;
  if(avatarEl) avatarEl.textContent = (user.nama||user.nip||'?').trim().charAt(0).toUpperCase();
  // peta baru punya ukuran benar setelah container-nya kelihatan
  setTimeout(()=>{
    if(window.radarMap) radarMap.invalidateSize();
    if(window.routeMap) routeMap.invalidateSize();
  }, 50);
}
function showLogin(){
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('appShell').classList.remove('flex');
  document.getElementById('loginScreen').classList.remove('hidden');
}

/* ---------- watermark "FIELDHUB" tiled di background halaman login ---------- */
function renderFieldhubBackground(){
  const holder = document.getElementById('fieldhubBg');
  if(!holder) return;
  holder.innerHTML='';
  const cols=6, rows=8;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const span=document.createElement('span');
      span.textContent='FIELDHUB';
      span.style.cssText=`
        position:absolute; left:${(c/cols)*100}%; top:${(r/rows)*100}%;
        transform:translate(-10%,-10%) rotate(-20deg);
        font-size:34px; font-weight:800; letter-spacing:2px;
        color:rgba(255,255,255,0.06); white-space:nowrap; user-select:none;`;
      holder.appendChild(span);
    }
  }
}
renderFieldhubBackground();

/* ---------- form login ---------- */
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const nip = document.getElementById('loginNip').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginSubmitBtn');
  errEl.classList.add('hidden');
  if(!nip || !password){ errEl.textContent='NIP dan password wajib diisi.'; errEl.classList.remove('hidden'); return; }
  btn.disabled=true; btn.textContent='Memeriksa...';
  const result = await AuthDB.login(nip, password);
  btn.disabled=false; btn.textContent='Masuk';
  if(result.error){
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    return;
  }
  setSessionUser(result.user);
  showApp(result.user);
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  clearSessionUser();
  showLogin();
});

/* ---------- cek sesi tersimpan saat halaman dibuka ---------- */
(function initAuth(){
  const user = getSessionUser();
  if(user) showApp(user);
  else showLogin();
})();
