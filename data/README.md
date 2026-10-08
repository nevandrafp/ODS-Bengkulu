# Database Field Radar & ODS (Supabase)

Field Radar sudah **tidak lagi membaca file CSV** di folder ini. Sekarang
seluruh tag lokasi (Sekolah & Balai RT/RW) disimpan di **satu tabel Supabase**
bernama `field_radar_locations`, diisi dari `masterdata.xlsx` lewat script
`scripts/import-masterdata.js`, dan status kunjungan bisa diubah langsung
dari peta (tersimpan permanen ke tabel yang sama).

## Setup sekali saja

1. Buat akun & project gratis di https://supabase.com.
2. Buka **SQL Editor** di dashboard project Anda, tempel & jalankan **seluruh
   isi** file `data/supabase-schema.sql` (ada di folder ini) — ini membuat:
   - tabel `field_radar_locations` (seluruh tag lokasi Field Radar)
   - tabel `ods_submissions` (riwayat pengajuan ODS lengkap dengan gambar)
   - bucket Storage `ods-documents` (tempat gambar KTP/KK/Akta/KIA/foto
     wajah/tanda tangan ODS disimpan)
3. Buka **Project Settings → API**, salin **Project URL**, **anon public
   key**, dan **service_role key** (3 nilai, jangan sampai tertukar).
4. Buka `js/supabase-client.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`
   dengan **Project URL** dan **anon public key** dari langkah 3.
5. Import data lokasi dari `masterdata.xlsx` (lihat `scripts/README` di
   bawah) — jalankan sekali dari komputer Anda, BUKAN dari browser.
6. Deploy ulang (atau refresh jika sudah live).

Selama `SUPABASE_URL`/`SUPABASE_ANON_KEY` belum diisi, aplikasi otomatis
memakai `localStorage` sebagai cadangan (akan muncul pita peringatan merah di
bawah layar) — supaya demo tetap jalan, tapi datanya tetap per-perangkat
sampai Supabase dikonfigurasi.

## Import lokasi dari masterdata.xlsx

Lihat `scripts/import-masterdata.js`. Ringkas:

```bash
cd scripts
npm install
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key... \
MASTERDATA_PATH=/path/ke/masterdata.xlsx \
node import-masterdata.js
```

Format kolom `masterdata.xlsx` yang dibaca (header harus sama persis):
`nam, type, lat, lng, alamat, telp, rat, ulasan`. Baris dengan `type` selain
`sekolah`/`balai` (misalnya `umkm`) otomatis dilewati karena segmentasi UMKM
sudah dihapus dari Field Radar.

Jalankan ulang script ini kapan pun `masterdata.xlsx` diperbarui — insert
bersifat tambahan (tidak menghapus data lama), jadi kalau ingin mengganti
total, kosongkan dulu tabel `field_radar_locations` lewat SQL Editor
(`truncate table field_radar_locations;`) sebelum import ulang.

## Lokasi tambahan manual & perubahan status dari peta

- Form **"Tambah Lokasi Manual"** di Field Radar menulis langsung ke tabel
  `field_radar_locations` (kolom `source='manual'`), sehingga tergabung
  otomatis dengan hasil import di peta, Nearby Target, dan Smart Route.
- Klik tag lokasi di peta (Mapping Wilayah) untuk membuka popup berisi
  dropdown status — memilih status baru langsung memanggil `updateStatus()`
  dan tersimpan ke database, terlihat oleh semua perangkat lain (live sync).

## Gambar ODS (dokumen, foto wajah, tanda tangan)

Disimpan ke bucket Storage `ods-documents` dengan format nama file:
`PREFIX_Nama_NIK_timestamp.ext`, misalnya `KTP_BudiSantoso_3171xxxx.jpg`,
`KK_BudiSantoso_3171xxxx.jpg`, `AKTA_...`, `KIA_...`, `FOTOWAJAH_...`,
`TTD_...`. URL publik masing-masing file disimpan di kolom `documents`
(jsonb), `face_photo_url`, dan `signature_url` pada tabel `ods_submissions`
— semuanya ikut muncul saat export ke Excel.
