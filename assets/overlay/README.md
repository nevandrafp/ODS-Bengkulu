# overlay/

Gambar panduan garis yang ditampilkan di atas video kamera saat pengambilan
foto dokumen & verifikasi wajah pada Outbranch Delivery System (Step 2 & 3).

| File | Dipakai untuk |
|------|----------------|
| `overlay_ktp.png` | Panduan bingkai saat foto KTP |
| `overlay_kk.png` | Panduan bingkai saat foto Kartu Keluarga |
| `overlay_akta.png` | Panduan bingkai saat foto Akta Kelahiran |
| `overlay_wajah.png` | Panduan oval posisi wajah saat verifikasi wajah |

File yang sudah ada di folder ini adalah **placeholder generik** (bingkai
kartu & oval wajah sederhana, dibuat otomatis — bukan aset desain resmi).
Silakan timpa dengan desain overlay resmi Anda; gunakan nama file yang persis
sama agar tidak perlu mengubah kode di `js/ods.js` / `index.html`.

Rekomendasi: PNG transparan, rasio KTP ±1.6:1 (landscape), rasio KK/Akta
mendekati dokumen A4/F4 (portrait), overlay wajah persegi/landscape dengan
oval di tengah.
