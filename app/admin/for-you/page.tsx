'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, Clock3, Gift, Loader2, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchSentenceAutofill, fetchWordAutofill } from '@/lib/ai-autofill';

type Assignment = {
  id: string;
  content_type: 'word' | 'sentence';
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  expires_at: string;
  created_at: string;
};

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const emptyForm = () => ({
  contentType: 'word' as 'word' | 'sentence',
  chinese: '',
  pinyin: '',
  khmer: '',
  english: '',
  expiresAt: localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
});

export default function AdminForYouPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setMessage('');
    const assignmentsResult = await (supabase.from('for_you_assignments') as any)
      .select('id, content_type, chinese, pinyin, khmer, english, expires_at, created_at')
      .order('created_at', { ascending: false });
    if (assignmentsResult.error) {
      setMessage(assignmentsResult.error.message || 'Unable to load assignments.');
    } else {
      setAssignments((assignmentsResult.data || []) as Assignment[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const expiry = new Date(form.expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      setMessage('Expiry must be a future date and time.');
      return;
    }
    setSaving(true);
    setMessage('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage('Please sign in again.');
      setSaving(false);
      return;
    }
    const { error } = await (supabase.from('for_you_assignments') as any).insert({
      created_by: auth.user.id,
      content_type: form.contentType,
      chinese: form.chinese.trim(),
      pinyin: form.pinyin.trim() || null,
      khmer: form.khmer.trim() || null,
      english: form.english.trim() || null,
      expires_at: expiry.toISOString(),
    });
    if (error) setMessage(error.message);
    else {
      setMessage('Assignment added to every user’s For You page.');
      setForm(emptyForm());
      await loadData();
    }
    setSaving(false);
  };

  const generateTranslations = async () => {
    const chinese = form.chinese.trim();
    if (!chinese) {
      setMessage(`Enter a Chinese ${form.contentType} before using AI autofill.`);
      return;
    }

    setGenerating(true);
    setMessage('');
    if (form.contentType === 'sentence') {
      const result = await fetchSentenceAutofill(chinese);
      if (result.error || !result.data) setMessage(result.error || 'Unable to generate translations.');
      else setForm((current) => ({
        ...current,
        pinyin: result.data?.pinyin || '',
        khmer: result.data?.khmerTranslation || '',
        english: result.data?.englishTranslation || '',
      }));
    } else {
      const result = await fetchWordAutofill(chinese);
      if (result.error || !result.data) setMessage(result.error || 'Unable to generate translations.');
      else setForm((current) => ({
        ...current,
        pinyin: result.data?.pinyin || '',
        khmer: result.data?.khmer || '',
        english: result.data?.english || '',
      }));
    }
    setGenerating(false);
  };

  const remove = async (assignment: Assignment) => {
    if (!supabase || !window.confirm(`Delete “${assignment.chinese}” from every user’s For You list?`)) return;
    const { error } = await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
    if (error) setMessage(error.message);
    else setAssignments((current) => current.filter((item) => item.id !== assignment.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Shared practice</p>
          <h1 className="mt-1 text-3xl font-bold">Assign For You</h1>
          <p className="mt-2 text-slate-500">Send a word or sentence to every user. It disappears from their pages after the expiry time.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><RefreshCw size={17} /> Refresh</button>
      </div>

      {message && <p role="status" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Gift className="text-[#b91c1c]" size={20} /><h2 className="text-lg font-bold">New assignment</h2></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Content type
            <select value={form.contentType} onChange={(event) => setForm({ ...form, contentType: event.target.value as 'word' | 'sentence' })} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]"><option value="word">Word</option><option value="sentence">Sentence</option></select>
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Chinese {form.contentType}
              <button type="button" onClick={() => void generateTranslations()} disabled={generating || !form.chinese.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? 'Generating...' : 'Generate with AI'}
              </button>
            </span>
            <textarea required value={form.chinese} onChange={(event) => setForm({ ...form, chinese: event.target.value })} rows={form.contentType === 'sentence' ? 3 : 2} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-lg font-normal outline-none focus:border-[#b91c1c]" placeholder={form.contentType === 'word' ? '例如：学习' : '例如：我每天学习中文。'} />
          </label>
          <label className="text-sm font-semibold text-slate-700">Pinyin<input value={form.pinyin} onChange={(event) => setForm({ ...form, pinyin: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-700">Khmer<input value={form.khmer} onChange={(event) => setForm({ ...form, khmer: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-700">English<input value={form.english} onChange={(event) => setForm({ ...form, english: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-700">Expires at<input required type="datetime-local" min={localDateTime(new Date())} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" /></label>
        </div>
        <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={17} /> {saving ? 'Assigning...' : 'Assign to all users'}</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-slate-600"><tr><th className="p-4">Audience</th><th className="p-4">Type</th><th className="p-4">Content</th><th className="p-4">Expires</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading assignments...</td></tr> : assignments.map((assignment) => {
              const expired = new Date(assignment.expires_at).getTime() <= Date.now();
              return <tr key={assignment.id} className="border-b border-stone-100 last:border-0"><td className="p-4 font-semibold">All users</td><td className="p-4 capitalize"><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{assignment.content_type === 'word' ? <BookOpen size={13} /> : <Clock3 size={13} />}{assignment.content_type}</span></td><td className="p-4"><p className="max-w-sm text-lg font-semibold">{assignment.chinese}</p><p className="text-xs text-slate-500">{assignment.pinyin || assignment.english || ''}</p></td><td className="p-4 text-slate-600">{new Date(assignment.expires_at).toLocaleString()}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${expired ? 'bg-stone-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{expired ? 'Expired' : 'Active'}</span></td><td className="p-4"><button type="button" onClick={() => void remove(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} /> Delete</button></td></tr>;
            })}
            {!loading && assignments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No assignments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
