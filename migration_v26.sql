-- Perbaikan Skema untuk Routine v26.3
-- Menambahkan kolom pendukung untuk fitur Routine Range (start_date, end_date, routine_meta)

-- 1. Tambahkan kolom ke cal_items jika belum ada
ALTER TABLE cal_items 
ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS routine_frequency INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS routine_meta JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS start_date TEXT,
ADD COLUMN IF NOT EXISTS end_date TEXT;

-- 2. Pastikan RLS tetap aktif
ALTER TABLE cal_items ENABLE ROW LEVEL SECURITY;
