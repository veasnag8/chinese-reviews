'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { resolveDisplayName, sendQuizNotification } from '@/lib/notify';
import { ensureClassForDate } from '@/lib/schedule';
import { meaningFromWord, pickSimilarDistractors, type QuizMeaning } from '@/lib/quiz/distractors';

type ClassRow = { id: string; name: string; date: string };

type WordRow = {
  id: string;
  chinese: string;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  category?: string | null;
  class_id?: string | null;
  created_at: string;
  classes?: { id: string; name: string; date: string } | null;
};

type QuizQuestion = {
  id: string;
  chinese: string;
  correct_answer: string;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  options?: string[] | null;
  class_id?: string | null;
  created_at: string;
};

type QuestionForm = {
  chinese: string;
  answer: string;
  pinyin: string;
  khmer: string;
  english: string;
  date: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const itemDate = (createdAt: string, classDate?: string | null) => classDate || createdAt.slice(0, 10);

const toMeaning = (item: {
  chinese: string;
  answer: string;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  category?: string | null;
  class_id?: string | null;
}): QuizMeaning => ({
  chinese: item.chinese,
  answer: item.answer,
  pinyin: item.pinyin,
  khmer: item.khmer,
  english: item.english,
  category: item.category,
  class_id: item.class_id,
});

export default function AdminQuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [words, setWords] = useState<WordRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [isAdmin, setIsAdmin] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<QuestionForm>({
    chinese: '',
    answer: '',
    pinyin: '',
    khmer: '',
    english: '',
    date: today(),
  });

  const loadAll = async () => {
    if (!supabase) return;
    const [questionsResult, wordsResult, classesResult] = await Promise.all([
      supabase
        .from('quiz_questions')
        .select('id, chinese, correct_answer, pinyin, khmer, english, options, class_id, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('words').select('id, chinese, pinyin, khmer, english, category, class_id, created_at, classes!words_class_id_fkey (id, name, date)').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name, date').order('date', { ascending: false }),
    ]);

    if (questionsResult.error) setMessage(questionsResult.error.message);
    else setQuestions((questionsResult.data || []) as QuizQuestion[]);

    if (wordsResult.error) setMessage(wordsResult.error.message);
    else setWords((wordsResult.data || []) as WordRow[]);

    if (classesResult.error) setMessage(classesResult.error.message);
    else setClasses((classesResult.data || []) as ClassRow[]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      if (!supabase) {
        setAccess('denied');
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setAccess('denied');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      setIsAdmin(role === 'admin');
      setAccess(role === 'admin' || role === 'teacher' ? 'allowed' : 'denied');
    };
    loadRole();
  }, []);

  const classDateById = useMemo(
    () => Object.fromEntries(classes.map((item) => [item.id, item.date])),
    [classes]
  );

  const wordsForDate = useMemo(
    () => words.filter((item) => itemDate(item.created_at, item.classes?.date) === date),
    [words, date]
  );

  const questionsForDate = useMemo(
    () => questions.filter((item) => itemDate(item.created_at, item.class_id ? classDateById[item.class_id] : null) === date),
    [questions, date, classDateById]
  );

  const distractorPool = useMemo(
    () =>
      words
        .map((item) =>
          toMeaning({
            chinese: item.chinese,
            answer: meaningFromWord(item),
            pinyin: item.pinyin,
            khmer: item.khmer,
            english: item.english,
            category: item.category,
            class_id: item.class_id,
          })
        )
        .filter((item) => item.answer),
    [words]
  );

  const existingChinese = useMemo(
    () => new Set(questions.map((item) => item.chinese.trim())),
    [questions]
  );

  const toggle = (id: string, selected: string[], setSelected: (ids: string[]) => void) => {
    setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const toggleAll = (ids: string[], selected: string[], setSelected: (ids: string[]) => void) => {
    setSelected(ids.every((id) => selected.includes(id)) ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  const addSelectedWords = async () => {
    if (!supabase || selectedWordIds.length === 0) return;
    setSaving(true);
    setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setMessage('Please sign in again.');
      setSaving(false);
      return;
    }

    const selectedWords = wordsForDate.filter((item) => selectedWordIds.includes(item.id));
    const rows = selectedWords
      .map((item) => {
        const answerText = meaningFromWord(item);
        if (!answerText || existingChinese.has(item.chinese.trim())) return null;
        const target = toMeaning({
          chinese: item.chinese,
          answer: answerText,
          pinyin: item.pinyin,
          khmer: item.khmer,
          english: item.english,
          category: item.category,
          class_id: item.class_id,
        });
        return {
          question_type: 'chinese-to-meaning' as const,
          chinese: item.chinese,
          pinyin: item.pinyin,
          khmer: item.khmer,
          english: item.english,
          correct_answer: answerText,
          options: pickSimilarDistractors(target, distractorPool, 3),
          class_id: item.class_id || null,
          user_id: authData.user.id,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      setMessage('Selected words are already in the quiz, or they have no meaning to use as an answer.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('quiz_questions').insert(rows as never);
    if (error) setMessage(error.message);
    else {
      const result = await sendQuizNotification(
        'quiz-updated',
        `${resolveDisplayName(authData.user)} added ${rows.length} new quiz questions for ${date}`
      );
      if (!result.ok) setMessage(result.error || 'Could not notify other users.');
      setSelectedWordIds([]);
      await loadAll();
    }
    setSaving(false);
  };

  const openAddForm = () => {
    setEditingQuestion(null);
    setForm({ chinese: '', answer: '', pinyin: '', khmer: '', english: '', date });
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setForm({
      chinese: question.chinese,
      answer: question.correct_answer,
      pinyin: question.pinyin || '',
      khmer: question.khmer || '',
      english: question.english || '',
      date: question.class_id ? classDateById[question.class_id] || date : date,
    });
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingQuestion(null);
    setFormError('');
  };

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const chinese = form.chinese.trim();
    const answerText = form.answer.trim();
    if (!chinese || !answerText) {
      setFormError('Chinese word and correct answer are required.');
      return;
    }

    setSaving(true);
    setFormError('');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setFormError('Please sign in again.');
      setSaving(false);
      return;
    }

    const lesson = await ensureClassForDate(form.date);
    if (lesson.error || !lesson.id) {
      setFormError(lesson.error || 'Could not create the lesson for this date.');
      setSaving(false);
      return;
    }

    const target = toMeaning({
      chinese,
      answer: answerText,
      pinyin: form.pinyin,
      khmer: form.khmer,
      english: form.english,
      class_id: lesson.id,
    });
    const options = pickSimilarDistractors(target, distractorPool, 3);
    const payload = {
      chinese,
      pinyin: form.pinyin || null,
      khmer: form.khmer || null,
      english: form.english || null,
      correct_answer: answerText,
      options,
      class_id: lesson.id,
    };

    const { error } = editingQuestion
      ? await (supabase.from('quiz_questions') as any).update(payload).eq('id', editingQuestion.id)
      : await supabase
          .from('quiz_questions')
          .insert({ ...payload, question_type: 'chinese-to-meaning', user_id: authData.user.id } as never);

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    const action = editingQuestion ? 'updated' : 'added';
    const result = await sendQuizNotification(
      'quiz-updated',
      `${resolveDisplayName(authData.user)} ${action} a quiz question for ${form.date}`
    );
    if (!result.ok) setMessage(result.error || 'Could not notify other users.');
    setFormOpen(false);
    setEditingQuestion(null);
    await loadAll();
    setSaving(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!supabase || !window.confirm('Delete this quiz question?')) return;
    const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
    if (error) setMessage(error.message);
    else {
      setSelectedQuestionIds((current) => current.filter((item) => item !== id));
      await loadAll();
    }
  };

  const deleteSelectedQuestions = async () => {
    if (!supabase || selectedQuestionIds.length === 0 || !window.confirm(`Delete ${selectedQuestionIds.length} selected quiz questions?`)) return;
    const { error } = await supabase.from('quiz_questions').delete().in('id', selectedQuestionIds);
    if (error) setMessage(error.message);
    else {
      setSelectedQuestionIds([]);
      await loadAll();
    }
  };

  const wordIds = wordsForDate.map((item) => item.id);
  const questionIds = questionsForDate.map((item) => item.id);

  if (access === 'checking') {
    return <p className="p-6 text-slate-500">Checking your access…</p>;
  }

  if (access === 'denied') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Manage Quiz</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can manage quizzes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p>
        <h1 className="mt-1 text-3xl font-bold">Manage Quiz</h1>
        <p className="mt-2 text-slate-500">
          Review the quiz list, add a new question, or edit and delete existing ones. Students get random similar wrong answers from other words.
        </p>
      </div>
      {message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5">
        <label className="text-sm font-semibold">
          Filter by date
          <span className="relative mt-1.5 block">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedWordIds([]);
                setSelectedQuestionIds([]);
              }}
              className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 font-normal sm:w-56"
            />
          </span>
        </label>
        <p className="pb-2 text-sm text-slate-500">
          {wordsForDate.length} words · {questionsForDate.length} quiz questions on this date
        </p>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
          <h2 className="font-bold">Quiz questions on {date}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                disabled={selectedQuestionIds.length === 0}
                onClick={deleteSelectedQuestions}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
              >
                <Trash2 size={14} /> Delete selected ({selectedQuestionIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus size={15} /> Add new
            </button>
          </div>
        </div>
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  aria-label="Select all questions"
                  checked={questionIds.length > 0 && questionIds.every((id) => selectedQuestionIds.includes(id))}
                  onChange={() => toggleAll(questionIds, selectedQuestionIds, setSelectedQuestionIds)}
                />
              </th>
              <th className="p-4">Chinese word</th>
              <th className="p-4">Correct answer</th>
              <th className="p-4">Similar wrong answers</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {questionsForDate.map((question) => (
              <tr key={question.id} className="border-b border-stone-100">
                <td className="p-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${question.chinese}`}
                    checked={selectedQuestionIds.includes(question.id)}
                    onChange={() => toggle(question.id, selectedQuestionIds, setSelectedQuestionIds)}
                  />
                </td>
                <td className="p-4 text-lg font-semibold">{question.chinese}</td>
                <td className="p-4">{question.correct_answer}</td>
                <td className="p-4 text-slate-600">{question.options?.length ? question.options.join(' · ') : 'Generated when students take the quiz'}</td>
                <td className="p-4">
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(question)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button type="button" onClick={() => deleteQuestion(question.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Admin only</span>
                  )}
                </td>
              </tr>
            ))}
            {questionsForDate.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No quiz questions for this date yet. Use “Add new” or add words below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
          <h2 className="font-bold">Words on {date}</h2>
          <button
            type="button"
            disabled={saving || selectedWordIds.length === 0}
            onClick={addSelectedWords}
            className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Add selected to quiz ({selectedWordIds.length})
          </button>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  aria-label="Select all words"
                  checked={wordIds.length > 0 && wordIds.every((id) => selectedWordIds.includes(id))}
                  onChange={() => toggleAll(wordIds, selectedWordIds, setSelectedWordIds)}
                />
              </th>
              <th className="p-4">Chinese</th>
              <th className="p-4">Pinyin</th>
              <th className="p-4">Meaning</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {wordsForDate.map((item) => {
              const meaning = meaningFromWord(item);
              const alreadyAdded = existingChinese.has(item.chinese.trim());
              return (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.chinese}`}
                      checked={selectedWordIds.includes(item.id)}
                      onChange={() => toggle(item.id, selectedWordIds, setSelectedWordIds)}
                    />
                  </td>
                  <td className="p-4 text-lg font-semibold">{item.chinese}</td>
                  <td className="p-4 text-slate-600">{item.pinyin || '—'}</td>
                  <td className="p-4">{meaning || '—'}</td>
                  <td className="p-4 text-xs font-semibold">
                    {alreadyAdded ? <span className="text-emerald-700">In quiz</span> : <span className="text-slate-500">Not added</span>}
                  </td>
                </tr>
              );
            })}
            {wordsForDate.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No words for this date. Add words in Words List, or pick another date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingQuestion ? 'Edit quiz question' : 'Add new quiz question'}</h2>
              <button type="button" onClick={closeForm} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-stone-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveQuestion} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold">
                Chinese word
                <input
                  required
                  value={form.chinese}
                  onChange={(event) => setForm((current) => ({ ...current, chinese: event.target.value }))}
                  placeholder="学"
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Correct answer
                <input
                  required
                  value={form.answer}
                  onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                  placeholder="រៀន"
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-semibold">
                  Pinyin
                  <input
                    value={form.pinyin}
                    onChange={(event) => setForm((current) => ({ ...current, pinyin: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Khmer
                  <input
                    value={form.khmer}
                    onChange={(event) => setForm((current) => ({ ...current, khmer: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  English
                  <input
                    value={form.english}
                    onChange={(event) => setForm((current) => ({ ...current, english: event.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                Lesson date
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal sm:w-56"
                />
              </label>
              {formError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? 'Saving...' : editingQuestion ? 'Save changes' : 'Add question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}