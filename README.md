# Mandiri Outbranch Command Center

Website statis (Field Operation System/FOS, Outbranch Delivery System/ODS)
— tanpa proses build, semua library (Tailwind, Leaflet, QRCode, Lucide,
SheetJS, Supabase) dimuat lewat CDN.

> **Update terbaru (Catatan Update Dashboard)**
> - Lokasi: **KC S Parman (Area Bengkulu)**; area operasional **Kecamatan Ratu Agung, Kota Bengkulu**
>   (titik awal = Bank Mandiri KC Bengkulu S. Parman, `OFFICE` di `js/common.js`).
> - Jenis objek di peta: Balai RT/RW, Sekolah, **UMKM**, **Merchant** (masing-masing punya ikon sendiri).
> - Setiap objek dibedakan **Top Down** (data otomatis/import) vs **Bottom Up** (input manual):
>   badge di popup, filter sumber, dan titik kuning kecil di ikon peta untuk Bottom Up.
> - Setiap objek punya **data kunjungan** yang diisi manual oleh PIC: PIC kunjungan, tanggal
>   kunjungan, PIC objek + kontak, foto dokumentasi (popup tag -> "Isi / Ubah Data Kunjungan").
> - Menu baru **Database UMKM** (lihat `js/umkm.js`): tabel, cari/filter, tambah/edit/hapus,
>   tombol Kunjungan, lihat di peta, export Excel.
> - ODS: produk **Payroll, Pebisnis, Prioritas, Individu** (3P + i) ditambahkan di samping Tabungan Pelajar.
>
> **WAJIB:** jalankan `data/migration-umkm.sql` di Supabase SQL Editor (database yang sudah berjalan).
> Data `masterdata.xlsx` bawaan masih Jakarta Barat — ganti dengan data Kec. Ratu Agung lalu import ulang.

## Struktur folder

```
├── index.html                     ← shell halaman (sidebar, header, semua section)
├── css/
│   └── styles.css                 ← semua style
├── js/
│   ├── supabase-client.js          ← koneksi database bersama (Supabase) — isi kredensial di sini
│   ├── common.js                  ← navigasi, konstanta bersama, layanan GPS
│   ├── fos-field-radar.js          ← FOS: Field Radar
│   ├── fos-route.js                ← FOS: Smart Route Optimization
│   ├── kunjungan.js                ← modal data kunjungan (PIC, tanggal, kontak, foto) semua objek
│   ├── umkm.js                     ← menu Database UMKM
│   └── ods.js                      ← Outbranch Delivery System
├── data/
│   ├── migration-umkm.sql          ← jalankan sekali di database yang SUDAH berjalan (update ini)
│   ├── supabase-schema.sql         ← instalasi baru: jalankan sekali di Supabase SQL Editor untuk membuat tabel & storage bucket
│   └── README.md                   ← detail setup database bersama (Supabase) & import masterdata
├── scripts/
│   ├── import-masterdata.js        ← import masterdata.xlsx -> tabel field_radar_locations (jalan sekali via Node.js)
│   ├── masterdata.xlsx             ← salinan data lokasi (Sekolah & Balai) yang Anda berikan
│   └── package.json
└── assets/
    ├── logo_mandiri/               ← taruh logo-mandiri.png di sini
    ├── overlay/                    ← overlay_ktp.png, overlay_kk.png, overlay_akta.png, overlay_wajah.png
    └── icon_website/                ← favicon / ikon tab browser
```

## Menjalankan / mencoba secara lokal

Karena ini situs statis murni (tanpa build step), Anda cukup melayani folder
ini dengan server statis apa pun:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` (atau port yang ditampilkan). Fitur
kamera & GPS butuh **HTTPS** atau `localhost` — keduanya sudah didukung oleh
kedua cara di atas untuk keperluan development.

## Setup database (WAJIB sebelum data terlihat oleh tim)

Lihat `data/README.md` untuk langkah lengkap. Ringkasnya:
1. Jalankan `data/supabase-schema.sql` di Supabase SQL Editor.
2. Isi `SUPABASE_URL` & `SUPABASE_ANON_KEY` di `js/supabase-client.js`.
3. Jalankan `scripts/import-masterdata.js` sekali untuk mengisi Field Radar
   dari `masterdata.xlsx`.

Selama belum disetel, aplikasi otomatis jatuh ke `localStorage` (pita
peringatan merah muncul di bawah layar) supaya demo tetap bisa dicoba, tapi
data tidak tersinkron antar perangkat dan gambar ODS tidak benar-benar
terupload.

## Deploy ke Vercel

**Cara tercepat (drag & drop):**
1. Buka https://vercel.com/new
2. Drag seluruh folder ini (yang berisi `index.html`, `css/`, `js/`, `data/`, `assets/`) ke area upload.
3. Vercel otomatis mendeteksinya sebagai static site. Klik **Deploy**.

**Via Vercel CLI:**
```bash
npm i -g vercel
cd folder-ini
vercel --prod
```

**Via GitHub:**
1. Push seluruh folder ini ke repo GitHub baru (pertahankan struktur folder di atas).
2. Di Vercel dashboard → "Add New Project" → pilih repo tersebut → Deploy
   (framework preset: *Other*, tidak perlu ubah setting apapun).

> Catatan: folder `scripts/` (termasuk `masterdata.xlsx`) tidak perlu ikut
> di-deploy ke Vercel — itu hanya dijalankan sekali dari komputer Anda untuk
> mengisi database. Boleh dihapus dari repo produksi kalau mau, atau
> dibiarkan (tidak dipakai oleh situs statis saat runtime).

## Fitur

### Field Operation System

**Field Radar**
- Peta mengikuti lokasi GPS perangkat — tombol **"Ikuti Lokasi Saya"**.
- Hanya 2 jenis lokasi: **Sekolah** dan **Balai RT/RW (Posyandu)** — segmentasi
  UMKM sudah dihapus. Pembeda antar jenis bukan cuma warna, tapi juga
  **bentuk ikon** (topi wisuda untuk Sekolah, rumah/balai untuk Balai RT/RW).
- **Klik tag lokasi di peta** untuk membuka popup berisi dropdown status —
  memilih status baru langsung tersimpan ke database Supabase (live untuk
  semua perangkat), tanpa perlu form terpisah.
- Form **"Tambah Lokasi Manual"** menyimpan langsung ke tabel Supabase yang
  sama dengan hasil import masterdata.
- **Nearby Target** — radius 100 m–2 km di sekitar posisi GPS/kantor.
- **Quick Blast** sekarang hanya mode pencarian ("Semua Lokasi") — ketik nama
  atau alamat, pilih target, kirim pesan WhatsApp.

**Smart Route Optimization**
- Titik awal otomatis memakai lokasi GPS perangkat (fallback ke kantor).
- Titik tujuan akhir **bisa disearch** — ketik nama/alamat lokasi, pilih dari
  hasil pencarian (tidak lagi dropdown berisi ribuan lokasi).
- Peta rute **hanya menampilkan tag lokasi yang direkomendasikan** (titik
  awal, singgahan, tujuan), bukan seluruh database, supaya jalur rute
  terlihat jelas.
- Nearest-neighbor + OSRM untuk memilih hingga 3 titik tambahan dan
  menggambar rute mengikuti jalan sungguhan.

### Outbranch Delivery System (5 langkah)
1. **Pilih Produk** — Tabungan Pelajar / Livin Mandiri (Livin Merchant sudah
   dihapus).
2. **Entry Data Nasabah** — field & dokumen berbeda per produk:
   - **Tabungan Pelajar**: Nama Anak, Nama Orang Tua, NIK, KK, Alamat,
     Tempat/Tanggal Lahir Anak, No. Telp, Email — dokumen: KTP Orang Tua, KK,
     Akta Kelahiran, KIA (opsional).
   - **Livin Mandiri**: Nama Lengkap, NIK, KK, Alamat, Tempat/Tanggal Lahir,
     No. Telp, Email — dokumen: KTP, KK.
   Upload File atau Ambil via Kamera (dengan overlay panduan posisi).
3. **Verifikasi Wajah** — overlay garis panduan, foto tersimpan.
4. **Tanda Tangan Digital** — bantalan tanda tangan (sentuhan & mouse).
5. **QR Login Nasabah** — QR mengarah ke aplikasi Livin.

**Riwayat & Export ke Excel** — setiap pengajuan (klik "Selesai" di step 5)
mengunggah **seluruh gambar** (dokumen, foto wajah, tanda tangan) ke Supabase
Storage dengan format nama `PREFIX_Nama_NIK.ext` (mis. `KTP_BudiSantoso_...`),
lalu menyimpan **seluruh data + tautan gambar** ke tabel `ods_submissions`.
Export Excel (SheetJS) menyertakan semua kolom tersebut.

## Catatan penting

- **Database bersama wajib disetel sebelum dipakai tim** — lihat
  `data/README.md`.
- **QR → buka aplikasi Livin**: QR yang dihasilkan mengarah ke
  `https://livin.bankmandiri.co.id/app/session/{sessionId}` (lihat konstanta
  `LIVIN_DEEPLINK_BASE` di `js/ods.js`). Agar scan benar-benar membuka
  aplikasi Livin secara langsung, domain tersebut perlu didaftarkan sebagai
  Android App Links / iOS Universal Links resmi — koordinasi dengan tim
  aplikasi Livin, di luar cakupan file statis ini.
- **Aset gambar**: logo Bank Mandiri harus Anda tempatkan sendiri di
  `assets/logo_mandiri/logo-mandiri.png` (bukan aset yang bisa dibuat
  otomatis karena merek dagang resmi).
- Fitur kamera & GPS membutuhkan izin akses browser dan koneksi **HTTPS**
  (otomatis tersedia di domain Vercel) atau `localhost` saat development.
- Peta: tile OpenStreetMap. Routing: OSRM demo server publik
  (`router.project-osrm.org`) — gratis tanpa API key tapi ada rate-limit,
  tidak untuk trafik produksi tinggi. Untuk produksi, disarankan pindah ke
  instance OSRM sendiri atau layanan berbayar (Google Directions API,
  Mapbox, dsb).
