'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Edit3, KeyRound, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  disabled: boolean;
  lastActiveAt: string | null;
  isOnline: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const loadUsers = async () => {
    setLoading(true);
    setMessage('');
    const token = await getToken();
    if (!token) {
      setMessage('Please sign in again.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'Unable to load users.');
    else setUsers(result.users || []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const token = await getToken();
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || 'Unable to create student.');
    } else {
      setForm({ fullName: '', email: '', password: '' });
      setShowForm(false);
      await loadUsers();
    }
    setBusy(false);
  };

  const manageUser = async (user: AdminUser, action: 'update' | 'disable' | 'enable' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage('');
    const token = await getToken();
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        action,
        email: editingUser?.id === user.id ? editingUser.email : user.email,
        fullName: editingUser?.id === user.id ? editingUser.fullName : user.fullName,
        role: action === 'update' ? user.role : undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'Unable to update student.');
    else {
      setEditingUser(null);
      await loadUsers();
    }
    setBusy(false);
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    setBusy(true);
    setMessage('');
    const token = await getToken();
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetUser.id, action: 'reset-password', password: newPassword }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'Unable to reset password.');
    else {
      setResetUser(null);
      setNewPassword('');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p>
          <h1 className="mt-1 text-3xl font-bold">Users List</h1>
          <p className="mt-2 text-slate-500">Create student accounts and update student or admin profiles and passwords.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadUsers} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <RefreshCw size={17} /> Refresh
          </button>
          <button type="button" onClick={() => setShowForm((visible) => !visible)} className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-4 py-3 text-sm font-semibold text-white">
            <Plus size={17} /> Create student
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      {showForm && (
        <form onSubmit={createStudent} className="max-w-xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={19} className="text-[#b91c1c]" />
            <h2 className="font-bold">Create student account</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Full name<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]" /></label>
            <label className="text-sm font-semibold text-slate-700">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Temporary password<input required minLength={6} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]" /></label>
          </div>
          <button disabled={busy} className="mt-4 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating...' : 'Create account'}</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Created</th><th className="p-4">Last active</th><th className="p-4">Online</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading users...</td></tr> : users.map((user) => <tr key={user.id} className="border-b border-stone-100 last:border-0"><td className="p-4 font-semibold">{user.fullName || 'Unnamed student'}</td><td className="p-4 text-slate-600">{user.email}</td><td className="p-4 capitalize text-slate-600">{user.role}</td><td className="p-4 text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td><td className="p-4 text-slate-600">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'Never'}</td><td className="p-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-50 text-stone-700'}`}><span className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-emerald-500' : 'bg-stone-400'}`} />{user.isOnline ? 'Online' : 'Offline'}</span></td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.disabled ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{user.disabled ? 'Disabled' : user.emailConfirmed ? 'Active' : 'Pending'}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditingUser(user)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold"><Edit3 size={13} /> Edit</button><button type="button" onClick={() => { setResetUser(user); setNewPassword(''); }} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-sky-700"><KeyRound size={13} /> Reset</button><button type="button" disabled={busy || (user.role === 'admin' && !user.disabled)} onClick={() => manageUser(user, user.disabled ? 'enable' : 'disable')} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700">{user.disabled ? 'Enable' : 'Disable'}</button><button type="button" disabled={busy || user.role === 'admin'} onClick={() => manageUser(user, 'delete')} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700">Delete</button></div></td></tr>)}
            {!loading && users.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/30 p-4">
          <form onSubmit={(event) => { event.preventDefault(); manageUser(editingUser, 'update'); }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">Edit user</h2>
            <label className="mt-4 block text-sm font-semibold">Full name<input value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
            <label className="mt-4 block text-sm font-semibold">Email<input required type="email" value={editingUser.email} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
            <label className="mt-4 block text-sm font-semibold">Role<select value={editingUser.role} onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value as AdminUser['role'] })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingUser(null)} className="rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-semibold text-white">Save changes</button></div>
          </form>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/30 p-4">
          <form onSubmit={resetPassword} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">Reset password</h2>
            <p className="mt-1 text-sm text-slate-500">Set a new password for {resetUser.email}.</p>
            <label className="mt-4 block text-sm font-semibold">New password<input required minLength={6} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setResetUser(null)} className="rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Reset password</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
