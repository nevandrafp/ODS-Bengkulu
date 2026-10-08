/* =========================================================================
   DATABASE UMKM
   UMKM disimpan di tabel yang sama dengan objek Field Radar
   (field_radar_locations, type='umkm'), jadi otomatis tampil di peta dengan
   ikon UMKM (toko), Nearby Target, Quick Blast, dan Smart Route.
   - Top Down  (source='import') : data otomatis dari masterdata
   - Bottom Up (source='manual') : diinput manual lewat form di halaman ini
   Data kunjungan diisi lewat js/kunjungan.js.
   ========================================================================= */

const UM_PAGE_SIZE = 25;
let umPage = 1;
let umEditingId = null;

function umAll(){ return targets.filter(t=>t.type==='umkm'); }
function umFiltered(){
  const q = document.getElementById('umSearch').value.trim().toLowerCase();
  const jenis = document.getElementById('umFilterJenis').value;
  const st = document.getElementById('umFilterStatus').value;
  const src = document.getElementById('umFilterSource').value;
  return umAll().filter(t=>
    (!q || [t.name,t.pemilik,t.alamat].some(v=>(v||'').toLowerCase().includes(q))) &&
    (!jenis || t.jenis_usaha===jenis) &&
    (!st || t.status===st) &&
    (!src || (src==='manual' ? t.source==='manual' : t.source!=='manual'))
  );
}
function rupiah(n){ return (n==null||n==='') ? '-' : 'Rp '+Number(n).toLocaleString('id-ID'); }

function renderUmkmStats(){
  const all = umAll();
  const cards = [
    ['Total UMKM', all.length, '#0D9488'],
    ['Top Down (otomatis)', all.filter(t=>t.source!=='manual').length, '#1D4ED8'],
    ['Bottom Up (manual)', all.filter(t=>t.source==='manual').length, '#B45309'],
    ['Sudah dikunjungi', all.filter(t=>t.status==='sudah').length, '#16A34A'],
  ];
  document.getElementById('umStats').innerHTML = cards.map(([l,v,c])=>`
    <div class="card p-4"><div class="text-xs text-[#667085]">${l}</div><div class="text-2xl font-bold mt-1" style="color:${c}">${v}</div></div>`).join('');
}
function renderUmkmJenisOptions(){
  const sel = document.getElementById('umFilterJenis');
  const cur = sel.value;
  const jenis = [...new Set(umAll().map(t=>t.jenis_usaha).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Semua jenis usaha</option>' + jenis.map(j=>`<option value="${esc(j)}">${esc(j)}</option>`).join('');
  sel.value = jenis.includes(cur) ? cur : '';
}

function renderUmkmTable(){
  renderUmkmStats();
  renderUmkmJenisOptions();
  const rows = umFiltered();
  const pages = Math.max(1, Math.ceil(rows.length/UM_PAGE_SIZE));
  if(umPage>pages) umPage = pages;
  const slice = rows.slice((umPage-1)*UM_PAGE_SIZE, umPage*UM_PAGE_SIZE);
  document.getElementById('umEmpty').classList.toggle('hidden', rows.length>0);
  document.querySelector('#umTable tbody').innerHTML = slice.map(t=>{
    const manual = t.source==='manual';
    return `<tr class="border-t border-[#F0F2F6] align-top">
      <td class="py-2 px-2"><div class="font-semibold text-[#101828]">${esc(t.name)}</div>
        <div class="text-[11px] text-[#8A93A6]">${esc(t.pemilik)||'-'}</div>
        <div class="text-[11px] text-[#98A2B3] max-w-[240px] truncate" title="${esc(t.alamat)}">${esc(t.alamat)}</div></td>
      <td class="py-2 px-2 text-[#475467]">${esc(t.jenis_usaha)||'-'}</td>
      <td class="py-2 px-2 text-[#475467] whitespace-nowrap">${esc(t.telp)||'-'}</td>
      <td class="py-2 px-2 text-[#475467] whitespace-nowrap">${rupiah(t.omzet_bulanan)}</td>
      <td class="py-2 px-2"><span class="pill ${manual?'bg-[#FEF3C7] text-[#92400E]':'bg-[#DBEAFE] text-[#1E40AF]'}">${sourceLabel(t.source)}</span></td>
      <td class="py-2 px-2 whitespace-nowrap"><span class="status-dot status-${t.status}"></span>${statusMeta[t.status]?statusMeta[t.status].label:esc(t.status)}</td>
      <td class="py-2 px-2 text-[#475467] text-xs whitespace-nowrap">${esc(t.pic_kunjungan)||'<span class="text-[#98A2B3]">-</span>'}<br/>${fmtTgl(t.tgl_kunjungan)}</td>
      <td class="py-2 px-2 text-[#475467] text-xs whitespace-nowrap">${esc(t.pic_objek)||'<span class="text-[#98A2B3]">-</span>'}<br/>${esc(t.kontak_pic_objek)}</td>
      <td class="py-2 px-2">${t.dokumentasi_url?`<a href="${esc(t.dokumentasi_url)}" target="_blank" rel="noopener"><img src="${esc(t.dokumentasi_url)}" class="w-10 h-10 object-cover rounded border border-[#E3E6EE]" alt="Dokumentasi" /></a>`:'<span class="text-[#98A2B3] text-xs">-</span>'}</td>
      <td class="py-2 px-2 whitespace-nowrap text-xs font-semibold">
        <button class="umAct text-[#0D9488] mr-2" data-act="kj" data-id="${t.id}">Kunjungan</button>
        <button class="umAct text-[var(--navy)] mr-2" data-act="map" data-id="${t.id}">Peta</button>
        <button class="umAct text-[#475467] mr-2" data-act="edit" data-id="${t.id}">Edit</button>
        <button class="umAct text-[#DC2626]" data-act="del" data-id="${t.id}">Hapus</button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('umCount').textContent = `${rows.length} UMKM · halaman ${umPage}/${pages}`;
  document.getElementById('umPrev').disabled = umPage<=1;
  document.getElementById('umNext').disabled = umPage>=pages;
}
window.renderUmkmTable = renderUmkmTable;
window.addEventListener('targets-changed', ()=>{
  if(!document.getElementById('page-umkm').classList.contains('hidden')) renderUmkmTable();
  else renderUmkmStats();
});

['umSearch','umFilterJenis','umFilterStatus','umFilterSource'].forEach(id=>
  document.getElementById(id).addEventListener(id==='umSearch'?'input':'change', ()=>{ umPage=1; renderUmkmTable(); }));
document.getElementById('umPrev').addEventListener('click', ()=>{ umPage--; renderUmkmTable(); });
document.getElementById('umNext').addEventListener('click', ()=>{ umPage++; renderUmkmTable(); });

/* ---------- aksi baris ---------- */
document.querySelector('#umTable tbody').addEventListener('click', async (e)=>{
  const btn = e.target.closest('.umAct');
  if(!btn) return;
  const t = targets.find(x=>String(x.id)===btn.dataset.id);
  if(!t) return;
  if(btn.dataset.act==='kj') openKunjunganModal(t.id);
  if(btn.dataset.act==='edit') openUmkmModal(t);
  if(btn.dataset.act==='map') showUmkmOnMap(t);
  if(btn.dataset.act==='del'){
    if(!confirm(`Hapus UMKM "${t.name}" dari database? Tindakan ini tidak bisa dibatalkan.`)) return;
    if(await FieldRadarDB.remove(t.id)){
      targets = targets.filter(x=>String(x.id)!==String(t.id));
      refreshAfterTargetChange();
      renderUmkmTable();
    }
  }
});
function showUmkmOnMap(t){
  document.querySelector('[data-page="fos"]').click();
  document.querySelector('.subtab[data-sub="radar"]').click();
  const cb = document.querySelector('.typeFilter[value="umkm"]');
  if(!cb.checked){ cb.checked = true; renderRadarMarkers(); }
  document.getElementById('sourceFilter').value = 'all';
  setTimeout(()=>{
    radarMap.setView([t.lat,t.lng], 18);
    if(targetMarkers[t.id]) targetMarkers[t.id].openPopup();
  }, 150);
}

/* ---------- tambah / edit ---------- */
const UM_FIELD_IDS = ['umNama','umPemilik','umJenis','umTelp','umOmzet','umAlamat','umLat','umLng','umCatatan'];
function openUmkmModal(t){
  umEditingId = t ? t.id : null;
  document.getElementById('umModalTitle').textContent = t ? 'Edit UMKM' : 'Tambah UMKM';
  document.getElementById('umModalSub').textContent = t ? `Sumber: ${sourceLabel(t.source)}` : 'Data baru berstatus Bottom Up (manual).';
  const v = t || {};
  document.getElementById('umNama').value = v.name||'';
  document.getElementById('umPemilik').value = v.pemilik||'';
  document.getElementById('umJenis').value = v.jenis_usaha||'';
  document.getElementById('umTelp').value = v.telp||'';
  document.getElementById('umOmzet').value = v.omzet_bulanan==null ? '' : v.omzet_bulanan;
  document.getElementById('umAlamat').value = v.alamat||'';
  document.getElementById('umLat').value = v.lat==null ? '' : v.lat;
  document.getElementById('umLng').value = v.lng==null ? '' : v.lng;
  document.getElementById('umStatus').value = v.status||'belum';
  document.getElementById('umCatatan').value = v.catatan||'';
  UM_FIELD_IDS.forEach(id=>document.getElementById(id).classList.remove('field-invalid'));
  document.getElementById('umError').classList.add('hidden');
  document.getElementById('umModal').classList.remove('hidden');
}
function closeUmkmModal(){ document.getElementById('umModal').classList.add('hidden'); umEditingId=null; }
document.getElementById('umAddBtn').addEventListener('click', ()=>openUmkmModal(null));
document.getElementById('umClose').addEventListener('click', closeUmkmModal);
document.getElementById('umModal').addEventListener('click', e=>{ if(e.target.id==='umModal') closeUmkmModal(); });
document.getElementById('umUseGps').addEventListener('click', ()=>{
  const setPos = p=>{
    document.getElementById('umLat').value = p[0].toFixed(6);
    document.getElementById('umLng').value = p[1].toFixed(6);
  };
  if(GeoService.getLast()){ setPos(GeoService.getLast()); return; }
  if(!navigator.geolocation){ alert('Perangkat/browser tidak mendukung geolocation.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>setPos([pos.coords.latitude, pos.coords.longitude]),
    err=>alert('Tidak dapat mengakses lokasi GPS: '+err.message),
    { enableHighAccuracy:true, timeout:15000 });
});
document.getElementById('umSave').addEventListener('click', async ()=>{
  const g = id=>document.getElementById(id).value.trim();
  const lat = parseFloat(g('umLat')), lng = parseFloat(g('umLng'));
  const required = { umNama:g('umNama'), umAlamat:g('umAlamat'), umLat:isNaN(lat)?'':'ok', umLng:isNaN(lng)?'':'ok' };
  let ok = true;
  Object.entries(required).forEach(([id,val])=>{
    const bad = !val;
    document.getElementById(id).classList.toggle('field-invalid', bad);
    if(bad) ok = false;
  });
  const errEl = document.getElementById('umError');
  if(!ok){ errEl.textContent='Nama usaha, alamat, dan koordinat (lat & lng) wajib diisi.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');

  const omzet = g('umOmzet');
  const fields = {
    name:g('umNama'), pemilik:g('umPemilik')||null, jenis_usaha:g('umJenis')||null,
    telp:g('umTelp')||null, omzet_bulanan: omzet===''?null:Number(omzet),
    alamat:g('umAlamat'), lat, lng, status:document.getElementById('umStatus').value,
    catatan:g('umCatatan')||null,
  };
  const btn = document.getElementById('umSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  if(umEditingId==null){
    const saved = await FieldRadarDB.addManual({ type:'umkm', ...fields });
    if(saved) targets.push(saved); else { btn.disabled=false; btn.textContent='Simpan'; return; }
  }else{
    const saved = await FieldRadarDB.updateLocation(umEditingId, fields);
    if(!saved){ btn.disabled=false; btn.textContent='Simpan'; return; }
    const t = targets.find(x=>String(x.id)===String(umEditingId));
    if(t) Object.assign(t, fields);
  }
  btn.disabled = false; btn.textContent = 'Simpan';
  closeUmkmModal();
  refreshAfterTargetChange();
  renderUmkmTable();
});

/* ---------- export Excel ---------- */
document.getElementById('umExportBtn').addEventListener('click', ()=>{
  const rows = umFiltered();
  if(rows.length===0){ alert('Belum ada data untuk diexport.'); return; }
  const ws = XLSX.utils.json_to_sheet(rows.map(t=>({
    'Nama Usaha':t.name, 'Pemilik':t.pemilik||'', 'Jenis Usaha':t.jenis_usaha||'', 'Telepon':t.telp||'',
    'Alamat':t.alamat||'', 'Latitude':t.lat, 'Longitude':t.lng, 'Omzet/Bulan (Rp)':t.omzet_bulanan==null?'':t.omzet_bulanan,
    'Sumber':sourceLabel(t.source), 'Status':statusMeta[t.status]?statusMeta[t.status].label:t.status,
    'PIC Kunjungan':t.pic_kunjungan||'', 'Tgl Kunjungan':t.tgl_kunjungan||'',
    'PIC Objek':t.pic_objek||'', 'Kontak PIC Objek':t.kontak_pic_objek||'',
    'Dokumentasi (URL)':t.dokumentasi_url&&!t.dokumentasi_url.startsWith('data:')?t.dokumentasi_url:(t.dokumentasi_url?'(tersimpan lokal)':''),
    'Catatan':t.catatan||'',
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Database UMKM');
  XLSX.writeFile(wb, `database-umkm-${new Date().toISOString().slice(0,10)}.xlsx`);
});
