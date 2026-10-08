/* =========================================================================
   SUPABASE CLIENT — SHARED DATABASE (menggantikan localStorage)
   =========================================================================
   CARA SETUP (sekali saja):
   1. Buat project gratis di https://supabase.com (Sign up > New Project).
   2. Buka menu "SQL Editor" di dashboard Supabase, jalankan seluruh isi file
      data/supabase-schema.sql (sudah disediakan) — ini membuat tabel
      field_radar_locations, ods_submissions, dan bucket Storage
      "ods-documents" untuk gambar KTP/KK/Akta/KIA/foto wajah/tanda tangan.
   3. Import data lokasi (Field Radar) dari masterdata.xlsx sekali lewat
      scripts/import-masterdata.js (lihat README di folder scripts/).
   4. Buka "Project Settings" > "API". Salin "Project URL" dan
      "anon public" key, lalu tempelkan di dua konstanta di bawah ini.
   5. Deploy ulang / refresh — selesai, data akan otomatis tersinkron ke
      semua browser & perangkat.
   ========================================================================= */

const SUPABASE_URL = 'https://cienblzcibkwsqivlowf.supabase.co'; // <- ganti dengan Project URL Anda
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZW5ibHpjaWJrd3NxaXZsb3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMjk3MzIsImV4cCI6MjEwMzgwNTczMn0.gyxpYTqr_kgejz5fxQ6H8KddtyMX69CvkY7qM4rYbFI';             // <- ganti dengan anon public key Anda

const supabaseConfigured = !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON-PUBLIC-KEY');

let sb = null;
if (supabaseConfigured && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('[Supabase] Belum dikonfigurasi — lihat js/supabase-client.js. Sementara memakai localStorage sebagai cadangan lokal (tidak tersinkron antar perangkat, dan gambar ODS tidak benar-benar terupload).');
}

function showDbBanner(msg){
  let el = document.getElementById('dbConfigBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'dbConfigBanner';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#B42318;color:#fff;font-size:12px;padding:8px 16px;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}
if(!supabaseConfigured){
  window.addEventListener('DOMContentLoaded', ()=>{
    showDbBanner('⚠ Database bersama belum dikonfigurasi (lihat js/supabase-client.js) — data hanya tersimpan lokal di browser ini.');
  });
}

/* ---------- Field Radar: SATU tabel gabungan (import + manual + UMKM) ---------- */
const UMKM_EXTRA_FIELDS = ['pemilik','jenis_usaha','omzet_bulanan','catatan','pic_kunjungan','tgl_kunjungan','pic_objek','kontak_pic_objek','dokumentasi_url'];
function rowToTarget(r){
  return {
    id:r.id, type:r.type, name:r.name, lat:r.lat, lng:r.lng, alamat:r.alamat, telp:r.telp,
    status:r.status, source:r.source,
    pemilik:r.pemilik||null, jenis_usaha:r.jenis_usaha||null,
    omzet_bulanan:(r.omzet_bulanan===undefined?null:r.omzet_bulanan), catatan:r.catatan||null,
    pic_kunjungan:r.pic_kunjungan||null, tgl_kunjungan:r.tgl_kunjungan||null,
    pic_objek:r.pic_objek||null, kontak_pic_objek:r.kontak_pic_objek||null, dokumentasi_url:r.dokumentasi_url||null,
  };
}
const FieldRadarDB = {
  async loadAll(){
    if(!sb) return JSON.parse(localStorage.getItem('fieldRadarLocations')||'[]');
    /* PostgREST (Supabase) membatasi maksimal 1000 baris per request kalau
       tidak diminta eksplisit. Karena tabel ini berisi >1000 baris dan
       diurutkan per id (semua 'sekolah' punya id lebih kecil daripada
       'balai', hasil import masterdata.xlsx), request tanpa pagination
       hanya akan mengembalikan 1000 baris pertama — yang semuanya
       'sekolah' — sehingga 'balai' tidak pernah sampai ke browser. Maka
       di sini kita fetch per halaman 1000 baris sampai habis. */
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while(true){
      const { data, error } = await sb.from('field_radar_locations')
        .select('*')
        .order('id', { ascending:true })
        .range(from, from + PAGE_SIZE - 1);
      if(error){ console.error(error); break; }
      all = all.concat(data);
      if(data.length < PAGE_SIZE) break; // halaman terakhir
      from += PAGE_SIZE;
    }
    return all.map(rowToTarget);
  },
  async addManual(entry){
    /* Kolom khusus UMKM (pemilik, jenis_usaha, omzet_bulanan, catatan) hanya
       dikirim kalau terisi, supaya tambah lokasi Sekolah/Balai tetap jalan
       walau migrasi UMKM belum dijalankan. */
    const extras = {};
    UMKM_EXTRA_FIELDS.forEach(k=>{ if(entry[k]!==undefined && entry[k]!==null && entry[k]!=='') extras[k]=entry[k]; });
    if(!sb){
      const list = JSON.parse(localStorage.getItem('fieldRadarLocations')||'[]');
      const withId = { ...entry, source:'manual', id: 'local-'+Date.now() };
      list.push(withId);
      localStorage.setItem('fieldRadarLocations', JSON.stringify(list));
      return withId;
    }
    const { data, error } = await sb.from('field_radar_locations').insert({
      type: entry.type, name: entry.name, lat: entry.lat, lng: entry.lng,
      alamat: entry.alamat, telp: entry.telp, status: entry.status, source: 'manual', ...extras,
    }).select().single();
    if(error){ console.error(error); alert('Gagal menyimpan ke database: '+error.message); return null; }
    return rowToTarget(data);
  },
  /* Ubah banyak kolom sekaligus (dipakai menu Database UMKM). Nama key
     sama dengan nama kolom tabel. Mengembalikan target terbaru / null. */
  async updateLocation(id, fields){
    if(!sb){
      const list = JSON.parse(localStorage.getItem('fieldRadarLocations')||'[]');
      const t = list.find(x=>String(x.id)===String(id));
      if(!t) return null;
      Object.assign(t, fields);
      localStorage.setItem('fieldRadarLocations', JSON.stringify(list));
      return t;
    }
    const { data, error } = await sb.from('field_radar_locations').update(fields).eq('id', id).select().single();
    if(error){ console.error(error); alert('Gagal memperbarui database: '+error.message); return null; }
    return rowToTarget(data);
  },
  /* Hapus lokasi (policy RLS hanya mengizinkan hapus baris type='umkm'). */
  async remove(id){
    if(!sb){
      const list = JSON.parse(localStorage.getItem('fieldRadarLocations')||'[]');
      localStorage.setItem('fieldRadarLocations', JSON.stringify(list.filter(x=>String(x.id)!==String(id))));
      return true;
    }
    const { data, error } = await sb.from('field_radar_locations').delete().eq('id', id).select();
    if(error){ console.error(error); alert('Gagal menghapus: '+error.message); return false; }
    if(!data || data.length===0){ alert('Data tidak terhapus. Pastikan data/migration-umkm.sql sudah dijalankan di Supabase (policy hapus UMKM).'); return false; }
    return true;
  },
  /* Dipakai oleh popup di peta (Mapping Wilayah) untuk mengubah status
     langsung dari tag lokasi, tersimpan permanen ke database. */
  async updateStatus(id, status){
    if(!sb){
      const list = JSON.parse(localStorage.getItem('fieldRadarLocations')||'[]');
      const t = list.find(x=>String(x.id)===String(id));
      if(t){ t.status=status; localStorage.setItem('fieldRadarLocations', JSON.stringify(list)); }
      return;
    }
    const { error } = await sb.from('field_radar_locations').update({ status }).eq('id', id);
    if(error) console.error(error);
  },
  /* Live sync: kalau ada rekan tim mengubah data dari perangkat lain,
     peta ini otomatis ikut update tanpa perlu refresh manual. */
  subscribe(onChange){
    if(!sb) return;
    sb.channel('field_radar_locations_changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'field_radar_locations' }, onChange)
      .subscribe();
  },
};

/* ---------- Login pegawai (NIP + password, tabel app_users) ----------
   CATATAN KEAMANAN: pengecekan password dilakukan dengan query langsung
   dari browser memakai anon key (lihat catatan lengkap di
   data/supabase-schema.sql) — cukup untuk trial/internal, tapi bukan
   praktik aman untuk aplikasi publik. */
const AuthDB = {
  async login(nip, password){
    if(!sb) return { error: 'Database belum dikonfigurasi (lihat js/supabase-client.js).' };
    const { data, error } = await sb.from('app_users').select('nip,nama,password').eq('nip', nip).maybeSingle();
    if(error) return { error: 'Gagal menghubungi database: '+error.message };
    if(!data || data.password !== password) return { error: 'NIP atau password salah.' };
    return { user: { nip:data.nip, nama:data.nama||data.nip } };
  },
};
window.AuthDB = AuthDB;

/* ---------- ODS: storage upload helper (dokumen nasabah) ---------- */
function dataUrlToBlob(dataUrl){
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function sanitizeForPath(s){
  return (s||'unknown').toString().trim().replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'unknown';
}
/* Mengunggah 1 gambar dokumen (dataURL base64) ke bucket "ods-documents"
   dengan nama format PREFIX_(Nama)_(NIK).ext, lalu mengembalikan URL
   publiknya. Kalau Supabase belum dikonfigurasi, dataURL asli dikembalikan
   (fallback lokal). */
async function uploadOdsFile(prefix, dataUrl, nama, nik){
  if(!dataUrl) return null;
  if(!sb) return dataUrl;
  const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
  const path = `${prefix}_${sanitizeForPath(nama)}_${sanitizeForPath(nik)}_${Date.now()}.${ext}`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await sb.storage.from('ods-documents').upload(path, blob, { upsert:true, contentType: blob.type });
  if(error){ console.error(error); return null; }
  const { data } = sb.storage.from('ods-documents').getPublicUrl(path);
  return data.publicUrl;
}
window.uploadOdsFile = uploadOdsFile;

/* ---------- Foto dokumentasi kunjungan objek (bucket "kunjungan-docs") ---------- */
async function uploadKunjunganPhoto(dataUrl, objName){
  if(!dataUrl) return null;
  if(!sb) return dataUrl; // fallback lokal
  const path = `DOK_${sanitizeForPath(objName)}_${Date.now()}.jpg`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await sb.storage.from('kunjungan-docs').upload(path, blob, { upsert:true, contentType: blob.type });
  if(error){ console.error(error); alert('Gagal mengunggah foto dokumentasi: '+error.message+'\n(Pastikan data/migration-umkm.sql sudah dijalankan.)'); return null; }
  return sb.storage.from('kunjungan-docs').getPublicUrl(path).data.publicUrl;
}
window.uploadKunjunganPhoto = uploadKunjunganPhoto;

/* ---------- ODS: submission history (shared table) ---------- */
const OdsDB = {
  async loadHistory(){
    if(!sb) return JSON.parse(localStorage.getItem('odsSubmissions')||'[]');
    const { data, error } = await sb.from('ods_submissions').select('*').order('created_at', { ascending:false });
    if(error){ console.error(error); return []; }
    return data.map(r=>({
      sessionId:r.session_id, product:r.product, nama:r.nama, namaPendamping:r.nama_pendamping,
      nik:r.nik, kk:r.kk, alamat:r.alamat, tempatLahir:r.tempat_lahir, tanggalLahir:r.tanggal_lahir,
      telp:r.telp, email:r.email, documents:r.documents||{}, extra:r.extra||{}, waktu:r.waktu,
    }));
  },
  async addSubmission(record){
    if(!sb){
      const rows = JSON.parse(localStorage.getItem('odsSubmissions')||'[]');
      rows.unshift(record);
      localStorage.setItem('odsSubmissions', JSON.stringify(rows));
      return;
    }
    const { error } = await sb.from('ods_submissions').insert({
      session_id: record.sessionId, product: record.product, nama: record.nama,
      nama_pendamping: record.namaPendamping, nik: record.nik, kk: record.kk,
      alamat: record.alamat, tempat_lahir: record.tempatLahir, tanggal_lahir: record.tanggalLahir,
      telp: record.telp, email: record.email, documents: record.documents, waktu: record.waktu,
      // kolom extra hanya dikirim bila ada (produk baru) agar Tabungan Pelajar tetap jalan sebelum migrasi
      ...(record.extra && Object.keys(record.extra).length ? { extra: record.extra } : {}),
    });
    if(error){ console.error(error); alert('Gagal menyimpan ke database: '+error.message); }
  },
  subscribe(onChange){
    if(!sb) return;
    sb.channel('ods_submissions_changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'ods_submissions' }, onChange)
      .subscribe();
  },
};
