/* =========================================================================
   OUTBRANCH DELIVERY SYSTEM (ODS) WIZARD
   - Produk: Tabungan Pelajar + 3P+i (Payroll, Pebisnis, Prioritas, Individu).
   - Wizard sekarang cuma 2 langkah: (1) Pilih Produk, (2) Entry Data —
     lalu langsung "Selesai". Fitur verifikasi wajah, tanda tangan digital,
     QR login nasabah, dan foto/upload dokumen (KTP/KK/Akta/KIA) sudah
     dihapus seluruhnya.
   - Seluruh data disimpan ke database (Supabase: tabel ods_submissions),
     sehingga muncul lengkap di Riwayat & saat export Excel.
   ========================================================================= */

/* ---------- konfigurasi field per produk ----------
   Produk: Tabungan Pelajar + 3P+i (Payroll, Pebisnis, Prioritas, Individu).
   `col` = kolom tetap di tabel ods_submissions (nama, namaPendamping, nik, kk,
   alamat, tempatLahir, tanggalLahir, telp, email). Field TANPA `col` disimpan
   di kolom jsonb `extra` (label -> isi) dan ikut tampil saat export Excel. */
const F = {
  nama:    (label='Nama Lengkap')=>({id:'ndNama',    label, type:'text', col:'nama'}),
  nik:     ()=>({id:'ndNik',     label:'NIK',            type:'text', col:'nik'}),
  kk:      ()=>({id:'ndKk',      label:'Nomor KK',       type:'text', col:'kk'}),
  tempat:  (label='Tempat Lahir')=>({id:'ndTempatLahir', label, type:'text', col:'tempatLahir'}),
  tgl:     (label='Tanggal Lahir')=>({id:'ndTglLahir',   label, type:'date', col:'tanggalLahir'}),
  telp:    (label='Nomor Telepon')=>({id:'ndTelp',       label, type:'tel',  col:'telp'}),
  email:   ()=>({id:'ndEmail',   label:'Email',          type:'text', col:'email'}),
  alamat:  (label='Alamat')=>({id:'ndAlamat', label, type:'textarea', span:2, col:'alamat'}),
};
const PRODUCT_CONFIG = {
  'Tabungan Pelajar': {
    fields: [
      {id:'ndNama',         label:'Nama Anak',                type:'text', col:'nama'},
      {id:'ndNamaOrtu',     label:'Nama Orang Tua',           type:'text', col:'namaPendamping'},
      F.nik(), F.kk(),
      F.tempat('Tempat Lahir Anak'), F.tgl('Tanggal Lahir Anak'),
      F.telp(), F.email(), F.alamat(),
    ],
  },
  'Individu': {
    fields: [
      F.nama(), F.nik(), F.kk(), F.tempat(), F.tgl(),
      {id:'ndPekerjaan', label:'Pekerjaan', type:'text'},
      F.telp(), F.email(), F.alamat(),
    ],
  },
  'Prioritas': {
    fields: [
      F.nama(), F.nik(), F.kk(), F.tempat(), F.tgl(),
      {id:'ndPekerjaan',   label:'Pekerjaan / Profesi',         type:'text'},
      {id:'ndSumberDana',  label:'Sumber Dana',                 type:'text'},
      {id:'ndDanaAwal',    label:'Estimasi Dana Awal (Rp)',     type:'number'},
      F.telp(), F.email(), F.alamat(),
    ],
  },
  'Pebisnis': {
    fields: [
      F.nama('Nama Pemilik Usaha'), F.nik(),
      {id:'ndNamaUsaha',   label:'Nama Usaha',                  type:'text'},
      {id:'ndJenisUsaha',  label:'Jenis Usaha',                 type:'text'},
      {id:'ndNpwp',        label:'NPWP',                        type:'text'},
      {id:'ndNib',         label:'NIB / Izin Usaha',            type:'text'},
      {id:'ndOmzet',       label:'Estimasi Omzet / Bulan (Rp)', type:'number'},
      F.telp(), F.email(), F.alamat('Alamat Usaha'),
    ],
  },
  'Payroll': {
    fields: [
      F.nama('Nama Perusahaan'),
      {id:'ndNpwp',        label:'NPWP Perusahaan',             type:'text'},
      {id:'ndNamaPic',     label:'Nama PIC / HRD',              type:'text'},
      {id:'ndJabatanPic',  label:'Jabatan PIC',                 type:'text'},
      {id:'ndJmlKaryawan', label:'Jumlah Karyawan',             type:'number'},
      {id:'ndTglGaji',     label:'Tanggal Gajian (tiap bulan)', type:'number'},
      F.telp('Nomor Telepon PIC'), F.email(), F.alamat('Alamat Perusahaan'),
    ],
  },
};

let odsData={product:null};

/* ---------- Step 2: field dibangun dinamis sesuai produk ---------- */
function buildStep2(product){
  const cfg = PRODUCT_CONFIG[product];
  const fieldsGrid = document.getElementById('ndFieldsGrid');
  fieldsGrid.innerHTML = cfg.fields.map(f=>{
    const spanClass = f.span===2 ? 'md:col-span-2' : '';
    const inputEl = f.type==='textarea'
      ? `<textarea rows="2" id="${f.id}" placeholder="${f.label}" required></textarea>`
      : `<input type="${f.type}" id="${f.id}" ${f.type==='number'?'min="0"':''} placeholder="${f.type==='date'?'':f.label}" required />`;
    return `<div class="${spanClass}"><label class="text-xs text-[#667085]">${f.label} *</label>${inputEl}</div>`;
  }).join('');
}

/* ---------- wizard navigation + validation (sekarang cuma 2 langkah) ---------- */
function showOdsStep(n){
  document.querySelectorAll('.ods-step').forEach(s=>s.classList.toggle('hidden', +s.dataset.step!==n));
  document.querySelectorAll('.step-dot').forEach(d=>d.classList.toggle('active', +d.dataset.step<=n));
}
function requiredFilled(ids){
  return ids.every(id=>{
    const el=document.getElementById(id);
    const ok=el.value.trim()!=='';
    el.classList.toggle('field-invalid', !ok);
    return ok;
  });
}
function validateStep(n){
  if(n===1){
    const ok=!!odsData.product;
    document.getElementById('prodError').classList.toggle('hidden', ok);
    return ok;
  }
  if(n===2){
    const cfg=PRODUCT_CONFIG[odsData.product];
    const ok=requiredFilled(cfg.fields.map(f=>f.id));
    document.getElementById('dataError').classList.toggle('hidden', ok);
    return ok;
  }
  return true;
}
document.querySelectorAll('.ods-next').forEach(btn=>btn.addEventListener('click', ()=>{
  const cur=+btn.closest('.ods-step').dataset.step;
  if(!validateStep(cur)) return;
  showOdsStep(cur+1);
}));
document.querySelectorAll('.ods-back').forEach(btn=>btn.addEventListener('click', ()=>{
  const cur=+btn.closest('.ods-step').dataset.step;
  showOdsStep(cur-1);
}));
document.querySelectorAll('.prod-card').forEach(card=>card.addEventListener('click', ()=>{
  document.querySelectorAll('.prod-card').forEach(c=>c.classList.remove('border-[var(--navy)]'));
  card.classList.add('border-[var(--navy)]');
  odsData.product=card.dataset.prod;
  document.getElementById('prodError').classList.add('hidden');
  buildStep2(odsData.product);
}));

/* ---------- Riwayat + Export to Excel ----------
   Riwayat pengajuan (termasuk URL gambar dokumen) disimpan di Supabase
   (tabel ods_submissions + Storage) — lihat js/supabase-client.js —
   sehingga semua perangkat/browser melihat riwayat yang sama, dan export
   Excel menyertakan semua data + tautan gambarnya. */
let odsHistoryCache=[];
async function renderOdsHistory(){
  odsHistoryCache = await OdsDB.loadHistory();
  const tbody=document.querySelector('#odsHistoryTable tbody');
  document.getElementById('odsHistoryEmpty').classList.toggle('hidden', odsHistoryCache.length>0);
  tbody.innerHTML=odsHistoryCache.map(r=>`
    <tr class="border-t border-[#F0F2F6]">
      <td class="py-2 px-2 text-[#475467]">${esc(r.sessionId)}</td>
      <td class="py-2 px-2 text-[#475467]">${esc(r.product)}</td>
      <td class="py-2 px-2 font-semibold text-[#101828]">${esc(r.nama)}</td>
      <td class="py-2 px-2 text-[#475467]">${esc(r.nik)||'-'}</td>
      <td class="py-2 px-2 text-[#475467]">${esc(r.telp)}</td>
      <td class="py-2 px-2 text-[#475467]">${esc(r.waktu)}</td>
    </tr>`).join('');
}
document.getElementById('odsExportBtn').addEventListener('click', ()=>{
  if(odsHistoryCache.length===0){ alert('Belum ada data untuk diexport.'); return; }
  const ws=XLSX.utils.json_to_sheet(odsHistoryCache.map(r=>({
    'Session ID':r.sessionId, 'Produk':r.product, 'Nama':r.nama, 'Nama Pendamping (Ortu)':r.namaPendamping||'',
    'NIK':r.nik||'', 'No. KK':r.kk||'', 'Tempat Lahir':r.tempatLahir||'', 'Tanggal Lahir':r.tanggalLahir||'',
    'Telepon':r.telp, 'Email':r.email, 'Alamat':r.alamat, 'Waktu':r.waktu,
    ...(r.extra||{}),   // kolom khusus produk (mis. Nama Usaha, NPWP, Jumlah Karyawan, ...)
  })));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Riwayat ODS');
  XLSX.writeFile(wb, `riwayat-ods-${new Date().toISOString().slice(0,10)}.xlsx`);
});
renderOdsHistory();
OdsDB.subscribe(renderOdsHistory);

/* ---------- Selesai: simpan record data nasabah ---------- */
document.getElementById('odsFinishBtn').addEventListener('click', async ()=>{
  if(!validateStep(2)) return;
  const btn=document.getElementById('odsFinishBtn');
  btn.disabled=true; btn.textContent='Menyimpan...';

  const cfg = PRODUCT_CONFIG[odsData.product];
  const sessionId = 'OBS-'+Math.random().toString(36).slice(2,10).toUpperCase();
  const record={ sessionId, product:odsData.product, documents:{}, extra:{}, waktu:new Date().toLocaleString('id-ID') };
  cfg.fields.forEach(f=>{
    const val = document.getElementById(f.id).value;
    if(f.col) record[f.col] = val; else record.extra[f.label] = val;
  });
  await OdsDB.addSubmission(record);
  await renderOdsHistory();
  btn.disabled=false; btn.textContent='Selesai';
  alert('Proses pembukaan rekening selesai dan terkirim ke sistem BDS.');

  // reset wizard
  odsData={product:null};
  document.querySelectorAll('.prod-card').forEach(c=>c.classList.remove('border-[var(--navy)]'));
  document.getElementById('ndFieldsGrid').innerHTML='';
  showOdsStep(1);
});
