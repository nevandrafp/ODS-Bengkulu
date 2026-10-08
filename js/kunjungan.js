/* =========================================================================
   DATA KUNJUNGAN (berlaku untuk SEMUA objek: Sekolah, Balai, UMKM, Merchant;
   baik Top Down maupun Bottom Up). Diisi manual oleh PIC yang berkunjung:
   PIC kunjungan, tanggal kunjungan, PIC objek + kontaknya, foto dokumentasi.
   Dibuka dari popup tag di peta (Field Radar) dan tabel Database UMKM.
   ========================================================================= */

let kjCurrentId = null;
let kjPhotoDataUrl = null; // foto baru yang dipilih (sudah dikompres)

/* Kompres foto di browser (maks 1280px, JPEG) supaya upload cepat & hemat storage. */
function compressImageFile(file, maxDim=1280, quality=0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('Gagal membaca file.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('File bukan gambar yang valid.'));
      img.onload = ()=>{
        const scale = Math.min(1, maxDim/Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openKunjunganModal(id){
  const t = targets.find(x=>String(x.id)===String(id));
  if(!t) return;
  kjCurrentId = t.id; kjPhotoDataUrl = null;
  const user = (typeof getSessionUser==='function' && getSessionUser()) || null;
  document.getElementById('kjSub').textContent = `${t.name} · ${typeMeta[t.type]?typeMeta[t.type].label:t.type} · ${sourceLabel(t.source)}`;
  document.getElementById('kjPicKunjungan').value = t.pic_kunjungan || (user ? (user.nama||user.nip) : '');
  document.getElementById('kjTgl').value = t.tgl_kunjungan || new Date().toISOString().slice(0,10);
  document.getElementById('kjPicObjek').value = t.pic_objek || '';
  document.getElementById('kjKontak').value = t.kontak_pic_objek || '';
  document.getElementById('kjStatus').value = t.status || 'belum';
  document.getElementById('kjFoto').value = '';
  const prev = document.getElementById('kjPreview');
  if(t.dokumentasi_url){ prev.src = t.dokumentasi_url; prev.classList.remove('hidden'); }
  else { prev.removeAttribute('src'); prev.classList.add('hidden'); }
  document.getElementById('kjError').classList.add('hidden');
  document.getElementById('kjModal').classList.remove('hidden');
}
function closeKunjunganModal(){ document.getElementById('kjModal').classList.add('hidden'); kjCurrentId=null; }
window.openKunjunganModal = openKunjunganModal;

document.getElementById('kjClose').addEventListener('click', closeKunjunganModal);
document.getElementById('kjModal').addEventListener('click', e=>{ if(e.target.id==='kjModal') closeKunjunganModal(); });
document.getElementById('kjFoto').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  const errEl = document.getElementById('kjError');
  errEl.classList.add('hidden');
  if(!file){ kjPhotoDataUrl=null; return; }
  try{
    kjPhotoDataUrl = await compressImageFile(file);
    const prev = document.getElementById('kjPreview');
    prev.src = kjPhotoDataUrl; prev.classList.remove('hidden');
  }catch(err){
    kjPhotoDataUrl = null;
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  }
});
document.getElementById('kjSave').addEventListener('click', async ()=>{
  const t = targets.find(x=>String(x.id)===String(kjCurrentId));
  if(!t) return;
  const errEl = document.getElementById('kjError');
  const pic = document.getElementById('kjPicKunjungan').value.trim();
  const tgl = document.getElementById('kjTgl').value;
  if(!pic || !tgl){ errEl.textContent='PIC yang berkunjung dan tanggal kunjungan wajib diisi.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');

  const btn = document.getElementById('kjSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const fields = {
    pic_kunjungan: pic,
    tgl_kunjungan: tgl,
    pic_objek: document.getElementById('kjPicObjek').value.trim() || null,
    kontak_pic_objek: document.getElementById('kjKontak').value.trim() || null,
    status: document.getElementById('kjStatus').value,
  };
  if(kjPhotoDataUrl){
    const url = await uploadKunjunganPhoto(kjPhotoDataUrl, t.name);
    if(!url){ btn.disabled=false; btn.textContent='Simpan Data Kunjungan'; return; } // error sudah ditampilkan
    fields.dokumentasi_url = url;
  }
  const saved = await FieldRadarDB.updateLocation(t.id, fields);
  btn.disabled = false; btn.textContent = 'Simpan Data Kunjungan';
  if(!saved) return;
  Object.assign(t, fields);
  closeKunjunganModal();
  refreshAfterTargetChange();
});
