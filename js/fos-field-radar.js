/* =========================================================================
   FIELD RADAR
   Sumber data: SATU tabel Supabase `field_radar_locations` — berisi seluruh
   tag lokasi hasil import masterdata (lihat scripts/import-masterdata.js)
   DIGABUNG dengan lokasi yang ditambahkan manual dari aplikasi ini. Kalau
   Supabase belum dikonfigurasi, otomatis jatuh ke localStorage (demo lokal).
   ========================================================================= */

let targets=[]; // seluruh lokasi, dimuat dari FieldRadarDB.loadAll()

/* ---------- Field Radar map ---------- */
const radarMap = L.map('radarMap').setView(OFFICE, 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(radarMap);
L.marker(OFFICE).addTo(radarMap).bindPopup('<b>Bank Mandiri KC S Parman</b><br/>Area Bengkulu — titik awal operasional');
const radiusCircle = L.circle(OFFICE,{radius:1000,color:'#F5941E',fillOpacity:0.08}).addTo(radarMap);
let targetMarkers={};
let gpsMarker=null;

/* Bentuk ikon berbeda per jenis lokasi (bukan cuma warna) — path svg diambil
   dari typeMeta di js/common.js. Warna isi = jenis, cincin luar = status. */
function iconFor(type,status,source){
  const meta = typeMeta[type] || { color:'#667085', icon:'' };
  const ring = statusMeta[status] ? statusMeta[status].color : '#DC2626';
  return L.divIcon({
    className:'',
    html:`<div style="position:relative;width:22px;height:22px;border-radius:50%;background:${meta.color};border:3px solid ${ring};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(0,0,0,0.15)">
            ${source==='manual' ? '<span style="position:absolute;top:-6px;right:-6px;width:10px;height:10px;border-radius:50%;background:#FBBF24;border:2px solid #fff"></span>' : ''}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>
          </div>`,
    iconSize:[22,22]
  });
}

function popupHtml(t){
  const manual = t.source==='manual';
  const badge = `<span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:99px;background:${manual?'#FEF3C7':'#DBEAFE'};color:${manual?'#92400E':'#1E40AF'}">${sourceLabel(t.source)}${manual?' (manual)':' (otomatis)'}</span>`;
  const hasVisit = t.pic_kunjungan || t.tgl_kunjungan || t.pic_objek || t.kontak_pic_objek || t.dokumentasi_url;
  const visit = hasVisit ? `<div style="margin-top:6px;padding:6px 8px;background:#F8F9FC;border-radius:8px;font-size:11.5px;color:#475467">
      <b>Kunjungan</b><br/>
      PIC kunjungan: ${esc(t.pic_kunjungan)||'-'}<br/>
      Tgl: ${fmtTgl(t.tgl_kunjungan)||'-'}<br/>
      PIC objek: ${esc(t.pic_objek)||'-'}${t.kontak_pic_objek?' ('+esc(t.kontak_pic_objek)+')':''}<br/>
      ${t.dokumentasi_url ? `<a href="${esc(t.dokumentasi_url)}" target="_blank" rel="noopener" style="color:#1D4ED8">Lihat foto dokumentasi</a>` : 'Dokumentasi: belum ada'}
    </div>` : '';
  return `<div style="min-width:220px">
    <b>${esc(t.name)}</b> ${badge}<br/>
    ${typeMeta[t.type]?typeMeta[t.type].label:esc(t.type)}<br/>
    ${t.type==='umkm' && t.pemilik ? `Pemilik: ${esc(t.pemilik)}<br/>` : ''}
    ${t.type==='umkm' && t.jenis_usaha ? `Jenis usaha: ${esc(t.jenis_usaha)}<br/>` : ''}
    Alamat: ${esc(t.alamat)||'-'}<br/>
    Telp: ${esc(t.telp)||'tidak tersedia'}<br/>
    <label style="display:block;margin-top:6px;font-size:12px;color:#475467">Status kunjungan:
      <select class="statusSelectPopup" data-id="${t.id}" style="margin-top:2px">
        <option value="belum" ${t.status==='belum'?'selected':''}>Belum</option>
        <option value="proses" ${t.status==='proses'?'selected':''}>Proses</option>
        <option value="sudah" ${t.status==='sudah'?'selected':''}>Sudah</option>
      </select>
    </label>
    <span class="statusSaveNote" style="display:none;font-size:11px;color:#16A34A">Tersimpan ke database.</span>
    ${visit}
    <button type="button" class="kjOpenBtn" style="margin-top:8px;width:100%;background:#0B1B45;color:#fff;font-size:12px;font-weight:600;padding:6px 10px;border-radius:8px">Isi / Ubah Data Kunjungan</button>
  </div>`;
}
/* Fitur: ubah status kunjungan langsung dari tag lokasi di peta (Mapping
   Wilayah), langsung terupdate ke database (Supabase) — begitu dipilih di
   dropdown popup, tanpa perlu form terpisah. */
function bindStatusPopupEvents(marker, t){
  marker.on('popupopen', (e)=>{
    const el = e.popup.getElement();
    const sel = el.querySelector('.statusSelectPopup');
    const note = el.querySelector('.statusSaveNote');
    const kjBtn = el.querySelector('.kjOpenBtn');
    if(kjBtn) kjBtn.addEventListener('click', ()=>openKunjunganModal(t.id));
    if(!sel) return;
    sel.addEventListener('change', async ()=>{
      const newStatus = sel.value;
      sel.disabled = true;
      await FieldRadarDB.updateStatus(t.id, newStatus);
      t.status = newStatus;
      sel.disabled = false;
      note.style.display='inline';
      marker.setIcon(iconFor(t.type, t.status, t.source));
      renderNearby();
      notifyTargetsChanged();
    });
  });
}
/* Memberi tahu js/umkm.js (tabel Database UMKM) bahwa `targets` berubah. */
function notifyTargetsChanged(){ window.dispatchEvent(new Event('targets-changed')); }
/* Filter jenis objek + sumber data (Top Down / Bottom Up). Mengembalikan fungsi
   predikat — state filter dibaca sekali supaya cepat untuk ribuan objek. */
function makeFilter(){
  const activeTypes=[...document.querySelectorAll('.typeFilter:checked')].map(c=>c.value);
  const src=document.getElementById('sourceFilter').value;
  return t=> activeTypes.includes(t.type) && (src==='all' || (src==='manual' ? t.source==='manual' : t.source!=='manual'));
}
/* Setelah satu objek berubah (status, data kunjungan, edit UMKM, dst.) */
function refreshAfterTargetChange(){
  renderRadarMarkers(); renderNearby(); renderBlastSearch(); populateDestSelect(); notifyTargetsChanged();
}
function renderRadarMarkers(){
  Object.values(targetMarkers).forEach(m=>radarMap.removeLayer(m));
  targetMarkers={};
  targets.filter(makeFilter()).forEach(t=>{
    const m=L.marker([t.lat,t.lng],{icon:iconFor(t.type,t.status,t.source)}).addTo(radarMap)
      .bindPopup(()=>popupHtml(t));
    bindStatusPopupEvents(m, t);
    targetMarkers[t.id]=m;
  });
}
document.querySelectorAll('.typeFilter').forEach(cb=>cb.addEventListener('change', ()=>{renderRadarMarkers(); renderNearby();}));
document.getElementById('sourceFilter').addEventListener('change', ()=>{renderRadarMarkers(); renderNearby();});

/* ---------- load data ---------- */
async function initTargets(){
  const statusEl=document.getElementById('loadStatus');
  statusEl.textContent = '(memuat database...)';
  targets = await FieldRadarDB.loadAll();
  statusEl.textContent = targets.length
    ? `(${targets.length} lokasi dari database)`
    : '(database kosong — jalankan scripts/import-masterdata.js untuk mengisi data dari masterdata.xlsx)';
  renderRadarMarkers();
  renderNearby();
  renderBlastSearch();
  populateDestSelect(); // defined in fos-route.js, called here since targets just loaded
  notifyTargetsChanged();
  document.getElementById('smartRouteBtn').disabled=false;

  // Live sync: kalau ada rekan tim mengubah data dari perangkat lain,
  // peta ini otomatis ikut update tanpa perlu refresh manual.
  FieldRadarDB.subscribe(async ()=>{
    targets = await FieldRadarDB.loadAll();
    renderRadarMarkers();
    renderNearby();
    renderBlastSearch();
    populateDestSelect();
    notifyTargetsChanged();
  });
}

/* ---------- GPS "Ikuti Lokasi Saya" ---------- */
const GPS_HINT_DEFAULT = 'Warna isi + bentuk ikon = jenis objek, cincin luar = status kunjungan, titik kuning kecil = Bottom Up (manual); tanpa titik = Top Down (otomatis). Klik tag untuk ubah status & isi data kunjungan.';
function currentOrigin(){
  return GeoService.isActive() && GeoService.getLast() ? GeoService.getLast() : OFFICE;
}
function updateGpsMarker(pos, err){
  const hint=document.getElementById('gpsHint');
  if(err){ hint.textContent = err; return; }
  if(!pos) return;
  if(!gpsMarker){
    gpsMarker = L.marker(pos,{icon:L.divIcon({className:'', html:'<div class="gps-dot"></div>', iconSize:[16,16]})}).addTo(radarMap).bindPopup('Posisi Anda (GPS)');
  }else{
    gpsMarker.setLatLng(pos);
  }
  radarMap.panTo(pos);
  radiusCircle.setLatLng(pos);
  document.getElementById('nearbyOrigin').textContent='basis: GPS Anda';
  renderNearby();
}
GeoService.subscribe(updateGpsMarker);
document.getElementById('gpsToggleBtn').addEventListener('click', function(){
  if(GeoService.isActive()){
    GeoService.stop();
    if(gpsMarker){ radarMap.removeLayer(gpsMarker); gpsMarker=null; }
    radiusCircle.setLatLng(OFFICE);
    document.getElementById('nearbyOrigin').textContent='basis: kantor';
    document.getElementById('gpsHint').textContent=GPS_HINT_DEFAULT;
    this.classList.remove('bg-[var(--navy)]','text-white');
    renderNearby();
  }else{
    GeoService.start();
    this.classList.add('bg-[var(--navy)]','text-white');
    document.getElementById('gpsHint').textContent='Mencari lokasi GPS perangkat...';
  }
});

/* ---------- Nearby target ---------- */
function renderNearby(){
  const radius=+document.getElementById('radiusSlider').value;
  const origin=currentOrigin();
  radiusCircle.setRadius(radius);
  const passes=makeFilter();
  const nearby=targets.filter(t=>passes(t) && haversine(origin,[t.lat,t.lng])<=radius);
  const list=document.getElementById('nearbyList');
  if(targets.length===0){ list.innerHTML='<p class="text-xs text-[#98A2B3]">Memuat data...</p>'; return; }
  if(nearby.length===0){ list.innerHTML='<p class="text-xs text-[#98A2B3]">Tidak ada target dalam radius ini.</p>'; return; }
  list.innerHTML=nearby.map(t=>`
    <label class="flex items-start gap-2 border border-[#EEF0F5] rounded-lg p-2 ${t.telp?'':'opacity-50'}">
      <input type="checkbox" class="nearbyCheck mt-1" value="${t.id}" ${t.telp?'':'disabled'}>
      <span>
        <span class="font-semibold text-[#101828]">${esc(t.name)}</span>
        <span class="status-dot status-${t.status}"></span>
        <span class="block text-[11px] text-[#8A93A6]">${typeMeta[t.type]?typeMeta[t.type].label:t.type} · ${sourceLabel(t.source)} · ${Math.round(haversine(origin,[t.lat,t.lng]))} m ${t.telp?'':'· nomor tidak tersedia'}</span>
      </span>
    </label>`).join('');
}
document.getElementById('radiusSlider').addEventListener('input', e=>{
  document.getElementById('radiusVal').textContent=e.target.value; renderNearby();
});

/* ---------- Manual add location ---------- */
document.getElementById('manualAddToggle').addEventListener('click', ()=>{
  document.getElementById('manualAddForm').classList.toggle('hidden');
});
document.getElementById('maUseGps').addEventListener('click', ()=>{
  const pos=GeoService.getLast();
  if(!pos){ alert('Aktifkan "Ikuti Lokasi Saya" pada peta terlebih dahulu agar GPS terbaca.'); return; }
  document.getElementById('maLat').value=pos[0].toFixed(6);
  document.getElementById('maLng').value=pos[1].toFixed(6);
});
document.getElementById('maSubmit').addEventListener('click', async ()=>{
  const nama=document.getElementById('maNama').value.trim();
  const lat=parseFloat(document.getElementById('maLat').value);
  const lng=parseFloat(document.getElementById('maLng').value);
  const alamat=document.getElementById('maAlamat').value.trim();
  if(!nama || isNaN(lat) || isNaN(lng) || !alamat){
    alert('Nama, koordinat (lat & lng), dan alamat wajib diisi.');
    return;
  }
  const btn=document.getElementById('maSubmit');
  btn.disabled=true; btn.textContent='Menyimpan...';
  const entryInput={
    type:document.getElementById('maType').value,
    name:nama, lat, lng, alamat,
    telp:document.getElementById('maTelp').value.trim()||null,
    status:document.getElementById('maStatus').value,
  };
  const saved = await FieldRadarDB.addManual(entryInput);
  btn.disabled=false; btn.textContent='Simpan Lokasi';
  if(!saved) return; // error sudah ditampilkan oleh FieldRadarDB.addManual
  targets.push(saved);
  renderRadarMarkers();
  renderNearby();
  renderBlastSearch();
  populateDestSelect();
  notifyTargetsChanged();
  ['maNama','maLat','maLng','maAlamat','maTelp'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('manualAddForm').classList.add('hidden');
});

/* ---------- Quick Blast (sekarang HANYA mode pencarian di seluruh
   database — mode "Area Terdekat" sudah dihapus sesuai permintaan) ---------- */
function renderBlastSearch(){
  const q=document.getElementById('blastSearch').value.trim().toLowerCase();
  const filtered = targets.filter(t=> !q || t.name.toLowerCase().includes(q) || (t.alamat||'').toLowerCase().includes(q));
  const list=document.getElementById('blastList');
  if(filtered.length===0){ list.innerHTML='<p class="text-xs text-[#98A2B3]">Tidak ditemukan.</p>'; return; }
  list.innerHTML=filtered.slice(0,60).map(t=>`
    <label class="flex items-start gap-2 border border-[#EEF0F5] rounded-lg p-2 ${t.telp?'':'opacity-50'}">
      <input type="checkbox" class="blastAllCheck mt-1" value="${t.id}" ${t.telp?'':'disabled'}>
      <span>
        <span class="font-semibold text-[#101828]">${esc(t.name)}</span>
        <span class="block text-[11px] text-[#8A93A6]">${typeMeta[t.type]?typeMeta[t.type].label:t.type} · ${esc(t.alamat)} ${t.telp?'':'· nomor tidak tersedia'}</span>
      </span>
    </label>`).join('');
}
document.getElementById('blastSearch').addEventListener('input', renderBlastSearch);
document.getElementById('quickBlastBtn').addEventListener('click', ()=>{
  const ids=[...document.querySelectorAll('.blastAllCheck:checked')].map(c=>c.value);
  if(ids.length===0){ alert('Pilih minimal satu target (dengan nomor telepon) terlebih dahulu.'); return; }
  const msg=document.getElementById('blastTemplate').value;
  ids.forEach(id=>{
    const t=targets.find(x=>String(x.id)===String(id));
    if(t && t.telp) window.open(`https://wa.me/${t.telp}?text=${encodeURIComponent(msg)}`,'_blank');
  });
});

document.getElementById('smartRouteBtn') && (document.getElementById('smartRouteBtn').disabled=true);
initTargets();
