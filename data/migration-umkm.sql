-- =============================================================================
-- MIGRASI UPDATE DASHBOARD (jalankan SEKALI di Supabase > SQL Editor > Run)
-- Untuk database yang SUDAH berjalan. (Instalasi baru cukup menjalankan
-- supabase-schema.sql, yang sudah memuat semua ini.)
-- Isi: jenis objek baru (umkm, merchant), kolom data kunjungan, kolom extra
-- ODS (produk 3P + i), bucket foto dokumentasi kunjungan, policy hapus.
-- =============================================================================

-- 1) Kolom tambahan objek Field Radar (UMKM + data kunjungan semua objek)
alter table field_radar_locations
  add column if not exists pemilik text,              -- UMKM: nama pemilik usaha
  add column if not exists jenis_usaha text,          -- UMKM: kuliner, retail, jasa, dst
  add column if not exists omzet_bulanan numeric,     -- UMKM: estimasi omzet/bulan (Rp)
  add column if not exists catatan text,
  add column if not exists pic_kunjungan text,        -- pegawai yang berkunjung
  add column if not exists tgl_kunjungan date,        -- tanggal kunjungan
  add column if not exists pic_objek text,            -- PIC di lokasi objek
  add column if not exists kontak_pic_objek text,     -- kontak PIC objek
  add column if not exists dokumentasi_url text;      -- foto dokumentasi kunjungan

-- 'source' sudah ada: 'import' = Top Down (data otomatis), 'manual' = Bottom Up.

-- 2) Policy hapus (hanya UMKM atau data input manual/bottom up)
drop policy if exists "public delete field_radar_locations" on field_radar_locations;
create policy "public delete field_radar_locations" on field_radar_locations
  for delete using (type = 'umkm' or source = 'manual');

-- 3) ODS: data produk baru (Payroll, Pebisnis, Prioritas, Individu) disimpan di kolom extra
alter table ods_submissions add column if not exists extra jsonb;

-- 4) Bucket foto dokumentasi kunjungan
insert into storage.buckets (id, name, public)
values ('kunjungan-docs', 'kunjungan-docs', true)
on conflict (id) do nothing;

drop policy if exists "public read kunjungan-docs" on storage.objects;
drop policy if exists "public upload kunjungan-docs" on storage.objects;
drop policy if exists "public update kunjungan-docs" on storage.objects;
create policy "public read kunjungan-docs" on storage.objects
  for select using (bucket_id = 'kunjungan-docs');
create policy "public upload kunjungan-docs" on storage.objects
  for insert with check (bucket_id = 'kunjungan-docs');
create policy "public update kunjungan-docs" on storage.objects
  for update using (bucket_id = 'kunjungan-docs');

-- 5) PINDAH AREA: data lama masterdata.xlsx adalah Jakarta Barat. Kalau sudah
--    punya masterdata Kec. Ratu Agung (Bengkulu), kosongkan data lama dulu
--    (HAPUS tanda komentar baris di bawah), lalu import ulang:
-- truncate table field_radar_locations;
