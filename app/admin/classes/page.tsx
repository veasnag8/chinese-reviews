'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type LessonClass = {
  id: string;
  name: string;
  description: string | null;
  teacher: string | null;
  lesson_number: number | null;
  date: string;
};

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<LessonClass[]>([]);
  const [form, setForm] = useState({ name: '', description: '', teacher: '', lessonNumber: '', date: new Date().toISOString().slice(0, 10) });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadClasses = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('classes').select('id, name, description, teacher, lesson_number, date').order('date', { ascending: true });
    if (error) setMessage(error.message);
    else setClasses(data || []);
  };

  useEffect(() => { loadClasses(); }, []);

  const addClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setMessage('Please sign in again.');
      setBusy(false);
      return;
    }
    const { error } = await supabase.from('classes').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      teacher: form.teacher.trim() || null,
      lesson_number: form.lessonNumber ? Number(form.lessonNumber) : null,
      date: form.date,
      user_id: authData.user.id,
    } as any);
    if (error) setMessage(error.message);
    else {
      setForm({ name: '', description: '', teacher: '', lessonNumber: '', date: form.date });
      await loadClasses();
    }
    setBusy(false);
  };

  const deleteClass = async (id: string) => {
    if (!supabase || !window.confirm('Delete this lesson schedule?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await loadClasses();
  };

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p><h1 className="mt-1 text-3xl font-bold">Lesson Schedule</h1><p className="mt-2 text-slate-500">Add what students should learn on each date.</p></div>
      {message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <form onSubmit={addClass} className="max-w-3xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><CalendarPlus size={19} className="text-[#b91c1c]" /><h2 className="font-bold">Add lesson date</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Class name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Foundation Chinese Language 1A" className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Teacher<input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold">Lesson number<input type="number" min="1" value={form.lessonNumber} onChange={(e) => setForm({ ...form, lessonNumber: e.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold sm:col-span-2">What will students learn?<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Greetings, classroom words, and writing practice" className="mt-1.5 min-h-24 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label>
        </div>
        <button disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save lesson date'}</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50"><tr><th className="p-4">Date</th><th className="p-4">Class</th><th className="p-4">Lesson</th><th className="p-4">Teacher</th><th className="p-4">What to learn</th><th className="p-4">Action</th></tr></thead><tbody>{classes.map((item) => <tr key={item.id} className="border-b border-stone-100"><td className="p-4">{item.date}</td><td className="p-4 font-semibold">{item.name}</td><td className="p-4">{item.lesson_number || '—'}</td><td className="p-4">{item.teacher || '—'}</td><td className="p-4 text-slate-600">{item.description || '—'}</td><td className="p-4"><button type="button" onClick={() => deleteClass(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} /> Delete</button></td></tr>)}{classes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No lesson schedules yet.</td></tr>}</tbody></table></div>
    </div>
  );
}
