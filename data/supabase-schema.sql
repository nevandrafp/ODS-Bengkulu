-- =============================================================================
-- Jalankan SELURUH isi file ini di Supabase Dashboard > SQL Editor > New query > Run
-- Revisi: Field Radar sekarang 1 tabel gabungan (bukan CSV + tabel manual
-- terpisah lagi), dan ODS menyimpan seluruh data + gambar (dokumen, foto
-- wajah, tanda tangan) via Supabase Storage.
-- =============================================================================

-- 1) FIELD RADAR — seluruh lokasi (hasil import masterdata + tambahan manual
--    dari aplikasi) dalam SATU tabel, sehingga status bisa diubah langsung
--    dari peta dan tersimpan permanen untuk semua orang.
create table if not exists field_radar_locations (
  id bigint generated always as identity primary key,
  type text not null default 'sekolah',           -- 'sekolah' atau 'balai'
  name text not null,
  lat double precision not null,
  lng double precision not null,
  alamat text,
  telp text,
  status text not null default 'belum',           -- 'belum' | 'proses' | 'sudah'
  rating numeric,
  ulasan integer,
  source text not null default 'import',          -- 'import' = Top Down (otomatis) | 'manual' = Bottom Up
  -- jenis objek: 'sekolah' | 'balai' | 'umkm' | 'merchant'
  pemilik text,                                   -- UMKM
  jenis_usaha text,                               -- UMKM
  omzet_bulanan numeric,                          -- UMKM (Rp)
  catatan text,
  pic_kunjungan text,                             -- data kunjungan (diisi manual oleh PIC)
  tgl_kunjungan date,
  pic_objek text,
  kontak_pic_objek text,
  dokumentasi_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_field_radar_locations_type on field_radar_locations(type);
create index if not exists idx_field_radar_locations_status on field_radar_locations(status);

alter table field_radar_locations enable row level security;
create policy "public read field_radar_locations" on field_radar_locations
  for select using (true);
create policy "public insert field_radar_locations" on field_radar_locations
  for insert with check (true);
create policy "public update field_radar_locations" on field_radar_locations
  for update using (true);
create policy "public delete field_radar_locations" on field_radar_locations
  for delete using (type = 'umkm' or source = 'manual');

alter publication supabase_realtime add table field_radar_locations;

-- 2) OUTBRANCH DELIVERY SYSTEM — riwayat pengajuan LENGKAP (semua field data
--    nasabah + url gambar dokumen/foto wajah/tanda tangan yang diupload ke
--    Supabase Storage), sehingga saat export ke Excel semua ikut terlihat.
create table if not exists ods_submissions (
  id bigint generated always as identity primary key,
  session_id text,
  product text,                 -- 'Tabungan Pelajar' | 'Payroll' | 'Pebisnis' | 'Prioritas' | 'Individu'
  nama text,                    -- nama anak (Tab. Pelajar) / nama lengkap (Livin Mandiri)
  nama_pendamping text,         -- nama orang tua (hanya Tabungan Pelajar, null utk Livin Mandiri)
  nik text,
  kk text,
  alamat text,
  tempat_lahir text,
  tanggal_lahir text,
  telp text,
  email text,
  documents jsonb,              -- {"ktp": "https://...", "kk": "https://...", "akta": "...", "kia": "..."}
  signature_url text,
  face_photo_url text,
  extra jsonb,                  -- data produk Payroll/Pebisnis/Prioritas/Individu (label -> isi)
  waktu text,
  created_at timestamptz not null default now()
);

alter table ods_submissions enable row level security;
create policy "public read ods_submissions" on ods_submissions
  for select using (true);
create policy "public insert ods_submissions" on ods_submissions
  for insert with check (true);

alter publication supabase_realtime add table ods_submissions;

-- 3) STORAGE BUCKET untuk gambar ODS (KTP/KK/Akta/KIA, foto wajah, tanda
--    tangan). Nama file otomatis diberi format oleh js/ods.js:
--    KTP_(Nama)_(NIK).jpg, KK_(Nama)_(NIK).jpg, AKTA_(Nama)_(NIK).jpg, dst.
insert into storage.buckets (id, name, public)
values ('ods-documents', 'ods-documents', true)
on conflict (id) do nothing;

create policy "public read ods-documents" on storage.objects
  for select using (bucket_id = 'ods-documents');
create policy "public upload ods-documents" on storage.objects
  for insert with check (bucket_id = 'ods-documents');
create policy "public update ods-documents" on storage.objects
  for update using (bucket_id = 'ods-documents');

-- Catatan: policy di atas mengizinkan akses publik lewat anon key (cocok
-- untuk demo/internal tanpa sistem login). Kalau nanti sudah ada login
-- pegawai, ganti seluruh policy "public ..." di atas agar mensyaratkan
-- role/auth.uid() tertentu.

-- 4) LOGIN PEGAWAI — autentikasi sederhana berbasis NIP + password (bukan
--    Supabase Auth bawaan, supaya loginnya pakai NIP seperti diminta).
--    CATATAN KEAMANAN PENTING: policy select "true" di bawah berarti siapa
--    pun yang tahu anon key (nilainya ada di js/supabase-client.js, dan itu
--    memang publik/terlihat di browser) bisa membaca SELURUH isi tabel ini
--    termasuk kolom password lewat REST API. Ini cocok untuk trial/dipakai
--    internal di jaringan tertutup, TAPI tidak aman untuk aplikasi publik.
--    Untuk produksi: pindahkan verifikasi password ke Supabase Edge
--    Function / backend yang memegang service role key (tidak pernah
--    dikirim ke browser), dan simpan password dalam bentuk hash, bukan
--    teks polos.
create table if not exists app_users (
  nip text primary key,
  password text not null,
  nama text,
  created_at timestamptz not null default now()
);

alter table app_users enable row level security;
create policy "public read app_users" on app_users
  for select using (true);

-- Tambahkan user login secara manual lewat SQL Editor atau Table Editor
-- Supabase, contoh:
-- insert into app_users (nip, password, nama) values ('123456', 'gantidenganpassword', 'Nama Pegawai');

-- 5) STORAGE BUCKET foto dokumentasi kunjungan objek (Field Radar & Database UMKM)
insert into storage.buckets (id, name, public)
values ('kunjungan-docs', 'kunjungan-docs', true)
on conflict (id) do nothing;
create policy "public read kunjungan-docs" on storage.objects
  for select using (bucket_id = 'kunjungan-docs');
create policy "public upload kunjungan-docs" on storage.objects
  for insert with check (bucket_id = 'kunjungan-docs');
create policy "public update kunjungan-docs" on storage.objects
  for update using (bucket_id = 'kunjungan-docs');
