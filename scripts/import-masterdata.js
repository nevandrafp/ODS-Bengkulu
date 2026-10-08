#!/usr/bin/env node
/* =============================================================================
   IMPORT MASTERDATA -> SUPABASE (tabel field_radar_locations)
   =============================================================================
   Jalankan SEKALI (atau setiap kali masterdata.xlsx diperbarui) dari komputer
   Anda — bukan dari browser — karena ini mengunggah ribuan baris sekaligus.

   Cara pakai:
     1) cd scripts
     2) npm install                     (sekali saja, menginstal 2 package)
     3) taruh file masterdata.xlsx di folder scripts/ (atau ubah MASTERDATA_PATH)
     4) set env var lalu jalankan:
          SUPABASE_URL=https://xxxx.supabase.co \
          SUPABASE_SERVICE_ROLE_KEY=eyJ...   \
          node import-masterdata.js

   PENTING: gunakan "service_role" key (Project Settings -> API), BUKAN anon
   key, supaya insert 3000+ baris tidak kena limit rate anon dan tetap bisa
   jalan meskipun policy RLS berubah nanti. service_role key JANGAN pernah
   ditaruh di kode frontend (js/supabase-client.js) — hanya dipakai di sini,
   di komputer Anda sendiri / CI, sekali jalan.

   Format kolom masterdata.xlsx yang diharapkan (header wajib sama persis):
     nam | type | lat | lng | alamat | telp | rat | ulasan
   ("type" berisi 'sekolah', 'balai', 'umkm', atau 'merchant'; baris dengan
   type lain dilewati). Kolom opsional: pemilik | jenis_usaha | omzet_bulanan
   (untuk umkm). Semua baris import berstatus Top Down (source='import').
   Jalankan data/migration-umkm.sql dulu agar kolom-kolom baru tersedia.
   ========================================================================= */

const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const MASTERDATA_PATH = process.env.MASTERDATA_PATH || path.join(__dirname, 'masterdata.xlsx');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 500;
const ALLOWED_TYPES = ['sekolah', 'balai', 'umkm', 'merchant'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sebagai environment variable dulu.');
  process.exit(1);
}

function loadRows() {
  const wb = XLSX.readFile(MASTERDATA_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  return rows;
}

function mapRow(r) {
  const type = String(r.type || '').trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) return null;
  const name = (r.nam || r.nama || '').toString().trim();
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lng);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    type,
    name,
    lat,
    lng,
    alamat: r.alamat ? String(r.alamat).trim() : null,
    telp: r.telp ? String(r.telp).trim() : null,
    status: 'belum',
    rating: r.rat != null && r.rat !== '' ? Number(r.rat) : null,
    ulasan: r.ulasan != null && r.ulasan !== '' ? parseInt(r.ulasan, 10) : null,
    source: 'import', // Top Down (data otomatis)
    // kolom opsional (terutama untuk type umkm) — boleh tidak ada di xlsx
    pemilik: r.pemilik ? String(r.pemilik).trim() : null,
    jenis_usaha: r.jenis_usaha ? String(r.jenis_usaha).trim() : null,
    omzet_bulanan: r.omzet_bulanan != null && r.omzet_bulanan !== '' ? Number(r.omzet_bulanan) : null,
  };
}

async function main() {
  console.log('Membaca', MASTERDATA_PATH, '...');
  const raw = loadRows();
  console.log('Ditemukan', raw.length, 'baris mentah.');

  const rows = raw.map(mapRow).filter(Boolean);
  const skipped = raw.length - rows.length;
  console.log(`Siap import ${rows.length} baris (dilewati: ${skipped} — type tidak dikenal atau data tidak lengkap).`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('field_radar_locations').insert(batch);
    if (error) {
      console.error(`Gagal pada batch mulai baris ${i}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  imported ${inserted}/${rows.length}`);
  }

  console.log('Selesai. Total lokasi diimport:', inserted);
  console.log('Buka menu Field Radar di aplikasi untuk melihat hasilnya.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
