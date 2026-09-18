import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type CreateStudentPayload = {
  email?: string;
  password?: string;
  fullName?: string;
};

type ManageStudentPayload = {
  id?: string;
  action?: 'update' | 'disable' | 'enable' | 'delete' | 'reset-password';
  role?: 'student' | 'teacher' | 'admin';
  email?: string;
  fullName?: string;
  password?: string;
};

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL or public key is missing from .env.local.');
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local. Add it on the server and restart Next.js.');
  }

  return { url, anonKey, serviceRoleKey };
}

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { url, anonKey, serviceRoleKey } = getEnv();
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return null;

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') return null;
  return { adminClient, userId: authData.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if (!access) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { data, error } = await access.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = data.users.map((user) => user.id);
    const { data: profiles, error: profilesError } = ids.length
      ? await access.adminClient.from('profiles').select('id, role, full_name, last_active_at, is_online').in('id', ids)
      : { data: [], error: null };
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return NextResponse.json({
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email ?? '',
        fullName: profilesById.get(user.id)?.full_name ?? user.user_metadata?.full_name ?? '',
        role: profilesById.get(user.id)?.role ?? 'student',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        lastActiveAt: profilesById.get(user.id)?.last_active_at ?? null,
        isOnline: profilesById.get(user.id)?.is_online ?? false,
        emailConfirmed: Boolean(user.email_confirmed_at),
        disabled: Boolean(user.banned_until && new Date(user.banned_until) > new Date()),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load users.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if (!access) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const payload = (await request.json()) as ManageStudentPayload;
    const id = payload.id?.trim();
    const action = payload.action;
    if (!id || !action) return NextResponse.json({ error: 'User id and action are required.' }, { status: 400 });

    const { data: targetProfile, error: profileError } = await access.adminClient
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle();
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    if (!['update', 'disable', 'enable', 'delete', 'reset-password'].includes(action)) {
      return NextResponse.json({ error: 'Invalid user action.' }, { status: 400 });
    }
    if (targetProfile?.role === 'admin' && (action === 'delete' || action === 'disable')) {
      return NextResponse.json({ error: 'Admin accounts cannot be deleted or disabled here.' }, { status: 403 });
    }

    if (action === 'delete') {
      const { error } = await access.adminClient.auth.admin.deleteUser(id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'disable' || action === 'enable') {
      const { error } = await access.adminClient.auth.admin.updateUserById(id, {
        ban_duration: action === 'disable' ? '876000h' : 'none',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reset-password') {
      const password = payload.password ?? '';
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const { error } = await access.adminClient.auth.admin.updateUserById(id, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const role = payload.role ?? targetProfile?.role ?? 'student';
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    }
    if (id === access.userId && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin access.' }, { status: 400 });
    }
    const email = payload.email?.trim().toLowerCase();
    const fullName = payload.fullName?.trim() ?? '';
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });

    const { error: authError } = await access.adminClient.auth.admin.updateUserById(id, {
      email,
      user_metadata: { full_name: fullName },
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: profileUpdateError } = await access.adminClient
      .from('profiles')
      .update({ email, full_name: fullName, role, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to manage student.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if (!access) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const payload = (await request.json()) as CreateStudentPayload;
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password ?? '';
    const fullName = payload.fullName?.trim() ?? '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const { data, error } = await access.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'Unable to create student.' }, { status: 400 });
    }

    await access.adminClient.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: 'student',
    });

    return NextResponse.json(
      { user: { id: data.user.id, email, fullName } },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create student.' },
      { status: 500 }
    );
  }
}
