'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, ClipboardList, PlayCircle, Trophy } from 'lucide-react';
import {
  effectiveStatus,
  fetchStudentQuizList,
  formatDateTime,
  formatCountdown,
  remainingMs,
  type StudentQuizListItem,
} from '@/lib/quizzes';

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function StudentQuizzesPage() {
  const [quizzes, setQuizzes] = useState<StudentQuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    fetchStudentQuizList().then((result) => {
      if (!active) return;
      if (result.error) setLoadError(result.error);
      setQuizzes(result.data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const { available, completed } = useMemo(() => {
    const availableList: StudentQuizListItem[] = [];
    const completedList: StudentQuizListItem[] = [];

    quizzes.forEach((quiz) => {
      const state = effectiveStatus(quiz);
      const started =
        quiz.start_at && new Date(quiz.start_at).getTime() > Date.now();
      if (quiz.submitted) completedList.push(quiz);
      else if (state === 'active' && !started) availableList.push(quiz);
      else availableList.push(quiz);
    });

    availableList.sort((a, b) => {
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return aDeadline - bDeadline;
    });

    return { available: availableList, completed: completedList };
  }, [quizzes]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Practice</p>
        <h1 className="mt-1 text-3xl font-bold">Quizzes</h1>
        <p className="mt-2 text-slate-500">Take the quizzes your teacher has assigned and review your scores.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          Loading quizzes...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to load quizzes.</p>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <ClipboardList className="mx-auto text-slate-300" size={28} />
          <p className="mt-3 text-slate-700">No quizzes yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            New quizzes will appear here and pop up as soon as they are available.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Available</h2>

            {available.length === 0 ? (
              <p className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-slate-500">
                Nothing available right now.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {available.map((quiz) => {
                  const state = effectiveStatus(quiz);
                  const startTime = quiz.start_at ? new Date(quiz.start_at).getTime() : null;
                  const notStarted = startTime !== null && startTime > Date.now();
                  const remaining = remainingMs(quiz.deadline);
                  const expired = state === 'expired';

                  return (
                    <div key={quiz.id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">{quiz.title}</h3>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[state]}`}>
                          {notStarted ? 'Scheduled' : state === 'expired' ? 'Expired' : 'Open'}
                        </span>
                      </div>

                      {quiz.description && (
                        <p className="mt-1 text-sm text-slate-500">{quiz.description}</p>
                      )}

                      <dl className="mt-3 space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-slate-400" />
                          <span>{quiz.question_count} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock size={14} className="text-slate-400" />
                          <span>
                            {notStarted ? 'Starts ' : 'Due '}
                            {formatDateTime(notStarted ? quiz.start_at : quiz.deadline)}
                          </span>
                        </div>
                        {!expired && !notStarted && remaining !== null && (
                          <p className="text-xs font-semibold text-[#b91c1c]">
                            Time left {formatCountdown(remaining)}
                          </p>
                        )}
                      </dl>

                      <div className="mt-4">
                        {notStarted ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
                            Not started yet
                          </span>
                        ) : expired ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
                            Quiz ended
                          </span>
                        ) : (
                          <Link
                            href={`/quizzes/${quiz.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
                          >
                            <PlayCircle size={16} /> Start Quiz
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Completed</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {completed.map((quiz) => (
                  <div key={quiz.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{quiz.title}</h3>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <Trophy size={15} className="text-amber-500" />
                      <span className="font-semibold text-slate-900">
                        {quiz.score} / {quiz.total_questions}
                      </span>
                      <span>•</span>
                      <span>{quiz.percentage ?? 0}%</span>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        View Result
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
