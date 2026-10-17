-- Perbaikan Skema untuk Routine (v25)
-- Menambahkan kolom pendukung untuk fitur Routine

-- 1. Tambahkan kolom ke cal_items jika belum ada
ALTER TABLE cal_items 
ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS routine_frequency INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS routine_meta JSONB DEFAULT '{}';

-- 2. Pastikan RLS tetap aktif
ALTER TABLE cal_items ENABLE ROW LEVEL SECURITY;
