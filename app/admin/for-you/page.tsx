'use client';

import { ClipboardEvent, FormEvent, useState } from 'react';
import { NotebookPen, Send, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const emptyForm = () => ({
  title: '',
  description: '',
  startsAt: localDateTime(new Date()),
  expiresAt: localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
});

export default function AdminForYouPage() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [promptImage, setPromptImage] = useState<File | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!form.title.trim()) {
      setMessage('Enter a homework title.');
      return;
    }
    if (!promptImage) {
      setMessage('Choose a homework image.');
      return;
    }
    const start = new Date(form.startsAt);
    const expiry = new Date(form.expiresAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(expiry.getTime()) || expiry.getTime() <= start.getTime()) {
      setMessage('End date must be after the start date.');
      return;
    }
    if (promptImage && (!ALLOWED_IMAGE_TYPES.includes(promptImage.type) || promptImage.size > MAX_IMAGE_SIZE)) {
      setMessage('Homework image must be JPEG, PNG, or WebP and no larger than 5 MB.');
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
    const { data: assignment, error } = await (supabase.from('for_you_assignments') as any).insert({
      created_by: auth.user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: start.toISOString(),
      content_type: 'word',
      chinese: '',
      expires_at: expiry.toISOString(),
    }).select('id').single();
    if (error) setMessage(error.message);
    else {
      if (promptImage && assignment?.id) {
        const extension = promptImage.type === 'image/png' ? 'png' : promptImage.type === 'image/webp' ? 'webp' : 'jpg';
        const imagePath = `assignments/${assignment.id}/prompt.${extension}`;
        const { error: uploadError } = await supabase.storage.from('homework-files').upload(imagePath, promptImage, { contentType: promptImage.type, upsert: true });
        if (uploadError) {
          await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
          setMessage(`Homework was not created: ${uploadError.message}`);
          setSaving(false);
          return;
        }
        const { error: imageSaveError } = await (supabase.from('for_you_assignments') as any).update({ image_path: imagePath }).eq('id', assignment.id);
        if (imageSaveError) {
          await supabase.storage.from('homework-files').remove([imagePath]);
          await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
          setMessage(`Homework was not created: ${imageSaveError.message}`);
          setSaving(false);
          return;
        }
      }
      setMessage('Homework assigned to every user.');
      setForm(emptyForm());
      setPromptImage(null);
    }
    setSaving(false);
  };

  const selectPromptImage = (file?: File) => {
    if (!file) {
      setPromptImage(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPromptImage(null);
      setMessage('Homework must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPromptImage(null);
      setMessage('Homework image must be 5 MB or smaller.');
      return;
    }
    setMessage('');
    setPromptImage(file);
  };

  const pastePromptImage = (event: ClipboardEvent<HTMLElement>) => {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    if (!image) {
      setMessage('Copy an image first, then paste it here.');
      return;
    }
    event.preventDefault();
    selectPromptImage(image);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Homework management</p>
        <h1 className="mt-1 text-3xl font-bold">Create Homework</h1>
        <p className="mt-2 text-slate-500">Create an image homework and choose when students can access it.</p>
      </div>

      {message && <p role="status" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><NotebookPen className="text-[#b91c1c]" size={20} /><h2 className="text-lg font-bold">New homework</h2></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">Title
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]" placeholder="Homework title" />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">Description <span className="font-normal text-slate-400">(optional)</span>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]" placeholder="Instructions for students" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Start date
            <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">End date
            <input required type="datetime-local" min={form.startsAt} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">Image
            <span tabIndex={0} onPaste={pastePromptImage} className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-center font-normal text-slate-600 outline-none hover:bg-stone-100 focus:border-[#b91c1c] focus:ring-2 focus:ring-red-100"><span className="flex items-center gap-2"><Upload size={18} />{promptImage ? promptImage.name : 'Choose or paste an image'}</span><span className="text-xs text-slate-400">JPEG, PNG or WebP · Max 5 MB · Ctrl+V / Cmd+V</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; selectPromptImage(file); }} /></span>
          </label>
        </div>
        <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={17} /> {saving ? 'Creating...' : 'Create homework'}</button>
      </form>

    </div>
  );
}
