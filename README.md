# Kalender Canvas v24

Aplikasi kalender web (mobile-first) berisi penanggalan **Masehi + Hijriah + Pasaran Jawa**, hari libur nasional, serta kanvas catatan **multi-profil** yang tersinkron ke **Supabase**.

**Aplikasi live:** https://adimigaker.github.io/kalender/

## Fitur

- **Header & navigasi** — pil profil di pojok kanan atas → drawer dengan 3 klaster menu (Profil, Tampilan & Kanvas, Utilitas & Sistem).
- **Kalender bulanan** — grid 1x1 terkunci, nomor Hijriyah sebagai overlay, pasaran Jawa per hari, hari libur berwarna merah.
- **Container gabungan bawah kalender**
  - Paruh atas: **Libur Nasional & Cuti** (tanggal beraksen merah) — `holidays.json` + Google Calendar API (bila diakses dari domain GitHub Pages).
  - Divider.
  - Paruh bawah: **Catatan (nama profil)** (tanggal beraksen biru) — dari tabel `cal_items`.
- **Multi-profil** — tabel `cal_profiles` (nama + warna aksen, catatan terpisah per profil).
- **Diagnostik & Log di layar HP** — tanpa perlu F12: pil status sinkronisasi di header, panel error melayang, modal Diagnostik dengan Tes Koneksi + riwayat log + salin log.

## Sinkronisasi Supabase

| Data | Tabel | Kolom penting |
|---|---|---|
| Profil | `cal_profiles` | `id` (TEXT), `name`, `color` |
| Catatan | `cal_items` | `id` (TEXT), `profile_id` → `cal_profiles.id`, `date_key` (`YYYY-MM-DD`), `text`, `tag` |

Skema resmi: **`supabase_schema.sql`** (sudah diterapkan di project). `kalender_schema.sql` hanya arsip lama — **jangan dipakai**.

Alur data:

1. Saat halaman dibuka → muat profil & catatan profil aktif dari Supabase (cloud = sumber kebenaran).
2. Tambah/ubah/hapus catatan & profil → tulis ke Supabase; bila gagal, perubahan **dibatalkan (rollback)** dan pesan error asli tampil di panel merah.
3. Saat aplikasi kembali aktif (pindah tab/aplikasi) → sinkron ulang otomatis.
4. Data lokal lama bisa diunggah ke cloud: menu **Ekspor / Impor → Unggah Data Lokal ke Supabase**.
5. Cache `localStorage` tetap dipakai sebagai salinan offline.

**Catatan keamanan:** kunci anon bersifat publik (ada di berkas `app.js`) dan policy RLS saat ini membuka baca/tulis untuk anon. Untuk data pribadi, disarankan menambah kolom pemisah (mis. `space_key`) dan policy RLS yang memfilternya.

## Struktur berkas

- `index.html` — antarmuka + pemuat pustaka Supabase (CDN ganda + fallback visual) + panel error.
- `app.js` — logika kalender, lapisan sinkron Supabase, sistem log visual.
- `holidays.json` — hari libur nasional (basis tahun 2026).
- `hijri.json` — tabel acuan Hijriyah (titik awal bulan).
- `supabase_schema.sql` — skema resmi tabel Supabase.

## Pemakaian

1. Buka https://adimigaker.github.io/kalender/ di browser HP (boleh "Add to Home screen").
2. Ketuk tanggal untuk menulis catatan; ketuk pil status/profil untuk menu & diagnostik.
3. Bila ada masalah jaringan, panel merah menampilkan pesan error asli; ketuk **Diagnostik & Log → Tes Koneksi** untuk memeriksa baca/tulis Supabase.
4. Ubah kode → `git push` → tunggu ±1 menit build GitHub Pages. Bila layar masih versi lama, pakai menu **Muat Ulang Paksa (Anti-Cache)**.

## Versi

- `v24` — sinkronisasi Supabase penuh + sistem error/log visual untuk HP + diagnostik & tes koneksi + unggah data lokal + sinkron otomatis saat aplikasi aktif kembali.
- `v21.3`–`v23` — pasaran (offset +2, terverifikasi 15 Okt 2026 = Kliwon), overlay Hijriyah, container libur+catatan, multi-profil.
