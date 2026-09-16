# Chinese Review

A mobile-first personal notebook and spaced-review workspace for Chinese class: Chinese, Pinyin, Khmer, and English stay together in one place.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard, word collection, and review experience include sample data so the interface can be explored immediately.

## Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and supply the public project URL and publishable key.
3. Run `supabase/migrations/20240101_initial.sql` in the Supabase SQL editor.

The initial migration defines the personal study data model, indexes, and Row Level Security policies. Keep service-role keys server-only; they must never be prefixed with `NEXT_PUBLIC_`.

## Deploy to Vercel

Import the repository in Vercel, set the environment variables from `.env.example`, then deploy. The production verification command is:

```bash
npm run build
```

## Cloudflare R2

Use the R2 variables for future secure, server-side uploads of word images and pronunciation audio. Store only the resulting public URL in PostgreSQL.
