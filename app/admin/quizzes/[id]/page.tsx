'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BarChart3, ChevronLeft, Pencil } from 'lucide-react';
import { useRole } from '@/lib/use-role';
import {
  effectiveStatus,
  fetchQuizDetail,
  formatDateTime,
  hskLabel,
  QUESTION_TYPE_LABELS,
  STATUS_LABELS,
  type QuizDetail,
} from '@/lib/quizzes';

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ViewQuizPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { status, isStaff } = useRole();

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError('');

    const result = await fetchQuizDetail(id);

    if (result.error || !result.data) {
      setLoadError(result.error || 'Quiz not found.');
      setQuiz(null);
    } else {
      setQuiz(result.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (status === 'allowed') load();
  }, [status, id]);

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading quiz...</p>;
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Quiz</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can view quizzes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/quizzes"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
        >
          <ChevronLeft size={16} /> Back to Quiz Management
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/quizzes/${id}/results`}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <BarChart3 size={15} /> View Results
          </Link>
          {isStaff && (
            <Link
              href={`/admin/quizzes/${id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Pencil size={15} /> Edit Quiz
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          Loading quiz...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to load quiz.</p>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      ) : quiz ? (
        <>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            {quiz.description && <p className="mt-2 text-slate-600">{quiz.description}</p>}

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-400">Category</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{quiz.category || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">HSK level</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{hskLabel(quiz.hsk_level)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Status</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{STATUS_LABELS[effectiveStatus(quiz)]}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Questions</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{quiz.questions.length}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Starts</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDateTime(quiz.start_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Deadline</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDateTime(quiz.deadline)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Created</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDate(quiz.created_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Updated</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDate(quiz.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-bold">Questions ({quiz.questions.length})</h2>

            {quiz.questions.length === 0 && (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-slate-500">
                This quiz has no questions yet.
              </p>
            )}

            {quiz.questions.map((question, index) => (
              <div key={question.clientId} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {index + 1}. {question.question}
                  </p>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {QUESTION_TYPE_LABELS[question.question_type]}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {question.options.map((option, optionIndex) => (
                    <li
                      key={option.id || optionIndex}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                        option.is_correct
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 text-slate-700'
                      }`}
                    >
                      <span>{option.option_text}</span>
                      {option.is_correct && (
                        <span className="text-xs font-semibold uppercase tracking-wide">Correct</span>
                      )}
                    </li>
                  ))}
                </ul>

                {question.explanation && (
                  <p className="mt-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Explanation: </span>
                    {question.explanation}
                  </p>
                )}

                {question.hint && (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Hint: </span>
                    {question.hint}
                  </p>
                )}
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/quizzes"
              className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to Quiz Management
            </Link>
            <Link
              href={`/admin/quizzes/${id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Pencil size={15} /> Edit Quiz
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
