'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useRole } from '@/lib/use-role';
import {
  deleteQuiz,
  effectiveStatus,
  fetchQuizSummaries,
  formatDateTime,
  hskLabel,
  STATUS_LABELS,
  type QuizStatus,
  type QuizSummary,
} from '@/lib/quizzes';

const statusStyles: Record<QuizStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function AdminQuizzesPage() {
  const { status, isAdmin, isStaff } = useRole();

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<QuizSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');

    const result = await fetchQuizSummaries();

    if (result.error) {
      setLoadError(result.error);
      setQuizzes([]);
    } else {
      setQuizzes(result.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();

    if (typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem('quiz-flash');
      if (stored) {
        setFlash(stored);
        window.sessionStorage.removeItem('quiz-flash');
      }
    }
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return quizzes;

    return quizzes.filter((quiz) =>
      [quiz.title, quiz.category, quiz.hsk_level === null ? '' : hskLabel(quiz.hsk_level)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [quizzes, search]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    setActionError('');

    const result = await deleteQuiz(pendingDelete.id);

    setDeleting(false);
    setPendingDelete(null);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setFlash('Quiz deleted successfully.');
    await load();
  };

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading quizzes...</p>;
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Quiz Management</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can manage quizzes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p>
        <h1 className="mt-1 text-3xl font-bold">Quiz Management</h1>
        <p className="mt-2 text-slate-500">Create, view, edit and delete quizzes for your students.</p>
      </div>

      {flash && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{flash}</p>
      )}
      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quizzes by title, category or HSK level"
            aria-label="Search quizzes"
            className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>

        <Link
          href="/admin/quizzes/new"
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Add Quiz
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          Loading quizzes...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to load quizzes.</p>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-slate-700">No quizzes created yet.</p>
          <Link
            href="/admin/quizzes/new"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Add Quiz
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          No quizzes found.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="p-4">Quiz</th>
                  <th className="p-4">Questions</th>
                  <th className="p-4">HSK</th>
                  <th className="p-4">Schedule</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Results</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-stone-100 align-top">
                    <td className="p-4">
                      <p className="font-semibold text-slate-900">{quiz.title}</p>
                      {quiz.description && (
                        <p className="mt-1 max-w-md text-xs text-slate-500">{quiz.description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">Created {formatDate(quiz.created_at)}</p>
                    </td>
                    <td className="p-4 text-slate-600">{quiz.question_count}</td>
                    <td className="p-4 text-slate-600">{hskLabel(quiz.hsk_level)}</td>
                    <td className="p-4 text-xs text-slate-600">
                      <p>Starts {formatDateTime(quiz.start_at)}</p>
                      <p className="mt-0.5">Due {formatDateTime(quiz.deadline)}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[effectiveStatus(quiz)]}`}>
                        {STATUS_LABELS[effectiveStatus(quiz)]}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{quiz.submitted_count}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/quizzes/${quiz.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <Eye size={13} /> View
                        </Link>
                        <Link
                          href={`/admin/quizzes/${quiz.id}/results`}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <BarChart3 size={13} /> Results
                        </Link>
                        {isStaff && (
                          <Link
                            href={`/admin/quizzes/${quiz.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <Pencil size={13} /> Edit
                          </Link>
                        )}
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(quiz)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((quiz) => (
              <div key={quiz.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{quiz.title}</p>
                    {quiz.description && <p className="mt-1 text-xs text-slate-500">{quiz.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[effectiveStatus(quiz)]}`}>
                    {STATUS_LABELS[effectiveStatus(quiz)]}
                  </span>
                </div>

                <dl className="mt-3 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Questions</dt>
                    <dd>{quiz.question_count}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">HSK</dt>
                    <dd>{hskLabel(quiz.hsk_level)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Starts</dt>
                    <dd>{formatDateTime(quiz.start_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Deadline</dt>
                    <dd>{formatDateTime(quiz.deadline)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Submissions</dt>
                    <dd>{quiz.submitted_count}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Updated</dt>
                    <dd>{formatDate(quiz.updated_at)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/quizzes/${quiz.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <Eye size={13} /> View
                  </Link>
                  <Link
                    href={`/admin/quizzes/${quiz.id}/results`}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <BarChart3 size={13} /> Results
                  </Link>
                  {isStaff && (
                    <Link
                      href={`/admin/quizzes/${quiz.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <Pencil size={13} /> Edit
                    </Link>
                  )}
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(quiz)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deleting) setPendingDelete(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Delete quiz</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this quiz? This will also delete all of its questions and options.
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{pendingDelete.title}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
