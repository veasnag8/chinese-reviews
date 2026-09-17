'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, ChevronLeft, X } from 'lucide-react';
import { useRole } from '@/lib/use-role';
import { fetchResultDetail, formatDateTime, type StudentResult } from '@/lib/quizzes';

type ResultDetail = StudentResult & { student_name: string; student_email: string };

export default function ResultDetailPage() {
  const params = useParams<{ id: string; attemptId: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const attemptId = typeof params?.attemptId === 'string' ? params.attemptId : '';
  const { status } = useRole();

  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    if (!attemptId) return;
    setLoading(true);
    setLoadError('');

    const result = await fetchResultDetail(attemptId);

    if (result.error || !result.data) {
      setLoadError(result.error || 'Result not found.');
      setDetail(null);
    } else {
      setDetail(result.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (status === 'allowed') load();
  }, [status, attemptId]);

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading result...</p>;
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Student Result</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can view student results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/quizzes/${id}/results`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
      >
        <ChevronLeft size={16} /> Back to Results
      </Link>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          Loading result...
        </div>
      ) : loadError || !detail ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to load this result.</p>
          <p className="mt-1 text-sm text-slate-500">{loadError || 'Result not found.'}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              Student result
            </p>
            <h1 className="mt-1 text-3xl font-bold">{detail.student_name}</h1>
            {detail.student_email && <p className="mt-1 text-sm text-slate-500">{detail.student_email}</p>}
            <p className="mt-1 text-sm text-slate-500">
              {detail.quiz.title} • Submitted {formatDateTime(detail.attempt.submitted_at)}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-400">Score</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">
                  {detail.attempt.score} / {detail.attempt.total_questions}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Percentage</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">{detail.attempt.percentage}%</dd>
              </div>
              <div>
                <dt className="text-slate-400">Correct</dt>
                <dd className="mt-0.5 text-xl font-bold text-emerald-700">{detail.attempt.correct_answers}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Wrong</dt>
                <dd className="mt-0.5 text-xl font-bold text-red-600">{detail.attempt.wrong_answers}</dd>
              </div>
            </dl>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-bold">Answers ({detail.answers.length})</h2>

            {detail.answers.map((answer, index) => (
              <div key={answer.question_id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {index + 1}. {answer.question}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      answer.is_correct
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {answer.is_correct ? <Check size={13} /> : <X size={13} />}
                    {answer.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-stone-200 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Student answer
                    </p>
                    <p className={`mt-1 ${answer.is_correct ? 'text-emerald-700' : 'text-red-600'}`}>
                      {answer.student_answer || 'Not answered'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Correct answer
                    </p>
                    <p className="mt-1 text-emerald-800">{answer.correct_answer || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
