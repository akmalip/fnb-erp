# FNB ERP — F&B Order Management System

Self-order web app for F&B businesses (coffee shops, cafes, restaurants). Customers scan a QR code, input their table number, browse the menu, and pay via QRIS.

## Stack
- **Frontend**: Next.js 14 (App Router)
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Storage + Auth)
- **Styling**: Tailwind CSS + CSS Variables
- **Hosting**: Vercel

## Features
- 📱 Customer self-order via QR code
- 🪑 Table number input (one QR per outlet)
- 💳 QRIS static payment + proof upload
- 🔔 PWA push notifications for cashier
- 📊 Live order queue (realtime)
- 👥 Customer database collection
- 🎨 Full white-label branding per outlet

## Setup

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
3. Run `supabase/migrations/002_table_number_update.sql`
4. Create storage buckets: `menu-images`, `outlet-assets`, `payment-proofs`

### 2. Deploy to Vercel
1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy!

### 3. Customer Order URL
`https://your-domain.vercel.app/[outlet-slug]`

One QR code per outlet — customers input their table number after scanning.
