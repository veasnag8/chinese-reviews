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
4. Run `supabase/migrations/20240916_learning_content.sql` after the initial migration.
5. Run `supabase/migrations/20240916_admin_access.sql` for admin word/class management.
6. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` for the protected admin user-creation route. Keep this key server-only.
7. Run `supabase/migrations/20240916_schedule_access.sql` to let staff schedule lessons and students view class content by date.

Set a teacher account with:

```sql
UPDATE public.profiles
SET role = 'teacher'
WHERE email = 'teacher@example.com';
```

Staff can add dated lessons from `/admin/classes`. Students choose a date on the Dashboard to see the class, lesson description, teacher, words, and sentences scheduled for that day.

After signing up, promote the admin account in Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

The migrations define the personal study data model, indexes, and Row Level Security policies. The learning-content migration adds optional audio URLs/provider metadata, writing targets, and automatic `updated_at` timestamps for user-created words and sentences. The admin migration lets users with `profiles.role = 'admin'` manage shared words and classes. Keep service-role keys server-only; they must never be prefixed with `NEXT_PUBLIC_`.

## Deploy to Vercel

Import the repository in Vercel, set the environment variables from `.env.example`, then deploy. The production verification command is:

```bash
npm run build
```

## Cloudflare R2

Use the R2 variables for future secure, server-side uploads of word images and pronunciation audio. Store only the resulting public URL in PostgreSQL.
