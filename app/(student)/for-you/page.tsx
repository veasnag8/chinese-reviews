'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock3, ImageIcon, Loader2, NotebookPen, PenLine, RefreshCw, Send, TextQuote, Upload, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Assignment = {
  id: string;
  content_type: 'word' | 'sentence';
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  image_path: string | null;
  expires_at: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  answer_image_path: string;
  status: 'pending_checking' | 'checked';
  submitted_at: string;
  checked_at: string | null;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.75;
  window.speechSynthesis.speak(utterance);
};

export default function ForYouPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [promptUrls, setPromptUrls] = useState<Record<string, string>>({});
  const [answerUrls, setAnswerUrls] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError('Please sign in again.');
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await (supabase
      .from('for_you_assignments') as any)
      .select('id, content_type, chinese, pinyin, khmer, english, image_path, expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    if (queryError) setError(queryError.message);
    else {
      const assignments = (data || []) as Assignment[];
      setItems(assignments);
      const { data: submissionData, error: submissionError } = await (supabase.from('homework_submissions') as any)
        .select('id, assignment_id, answer_image_path, status, submitted_at, checked_at');
      if (submissionError) setError(submissionError.message);
      const submissionRows = (submissionData || []) as Submission[];
      setSubmissions(Object.fromEntries(submissionRows.map((row) => [row.assignment_id, row])));

      const promptEntries = await Promise.all(assignments.filter((item) => item.image_path).map(async (item) => {
        const { data: signed } = await supabase.storage.from('homework-files').createSignedUrl(item.image_path!, 3600);
        return [item.id, signed?.signedUrl || ''] as const;
      }));
      const answerEntries = await Promise.all(submissionRows.map(async (submission) => {
        const { data: signed } = await supabase.storage.from('homework-files').createSignedUrl(submission.answer_image_path, 3600);
        return [submission.assignment_id, signed?.signedUrl || ''] as const;
      }));
      setPromptUrls(Object.fromEntries(promptEntries));
      setAnswerUrls(Object.fromEntries(answerEntries));
    }
    setLoading(false);
  }, []);

  const submitAnswer = async (assignmentId: string, file?: File) => {
    if (!supabase || !file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Answer must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Answer image must be 5 MB or smaller.');
      return;
    }
    setUploadingId(assignmentId);
    setError('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError('Please sign in again.');
      setUploadingId(null);
      return;
    }
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `submissions/${auth.user.id}/${assignmentId}/answer.${extension}`;
    const previous = submissions[assignmentId];
    const { error: uploadError } = await supabase.storage.from('homework-files').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setUploadingId(null);
      return;
    }
    const { error: saveError } = await (supabase.from('homework_submissions') as any).upsert({
      assignment_id: assignmentId,
      user_id: auth.user.id,
      answer_image_path: path,
      status: 'pending_checking',
      submitted_at: new Date().toISOString(),
      checked_at: null,
      checked_by: null,
    }, { onConflict: 'assignment_id,user_id' });
    if (saveError) setError(saveError.message);
    else {
      if (previous?.answer_image_path && previous.answer_image_path !== path) {
        await supabase.storage.from('homework-files').remove([previous.answer_image_path]);
      }
      await load();
    }
    setUploadingId(null);
  };

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Your assignments</p><h1 className="mt-1 text-3xl font-bold">Homework</h1><p className="mt-2 text-slate-500">Complete the words and sentences assigned by your teacher before they expire.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><RefreshCw size={17} /> Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-slate-500">Loading your practice...</p> : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold capitalize text-[#b91c1c]">{item.content_type === 'word' ? <BookOpen size={13} /> : <TextQuote size={13} />}{item.content_type}</span><button type="button" onClick={() => speak(item.chinese)} aria-label="Listen" className="rounded-full border border-stone-200 p-2 text-slate-600 hover:bg-stone-50"><Volume2 size={16} /></button></div>
            {promptUrls[item.id] && <a href={promptUrls[item.id]} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-stone-200"><img src={promptUrls[item.id]} alt="Homework provided by teacher" className="max-h-72 w-full object-contain bg-stone-50" /></a>}
            <h2 className={`mt-4 font-semibold text-slate-900 ${item.content_type === 'word' ? 'text-3xl' : 'text-2xl leading-relaxed'}`}>{item.chinese}</h2>
            <p className="mt-2 text-red-700">{item.pinyin || 'Pinyin not added'}</p>
            <div className="mt-4 border-t border-stone-100 pt-4"><p className="text-base">{item.khmer || 'Khmer translation not added'}</p><p className="mt-1 text-sm text-slate-500">{item.english || 'English translation not added'}</p></div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={14} /> Available until {new Date(item.expires_at).toLocaleString()}</p>
            <Link href={`/writing?assignment=${encodeURIComponent(item.id)}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-[#b91c1c]"><PenLine size={16} /> Practice writing</Link>
            {submissions[item.id] && (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">Your submitted answer</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${submissions[item.id].status === 'checked' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{submissions[item.id].status === 'checked' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{submissions[item.id].status === 'checked' ? 'Checked' : 'Pending Checking'}</span></div>
                {answerUrls[item.id] && <a href={answerUrls[item.id]} target="_blank" rel="noreferrer"><img src={answerUrls[item.id]} alt="Your homework answer" className="mt-3 max-h-48 w-full rounded-lg object-contain" /></a>}
              </div>
            )}
            <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              {uploadingId === item.id ? <Loader2 size={16} className="animate-spin" /> : submissions[item.id] ? <Upload size={16} /> : <Send size={16} />}
              {uploadingId === item.id ? 'Uploading...' : submissions[item.id] ? 'Resubmit answer image' : 'Submit answer image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingId !== null} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void submitAnswer(item.id, file); }} />
            </label>
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400"><ImageIcon size={13} /> JPEG, PNG or WebP · Max 5 MB</p>
          </article>
        ))}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center"><NotebookPen className="mx-auto text-stone-300" size={40} /><h2 className="mt-3 text-lg font-bold">No homework right now</h2><p className="mt-1 text-sm text-slate-500">New homework from your teacher will appear here.</p></div>
      )}
    </div>
  );
}
