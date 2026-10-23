'use client';

import { ClipboardEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardPaste, Clock3, ImageIcon, Loader2, NotebookPen, Pencil, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  expires_at: string;
  image_path: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  user_id: string;
  answer_image_path: string;
  status: 'pending_checking' | 'checked';
  submitted_at: string;
  checked_at: string | null;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionUrls, setSubmissionUrls] = useState<Record<string, string>>({});
  const [studentProfiles, setStudentProfiles] = useState<Record<string, StudentProfile>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [promptImage, setPromptImage] = useState<File | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await (supabase.from('for_you_assignments') as any)
      .select('id, title, description, starts_at, expires_at, image_path, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setMessage(error.message);
    } else {
      const rows = (data || []) as Assignment[];
      setAssignments(rows);
      const urls = await Promise.all(rows.filter((item) => item.image_path).map(async (item) => {
        const { data: signed } = await supabase.storage.from('homework-files').createSignedUrl(item.image_path!, 3600);
        return [item.id, signed?.signedUrl || ''] as const;
      }));
      setImageUrls(Object.fromEntries(urls));

      const { data: submissionData, error: submissionError } = await (supabase.from('homework_submissions') as any)
        .select('id, assignment_id, user_id, answer_image_path, status, submitted_at, checked_at')
        .order('submitted_at', { ascending: false });
      if (submissionError) {
        setMessage(submissionError.message);
      } else {
        const submissionRows = (submissionData || []) as Submission[];
        setSubmissions(submissionRows);
        const userIds = [...new Set(submissionRows.map((submission) => submission.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
          setStudentProfiles(Object.fromEntries(((profiles || []) as StudentProfile[]).map((profile) => [profile.id, profile])));
        } else {
          setStudentProfiles({});
        }
        const submissionImages = await Promise.all(submissionRows.map(async (submission) => {
          const { data: signed } = await supabase.storage.from('homework-files').createSignedUrl(submission.answer_image_path, 3600);
          return [submission.id, signed?.signedUrl || ''] as const;
        }));
        setSubmissionUrls(Object.fromEntries(submissionImages));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  const openCreateForm = () => {
    setEditingAssignment(null);
    setForm(emptyForm());
    setPromptImage(null);
    setMessage('');
    setFormOpen(true);
  };

  const openEditForm = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setForm({
      title: assignment.title,
      description: assignment.description || '',
      startsAt: localDateTime(new Date(assignment.starts_at)),
      expiresAt: localDateTime(new Date(assignment.expires_at)),
    });
    setPromptImage(null);
    setMessage('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingAssignment(null);
    setPromptImage(null);
    setForm(emptyForm());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!form.title.trim()) {
      setMessage('Enter a homework title.');
      return;
    }
    if (!promptImage && !editingAssignment?.image_path) {
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
    const assignmentValues = {
      created_by: auth.user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: start.toISOString(),
      content_type: 'word',
      chinese: '',
      expires_at: expiry.toISOString(),
    };
    const query = editingAssignment
      ? (supabase.from('for_you_assignments') as any).update(assignmentValues).eq('id', editingAssignment.id).select('id').single()
      : (supabase.from('for_you_assignments') as any).insert(assignmentValues).select('id').single();
    const { data: assignment, error } = await query;
    if (error) setMessage(error.message);
    else {
      if (promptImage && assignment?.id) {
        const extension = promptImage.type === 'image/png' ? 'png' : promptImage.type === 'image/webp' ? 'webp' : 'jpg';
        const imagePath = `assignments/${assignment.id}/prompt.${extension}`;
        const { error: uploadError } = await supabase.storage.from('homework-files').upload(imagePath, promptImage, { contentType: promptImage.type, upsert: true });
        if (uploadError) {
          if (!editingAssignment) await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
          setMessage(`Homework was not created: ${uploadError.message}`);
          setSaving(false);
          return;
        }
        const { error: imageSaveError } = await (supabase.from('for_you_assignments') as any).update({ image_path: imagePath }).eq('id', assignment.id);
        if (imageSaveError) {
          await supabase.storage.from('homework-files').remove([imagePath]);
          if (!editingAssignment) await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
          setMessage(`Homework was not created: ${imageSaveError.message}`);
          setSaving(false);
          return;
        }
        if (editingAssignment?.image_path && editingAssignment.image_path !== imagePath) {
          await supabase.storage.from('homework-files').remove([editingAssignment.image_path]);
        }
      }
      setMessage(editingAssignment ? 'Homework updated.' : 'Homework assigned to every user.');
      closeForm();
      await loadAssignments();
    }
    setSaving(false);
  };

  const deleteAssignment = async (assignment: Assignment) => {
    if (!supabase || !window.confirm(`Delete “${assignment.title}”?`)) return;
    const { error } = await (supabase.from('for_you_assignments') as any).delete().eq('id', assignment.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (assignment.image_path) await supabase.storage.from('homework-files').remove([assignment.image_path]);
    setAssignments((current) => current.filter((item) => item.id !== assignment.id));
    setMessage('Homework deleted.');
  };

  const markSubmissionChecked = async (submission: Submission) => {
    if (!supabase || submission.status === 'checked') return;
    setCheckingId(submission.id);
    setMessage('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage('Please sign in again.');
      setCheckingId(null);
      return;
    }
    const checkedAt = new Date().toISOString();
    const { error } = await (supabase.from('homework_submissions') as any)
      .update({ status: 'checked', checked_at: checkedAt, checked_by: auth.user.id })
      .eq('id', submission.id);
    if (error) setMessage(error.message);
    else {
      setSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, status: 'checked', checked_at: checkedAt } : item));
      setMessage('Student submission marked as checked.');
    }
    setCheckingId(null);
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

  const convertClipboardImageToPng = async (file: File) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) return file;

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Unable to read the copied image.'));
        element.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to prepare the copied image.');
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to convert the copied image.')), 'image/png');
      });
      return new File([blob], 'pasted-homework.png', { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const pastePromptImage = async (event: ClipboardEvent<HTMLFormElement>) => {
    const clipboardFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    const itemFile = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    const image = clipboardFile || itemFile;
    if (!image) return;

    event.preventDefault();
    try {
      const normalizedImage = await convertClipboardImageToPng(image);
      selectPromptImage(normalizedImage);
    } catch (error) {
      setPromptImage(null);
      setMessage(error instanceof Error ? error.message : 'Unable to paste the copied image.');
    }
  };

  const pasteImageFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      setMessage('Image paste is not supported by this browser. Tap Choose image to select the screenshot from Photos.');
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await clipboardItem.getType(imageType);
        const extension = imageType.split('/')[1] || 'png';
        const copiedImage = new File([blob], `pasted-homework.${extension}`, { type: imageType });
        selectPromptImage(await convertClipboardImageToPng(copiedImage));
        return;
      }
      setMessage('No image was found in the clipboard. Copy a screenshot first, or choose one from Photos.');
    } catch {
      setMessage('Clipboard access was blocked. Allow Paste when prompted, or tap Choose image to select from Photos.');
    }
  };

  const assignmentStatus = (assignment: Assignment) => {
    const now = Date.now();
    if (new Date(assignment.starts_at).getTime() > now) return { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' };
    if (new Date(assignment.expires_at).getTime() <= now) return { label: 'Expired', className: 'bg-stone-100 text-stone-600' };
    return { label: 'Active', className: 'bg-emerald-50 text-emerald-700' };
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Homework management</p>
          <h1 className="mt-1 text-3xl font-bold">Homework</h1>
          <p className="mt-2 text-slate-500">View, edit, and manage image homework for every student.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus size={18} /> Create homework</button>
      </div>

      {message && <p role="status" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      {formOpen && <form onSubmit={submit} onPaste={(event) => void pastePromptImage(event)} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><NotebookPen className="text-[#b91c1c]" size={20} /><h2 className="text-lg font-bold">{editingAssignment ? 'Edit homework' : 'New homework'}</h2></div>
          <button type="button" onClick={closeForm} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-stone-100"><X size={20} /></button>
        </div>
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
            {editingAssignment && imageUrls[editingAssignment.id] && !promptImage && <img src={imageUrls[editingAssignment.id]} alt="Current homework" className="mt-2 max-h-48 w-full rounded-xl border border-stone-200 object-contain" />}
            <span tabIndex={0} className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-center font-normal text-slate-600 outline-none hover:bg-stone-100 focus:border-[#b91c1c] focus:ring-2 focus:ring-red-100"><span className="flex items-center gap-2"><Upload size={18} />{promptImage ? promptImage.name : editingAssignment?.image_path ? 'Choose a replacement image' : 'Choose an image or screenshot'}</span><span className="text-xs text-slate-400">JPEG, PNG or WebP · Max 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; selectPromptImage(file); }} /></span>
            <button type="button" onClick={() => void pasteImageFromClipboard()} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 font-semibold text-amber-950 hover:bg-amber-500"><ClipboardPaste size={18} /> Paste image</button>
            <span className="mt-1 block text-center text-xs font-normal text-slate-400">PC: copy a screenshot, then paste · iPhone/iPad: copy the image and tap Paste image</span>
          </label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={closeForm} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-stone-50">Cancel</button>
          <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Send size={17} /> {saving ? 'Saving...' : editingAssignment ? 'Save changes' : 'Create homework'}</button>
        </div>
      </form>}

      <section aria-labelledby="homework-list-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="homework-list-title" className="text-xl font-bold">All homework</h2>
          {!loading && <span className="text-sm text-slate-500">{assignments.length} {assignments.length === 1 ? 'item' : 'items'}</span>}
        </div>
        {loading ? <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">Loading homework…</div> : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <NotebookPen className="mx-auto text-slate-300" size={36} /><h3 className="mt-3 font-semibold">No homework yet</h3><p className="mt-1 text-sm text-slate-500">Create your first image homework for students.</p>
            <button type="button" onClick={openCreateForm} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={17} /> Create homework</button>
          </div>
        ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => {
            const status = assignmentStatus(assignment);
            return <article key={assignment.id} onClick={() => openEditForm(assignment)} className="group cursor-pointer overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md">
              <div className="relative aspect-[16/9] bg-stone-100">
                {imageUrls[assignment.id] ? <img src={imageUrls[assignment.id]} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-300" size={40} />}
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 text-lg font-bold text-slate-900">{assignment.title}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{assignment.description || 'No description'}</p>
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500"><Clock3 className="mt-0.5 shrink-0" size={15} /><span>{formatDate(assignment.starts_at)}<br />to {formatDate(assignment.expires_at)}</span></div>
                <div className="mt-4 flex gap-2 border-t border-stone-100 pt-3">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openEditForm(assignment); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 text-sm font-semibold text-slate-700 hover:bg-stone-50"><Pencil size={15} /> Edit</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void deleteAssignment(assignment); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"><Trash2 size={15} /> Delete</button>
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>

      <section aria-labelledby="submission-list-title" className="pt-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="submission-list-title" className="text-xl font-bold">Student submissions</h2>
            <p className="mt-1 text-sm text-slate-500">Open uploaded answers and mark them as checked.</p>
          </div>
          {!loading && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">{submissions.filter((submission) => submission.status === 'pending_checking').length} pending</span>}
        </div>
        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">Loading submissions…</div>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <ImageIcon className="mx-auto text-stone-300" size={36} />
            <h3 className="mt-3 font-semibold">No student submissions yet</h3>
            <p className="mt-1 text-sm text-slate-500">Uploaded homework answers will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {submissions.map((submission) => {
              const student = studentProfiles[submission.user_id];
              const assignment = assignments.find((item) => item.id === submission.assignment_id);
              const isChecked = submission.status === 'checked';
              return (
                <article key={submission.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <a href={submissionUrls[submission.id] || undefined} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center bg-stone-100">
                    {submissionUrls[submission.id] ? <img src={submissionUrls[submission.id]} alt={`Answer from ${student?.full_name || 'student'}`} className="h-full w-full object-contain" /> : <ImageIcon className="text-stone-300" size={40} />}
                  </a>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{student?.full_name || student?.email || 'Student'}</h3>{student?.full_name && student.email && <p className="truncate text-xs text-slate-500">{student.email}</p>}</div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isChecked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{isChecked ? 'Checked' : 'Pending'}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">{assignment?.title || 'Deleted homework'}</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted {formatDate(submission.submitted_at)}</p>
                    {isChecked ? (
                      <div className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17} /> Checked{submission.checked_at ? ` · ${formatDate(submission.checked_at)}` : ''}</div>
                    ) : (
                      <button type="button" disabled={checkingId !== null} onClick={() => void markSubmissionChecked(submission)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-amber-950 hover:bg-amber-500 disabled:opacity-50">{checkingId === submission.id ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}{checkingId === submission.id ? 'Saving…' : 'Mark as checked'}</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
