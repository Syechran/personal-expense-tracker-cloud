# Personal Expense Tracker

Aplikasi pencatat keuangan pribadi multi-user: React + Vite (PWA) di frontend, Express + PostgreSQL di backend, dengan autentikasi email/password dan session cookie.

## Stack

- Frontend: React 19, Vite, `vite-plugin-pwa`
- Backend: Express 5, `express-session`, `connect-pg-simple`
- Database: PostgreSQL (skema dibuat otomatis saat server start)
- Auth: bcrypt + session cookie httpOnly

## Menjalankan dengan Docker (paling cepat)

```bash
docker compose up --build
```

Buka `http://localhost:8080`, lalu daftar akun baru. Data PostgreSQL disimpan di volume `pgdata` dan tetap ada setelah container dimatikan.

Ganti `SESSION_SECRET` saat memakai di server:

```bash
SESSION_SECRET="string-acak-minimal-32-karakter" docker compose up --build -d
```

## Development lokal

1. Salin environment:

   ```bash
   cp .env.example .env
   ```

2. Jalankan PostgreSQL saja:

   ```bash
   docker compose up -d db
   ```

3. Install dependensi dan jalankan backend + frontend:

   ```bash
   npm install
   npm run dev:api   # http://localhost:5000
   npm run dev       # http://localhost:5173
   ```

   Vite mem-proxy `/api` ke `localhost:5000` (lihat `vite.config.js`).

## Environment

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Connection string PostgreSQL |
| `SESSION_SECRET` | ya (production) | Minimal 32 karakter |
| `COOKIE_SECURE` | tidak | `true` jika diakses lewat HTTPS |
| `DATABASE_SSL` | tidak | `true` untuk database terkelola yang mewajibkan SSL |
| `PORT` | tidak | Default `5000` |
| `SESSION_COOKIE_NAME` | tidak | Default `sid` |
| `PG_POOL_MAX` | tidak | Default `10` |

## Endpoint API

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/auth/register` | Daftar akun |
| `POST` | `/api/auth/login` | Masuk |
| `POST` | `/api/auth/logout` | Keluar |
| `GET` | `/api/auth/me` | User yang sedang login |
| `PATCH` | `/api/auth/me` | Ubah nama dan/atau foto profil |
| `GET/POST` | `/api/accounts` | Daftar / tambah rekening |
| `DELETE` | `/api/accounts/:id` | Hapus rekening |
| `GET/POST` | `/api/categories` | Daftar / tambah kategori |
| `DELETE` | `/api/categories/:id` | Hapus kategori |
| `GET/POST` | `/api/transactions` | Daftar / tambah transaksi |
| `PUT/DELETE` | `/api/transactions/:id` | Ubah / hapus transaksi |
| `GET` | `/api/transactions/export?days=7\|30` | Unduh transaksi sebagai `.xlsx` |
| `GET` | `/api/health` | Cek server + database |

Semua endpoint data (accounts, categories, transactions) membutuhkan sesi login. Setiap query dibatasi `user_id` milik sesi.

## Profile

Profile dibuka lewat avatar di header Home. Fitur yang tersedia:

- Ubah foto profil (dikompres di browser menjadi 256×256, disimpan di kolom `users.avatar`).
- Ubah nama.
- Export transaksi 7 atau 30 hari terakhir ke file Excel.
- Logout.

Ukuran foto setelah dikompres dibatasi 512 KB. Format yang diterima: JPEG, PNG, dan WebP.

## Deploy VPS tanpa Docker

1. Install Node.js 22 dan PostgreSQL.
2. Buat database dan user PostgreSQL.
3. `npm ci && npm run build`
4. Jalankan `npm start` dengan `systemd`, lalu reverse-proxy `/api` ke port backend memakai Nginx.
5. Set `NODE_ENV=production`, `SESSION_SECRET`, `DATABASE_URL`, dan `COOKIE_SECURE=true` (HTTPS).

Docker untuk produksi tetap bisa dipakai, tetapi tidak wajib. Untuk VPS kecil, build sebaiknya dilakukan di lokal/CI, bukan di VPS.

## Catatan migrasi

- Google Sheets, `googleapis`, service account, dan `credentials.json` tidak dipakai lagi.
- Daftar rekening dan kategori sekarang tersimpan di database, bukan `localStorage`.
- Draft transaksi tetap disimpan di `localStorage` dengan key per user (`txDraft:<userId>`).
- Skema database ada di `api/schema.sql` dan dijalankan otomatis saat startup.
