-- Schema Supabase untuk Kalender Canvas v22/v23

-- 1. Tabel Profil (cal_profiles)
CREATE TABLE IF NOT EXISTS cal_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#60a5fa',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Catatan / Item Kalender (cal_items)
CREATE TABLE IF NOT EXISTS cal_items (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES cal_profiles(id) ON DELETE CASCADE,
    date_key TEXT NOT NULL, -- Format: YYYY-MM-DD
    text TEXT NOT NULL,
    tag TEXT DEFAULT 'Catatan',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk mempercepat pencarian berdasarkan tanggal & profil
CREATE INDEX IF NOT EXISTS idx_cal_items_profile_date ON cal_items(profile_id, date_key);

-- Policy / RLS (Row Level Security) - Bebas Akses Public / Anonim untuk Demo/App
ALTER TABLE cal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Profiles" ON cal_profiles FOR SELECT USING (true);
CREATE POLICY "Public Write Profiles" ON cal_profiles FOR ALL USING (true);

CREATE POLICY "Public Read Items" ON cal_items FOR SELECT USING (true);
CREATE POLICY "Public Write Items" ON cal_items FOR ALL USING (true);

-- Default Profile A (agar ada profil bawaan jika DB kosong)
INSERT INTO cal_profiles (id, name, color)
VALUES ('p_default', 'Profil A', '#60a5fa')
ON CONFLICT (id) DO NOTHING;

