/* =========================================================================
   COMMON: icons, navigation, shared constants & GPS service
   Loaded first — every other js/*.js file relies on globals defined here.
   ========================================================================= */

/* ---------- icons ---------- */
lucide.createIcons();

/* ---------- navigation (menu: Field Operation System & Outbranch Delivery
   System saja — menu Dashboard sudah dihapus sesuai permintaan) ---------- */
document.querySelectorAll('[data-page]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['fos','ods','umkm'].forEach(p=>{
      document.getElementById('page-'+p).classList.toggle('hidden', p!==btn.dataset.page);
    });
    if(btn.dataset.page==='fos'){
      setTimeout(()=>{
        radarMap.invalidateSize();
        routeMap.invalidateSize();
      },50);
    }
    if(btn.dataset.page==='umkm' && typeof renderUmkmTable==='function') renderUmkmTable();
  });
});
document.getElementById('toggleSidebar').addEventListener('click', ()=>{
  const sb=document.getElementById('sidebar');
  sb.style.display = sb.style.display==='none' ? 'block' : 'none';
});
document.querySelectorAll('.subtab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.subtab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['radar','route'].forEach(s=>{
      document.getElementById('fos-'+s).classList.toggle('hidden', s!==btn.dataset.sub);
    });
    setTimeout(()=>{
      radarMap.invalidateSize();
      routeMap.invalidateSize();
    },50);
  });
});

/* ---------- shared constants ---------- */
const BBOX = { south:-3.84, west:102.25, north:-3.78, east:102.30 }; // Kecamatan Ratu Agung, Kota Bengkulu (perkiraan)
const OFFICE = [-3.8002, 102.2711]; // Bank Mandiri KC Bengkulu S. Parman (Jl. S. Parman No.15, Ratu Agung) — titik awal/fallback
const OFFICE_NAME = 'KC S Parman (Area Bengkulu)';
const OSRM = 'https://router.project-osrm.org';

/* Tiga jenis lokasi: Balai RT/RW, Sekolah, dan UMKM (kembali ditambahkan,
   lengkap dengan menu "Database UMKM" — lihat js/umkm.js). Pembeda antar
   jenis bukan cuma warna, tapi juga bentuk ikon (svg path di dalam
   masing-masing) yang dipakai oleh iconFor() di js/fos-field-radar.js. */
const typeMeta = {
  balai:  {
    color:'#7C3AED', label:'Balai RT/RW (Posyandu)',
    icon: '<path d="M6 21V9l6-4 6 4v12"/><path d="M9 21v-6h6v6"/>'
  },
  sekolah:{
    color:'#EA580C', label:'Sekolah',
    icon: '<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.5v5c2.5 2.3 7.5 2.3 10 0v-5"/>'
  },
  merchant:{
    color:'#2563EB', label:'Merchant',
    icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'
  },
  umkm:   {
    color:'#0D9488', label:'UMKM',
    icon: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4h4v4"/>'
  },
};
/* Sumber data objek: 'import' = Top Down (otomatis dari masterdata),
   'manual' = Bottom Up (diinput manual oleh pegawai di lapangan). */
function sourceLabel(src){ return src==='manual' ? 'Bottom Up' : 'Top Down'; }
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function fmtTgl(d){
  if(!d) return '';
  const x = new Date(d+'T00:00:00');
  return isNaN(x) ? d : x.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
const statusMeta = {
  belum:  { color:'#DC2626', label:'Belum' },
  proses: { color:'#F5941E', label:'Proses' },
  sudah:  { color:'#16A34A', label:'Sudah' },
};

function haversine(a,b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

/* ---------- shared GPS service ----------
   Field Radar and Smart Route Optimization both need "follow the device's
   real GPS location". Rather than each module opening its own
   watchPosition, common.js owns a single watcher and modules subscribe. */
const GeoService = (()=>{
  let watchId=null;
  let lastPos=null; // [lat,lng]
  const listeners=new Set();

  function start(){
    if(watchId!==null) return;
    if(!navigator.geolocation){ notifyError('Perangkat/browser tidak mendukung geolocation.'); return; }
    watchId = navigator.geolocation.watchPosition(
      pos=>{
        lastPos=[pos.coords.latitude, pos.coords.longitude];
        listeners.forEach(fn=>fn(lastPos));
      },
      err=>{ notifyError('Tidak dapat mengakses lokasi GPS: '+err.message); },
      { enableHighAccuracy:true, maximumAge:5000, timeout:15000 }
    );
  }
  function stop(){
    if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; }
  }
  function notifyError(msg){
    listeners.forEach(fn=>fn(null, msg));
  }
  return {
    start, stop,
    isActive:()=>watchId!==null,
    getLast:()=>lastPos,
    subscribe:(fn)=>{ listeners.add(fn); return ()=>listeners.delete(fn); },
  };
})();
window.GeoService = GeoService;
