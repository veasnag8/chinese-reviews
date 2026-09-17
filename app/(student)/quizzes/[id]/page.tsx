'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, ChevronLeft, Clock, Trophy, X } from 'lucide-react';
import {
  fetchStudentQuiz,
  fetchStudentResult,
  formatCountdown,
  formatDateTime,
  remainingMs,
  startQuizAttempt,
  submitQuizAttempt,
  type StudentQuiz,
  type StudentResult,
} from '@/lib/quizzes';

type Mode = 'loading' | 'error' | 'taking' | 'result';

export default function TakeQuizPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [mode, setMode] = useState<Mode>('loading');
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadResult = useCallback(async () => {
    const resultResponse = await fetchStudentResult(id);
    if (resultResponse.data) {
      setResult(resultResponse.data);
      setMode('result');
      return true;
    }
    return false;
  }, [id]);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!quiz || submitting) return;

      setSubmitting(true);
      setConfirmOpen(false);
      setErrorMessage('');

      const payload = quiz.questions.map((question) => ({
        question_id: question.id,
        selected_option_id: answers[question.id] ?? null,
      }));

      const response = await submitQuizAttempt(id, payload);

      if (response.error) {
        const showedResult = await loadResult();
        if (!showedResult) setErrorMessage(response.error);
        setSubmitting(false);
        return;
      }

      if (auto) setNotice('Time is up. Your answers were submitted automatically.');

      const showedResult = await loadResult();
      if (!showedResult) setErrorMessage('Your answers were submitted, but the result could not load.');
      setSubmitting(false);
    },
    [quiz, submitting, answers, id, loadResult]
  );

  useEffect(() => {
    if (!id) return;

    let active = true;

    const run = async () => {
      setMode('loading');
      setErrorMessage('');

      const quizResponse = await fetchStudentQuiz(id);

      if (!active) return;

      if (!quizResponse.data) {
        const showedResult = await loadResult();
        if (!active) return;
        if (!showedResult) {
          setErrorMessage(quizResponse.error || 'Quiz not found.');
          setMode('error');
        }
        return;
      }

      setQuiz(quizResponse.data);

      const startResponse = await startQuizAttempt(id);

      if (!active) return;

      if (startResponse.error) {
        const showedResult = await loadResult();
        if (!active) return;
        if (!showedResult) {
          setErrorMessage(startResponse.error);
          setMode('error');
        }
        return;
      }

      if (startResponse.status === 'submitted') {
        const showedResult = await loadResult();
        if (!active) return;
        if (!showedResult) {
          setErrorMessage('You already submitted this quiz, but the result could not load.');
          setMode('error');
        }
        return;
      }

      setRemaining(remainingMs(quizResponse.data.quiz.deadline));
      setMode('taking');
    };

    run();

    return () => {
      active = false;
    };
  }, [id, loadResult]);

  useEffect(() => {
    if (mode !== 'taking' || remaining === null) return;

    const timer = window.setInterval(() => {
      setRemaining((current) => (current === null ? null : current - 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mode, remaining === null]);

  useEffect(() => {
    if (mode !== 'taking' || remaining === null || remaining > 0) return;
    if (submitting) return;
    handleSubmit(true);
  }, [mode, remaining, submitting, handleSubmit]);

  const answeredCount = useMemo(
    () => (quiz ? quiz.questions.filter((question) => answers[question.id]).length : 0),
    [quiz, answers]
  );

  if (mode === 'loading') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
        Loading quiz...
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="space-y-4">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
        >
          <ChevronLeft size={16} /> Back to Quizzes
        </Link>
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to open this quiz.</p>
          <p className="mt-1 text-sm text-slate-500">{errorMessage}</p>
          <Link
            href="/quizzes"
            className="mt-4 inline-block rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  if (mode === 'result' && result) {
    return (
      <div className="space-y-6">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
        >
          <ChevronLeft size={16} /> Back to Quizzes
        </Link>

        {notice && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{notice}</p>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <Trophy className="mx-auto text-amber-500" size={32} />
          <h1 className="mt-2 text-2xl font-bold">{result.quiz.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Submitted {formatDateTime(result.attempt.submitted_at)}
          </p>

          <p className="mt-5 text-5xl font-bold text-[#b91c1c]">{result.attempt.percentage}%</p>
          <p className="mt-1 text-slate-600">
            {result.attempt.score} of {result.attempt.total_questions} correct
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <dt className="text-emerald-700">Correct</dt>
              <dd className="mt-0.5 text-xl font-bold text-emerald-800">
                {result.attempt.correct_answers}
              </dd>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <dt className="text-red-700">Wrong</dt>
              <dd className="mt-0.5 text-xl font-bold text-red-800">{result.attempt.wrong_answers}</dd>
            </div>
          </dl>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Your answers</h2>
          {result.answers.map((answer, index) => (
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
                    Your answer
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
      </div>
    );
  }

  if (!quiz) return null;

  const unanswered = quiz.questions.length - answeredCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/quizzes"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
          >
            <ChevronLeft size={16} /> Back to Quizzes
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{quiz.quiz.title}</h1>
          {quiz.quiz.description && (
            <p className="mt-1 text-sm text-slate-500">{quiz.quiz.description}</p>
          )}
        </div>

        {remaining !== null && (
          <div
            className={`rounded-xl border px-4 py-3 text-center ${
              remaining <= 60000
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-stone-200 bg-white text-slate-700'
            }`}
          >
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
              <Clock size={13} /> Time left
            </p>
            <p className="mt-0.5 text-xl font-bold">{formatCountdown(remaining)}</p>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Answered <span className="font-semibold text-slate-900">{answeredCount}</span> of{' '}
          {quiz.questions.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-[#b91c1c] transition-all"
            style={{
              width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="font-semibold text-slate-900">
              {index + 1}. {question.question}
            </p>
            {question.hint && <p className="mt-1 text-xs text-slate-500">Hint: {question.hint}</p>}

            <div className="mt-3 space-y-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                      selected ? 'border-[#b91c1c] bg-red-50 text-slate-900' : 'border-stone-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={selected}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option.id }))
                      }
                      className="size-4"
                    />
                    <span>{option.option_text}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 backdrop-blur md:bottom-4">
        <p className="text-sm text-slate-600">
          {unanswered > 0 ? `${unanswered} unanswered question${unanswered === 1 ? '' : 's'}` : 'All questions answered'}
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => setConfirmOpen(true)}
          className="rounded-lg bg-[#b91c1c] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !submitting) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Submit quiz?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You can only submit once. Your score will be saved and shown to your teacher.
            </p>
            {unanswered > 0 && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-700">
                {unanswered} question{unanswered === 1 ? '' : 's'} left unanswered.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Keep answering
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                className="rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
