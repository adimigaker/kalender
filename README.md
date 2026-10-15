# Kalender v21 (final)

**Deskripsi**
Kalender Masehi sederhana yang menampilkan:
- Tanggal (grid 1x1, margin minimal)
- Pasaran Jawa (dikalkulasi dari JDN 2026)
- Hari libur nasional (dari file `holidays.json`)

**Fitur**
- Footer paling bawah (`Kalender v21 — Masehi + Pasaran + Libur Nasional`)
- Navigasi bulan, swipe gesture
- Terintegrasi dengan data libur lokal

**Versi Saat Ini**
- `app.js` v21 (offset pasaran +2, 15 Okt 2026 = Kliwon)
- `index.html` v21 (grid 1x1, footer bawah)

**Cara Menjalankan**
- Jalankan `node app.js` dan akses server lokal pada port yang ditentukan
- Akses file `index.html` langsung di repo (untuk menghindari masalah cache)

**Perubahan Terakhir**
- Fix offset pasaran = +2 (mencocokkan hari ini, 15 Okt 2026 = Kliwon)
- Grid 1x1 dan footer bawah
- Hapus seluruh logika Hijri (menunggu data otoritatif)

**Repositori**: https://github.com/adimigaker/kalender
