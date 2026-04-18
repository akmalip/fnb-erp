-- Migration 002: Ubah dari QR per meja ke input nomor meja
-- Tidak ada perubahan schema (table_number di orders sudah TEXT, flexible)
-- Yang berubah hanya di aplikasi: tidak lagi ambil ?table= dari URL QR
-- Customer akan input nomor meja sendiri di UI

-- Tambah kolom max_table_number di outlets (untuk validasi input customer)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS max_table_number INT DEFAULT 20;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS table_number_label TEXT DEFAULT 'Nomor Meja';

-- Catatan: QR Code sekarang hanya 1 per outlet
-- Format URL: https://domain.com/[outlet-slug]
-- Tidak ada parameter ?table= lagi
-- Nomor meja diinput manual oleh customer sebelum memesan

COMMENT ON COLUMN outlets.max_table_number IS 'Jumlah meja maksimum, untuk validasi input customer';
COMMENT ON COLUMN outlets.table_number_label IS 'Label yang muncul di UI, bisa diganti misal "Nomor Booth" atau "Lantai & Meja"';
