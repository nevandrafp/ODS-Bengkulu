# Import masterdata.xlsx -> Supabase

`masterdata.xlsx` di folder ini sudah disalin dari file yang Anda kirim.
Setiap kali file itu diperbarui, timpa `scripts/masterdata.xlsx` lalu
jalankan lagi:

```bash
cd scripts
npm install                     # sekali saja
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key-dari-Project-Settings-API... \
node import-masterdata.js
```

Lihat komentar di `import-masterdata.js` untuk detail (format kolom, kenapa
harus pakai service_role key, dsb).
