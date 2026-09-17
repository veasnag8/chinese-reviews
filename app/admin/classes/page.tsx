'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/use-role';

type LessonClass = {
  id: string;
  name: string;
  description: string | null;
  teacher: string | null;
  lesson_number: number | null;
  date: string;
};

export default function AdminClassesPage() {
  const { status, isAdmin } = useRole();
  const [classes, setClasses] = useState<LessonClass[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', teacher: '', lessonNumber: '', date: new Date().toISOString().slice(0, 10) });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadClasses = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('classes').select('id, name, description, teacher, lesson_number, date').order('date', { ascending: true });
    if (error) setMessage(error.message);
    else setClasses(data || []);
  };

  useEffect(() => { if (status === 'allowed') loadClasses(); }, [status]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', description: '', teacher: '', lessonNumber: '', date: new Date().toISOString().slice(0, 10) });
  };

  const editClass = (item: LessonClass) => {
    if (!isAdmin || busy) return;
    setEditingId(item.id);
    setMessage('');
    setForm({ name: item.name, description: item.description || '', teacher: item.teacher || '', lessonNumber: item.lesson_number === null ? '' : String(item.lesson_number), date: item.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || busy || status !== 'allowed' || (editingId && !isAdmin)) return;
    if (!form.name.trim()) {
      setMessage('Class name is required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setMessage('Please sign in again.');
        return;
      }
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        teacher: form.teacher.trim() || null,
        lesson_number: form.lessonNumber ? Number(form.lessonNumber) : null,
        date: form.date,
      };
      const { data: saved, error } = editingId
        ? await (supabase.from('classes') as any).update(payload).eq('id', editingId).select('id').maybeSingle()
        : await supabase.from('classes').insert({ ...payload, user_id: authData.user.id } as never).select('id').maybeSingle();
      if (error) setMessage(error.message);
      else if (!saved) setMessage('Class could not be saved. Check your permissions and try again.');
      else {
        resetForm();
        await loadClasses();
      }
    } catch {
      setMessage('Unable to save class. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const deleteClass = async (item: LessonClass) => {
    if (!supabase || !isAdmin || busy) return;
    if (!window.confirm(`Delete “${item.name}”? This also deletes its words and sentences and their related records. This cannot be undone.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.from('classes').delete().eq('id', item.id).select('id').maybeSingle();
      if (error) setMessage(error.message);
      else if (!data) setMessage('Class could not be deleted. Check your permissions and try again.');
      else {
        if (editingId === item.id) resetForm();
        await loadClasses();
      }
    } catch {
      setMessage('Unable to delete class. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') return <p className="p-6 text-slate-500">Loading classes...</p>;
  if (status === 'denied') return <p className="p-6 text-slate-500">Only teachers and admins can manage classes.</p>;

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p><h1 className="mt-1 text-3xl font-bold">Lesson Schedule</h1><p className="mt-2 text-slate-500">Add what students should learn on each date.</p></div>
      {message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <form onSubmit={saveClass} className="max-w-3xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><CalendarPlus size={19} className="text-[#b91c1c]" /><h2 className="font-bold">{editingId ? 'Edit class' : 'Add class'}</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Class name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Foundation Chinese Language 1A" className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Teacher<input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Lesson number<input type="number" min="1" value={form.lessonNumber} onChange={(e) => setForm({ ...form, lessonNumber: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold sm:col-span-2">What will students learn?<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Greetings, classroom words, and writing practice" className="mt-1.5 min-h-24 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : editingId ? 'Save changes' : 'Save class'}</button>
          {editingId && <button type="button" onClick={resetForm} disabled={busy} className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>}
        </div>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50"><tr><th className="p-4">Date</th><th className="p-4">Class</th><th className="p-4">Lesson</th><th className="p-4">Teacher</th><th className="p-4">What to learn</th><th className="p-4">Action</th></tr></thead><tbody>{classes.map((item) => <tr key={item.id} className="border-b border-stone-100"><td className="p-4">{item.date}</td><td className="p-4 font-semibold">{item.name}</td><td className="p-4">{item.lesson_number || '—'}</td><td className="p-4">{item.teacher || '—'}</td><td className="p-4 text-slate-600">{item.description || '—'}</td><td className="p-4">{isAdmin && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => editClass(item)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"><Pencil size={13} /> Edit</button><button type="button" disabled={busy} onClick={() => deleteClass(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 size={13} /> Delete</button></div>}</td></tr>)}{classes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No lesson schedules yet.</td></tr>}</tbody></table></div>
    </div>
  );
}
