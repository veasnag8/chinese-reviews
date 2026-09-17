'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BarChart3, ChevronLeft, Download, Eye, Search } from 'lucide-react';
import { useRole } from '@/lib/use-role';
import {
  fetchQuizDetail,
  fetchQuizResults,
  fetchWordPerformance,
  formatDateTime,
  type QuizDetail,
  type QuizSubmissionRow,
  type WordPerformanceRow,
} from '@/lib/quizzes';

const scoreTone = (percentage: number) => {
  if (percentage >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (percentage >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
};

const BANDS = [
  { value: 'all', label: 'All scores' },
  { value: 'high', label: '80% and above' },
  { value: 'mid', label: '60% – 79%' },
  { value: 'low', label: 'Below 60%' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'highest', label: 'Highest score' },
  { value: 'lowest', label: 'Lowest score' },
  { value: 'name', label: 'Student name' },
];

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const downloadCsv = (rows: QuizSubmissionRow[]) => {
  const header = [
    'Student',
    'Email',
    'Score',
    'Total',
    'Correct',
    'Wrong',
    'Percentage',
    'Submitted at',
  ];
  const lines = rows.map((row) =>
    [
      csvCell(row.student_name),
      csvCell(row.student_email),
      csvCell(row.score),
      csvCell(row.total_questions),
      csvCell(row.correct_answers),
      csvCell(row.wrong_answers),
      csvCell(row.percentage),
      csvCell(row.submitted_at || ''),
    ].join(',')
  );
  const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quiz-results.csv';
  link.click();
  URL.revokeObjectURL(url);
};

export default function QuizResultsPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { status } = useRole();

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [results, setResults] = useState<QuizSubmissionRow[]>([]);
  const [words, setWords] = useState<WordPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [band, setBand] = useState('all');
  const [sort, setSort] = useState('newest');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError('');

    const [quizResult, resultsResult, wordsResult] = await Promise.all([
      fetchQuizDetail(id),
      fetchQuizResults(id),
      fetchWordPerformance(id),
    ]);

    if (quizResult.error || !quizResult.data) {
      setLoadError(quizResult.error || 'Quiz not found.');
      setQuiz(null);
    } else {
      setQuiz(quizResult.data);
    }

    if (resultsResult.error) setLoadError(resultsResult.error);
    setResults(resultsResult.data);
    setWords(wordsResult.data);
    setLoading(false);
  };

  useEffect(() => {
    if (status === 'allowed') load();
  }, [status, id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = results;

    if (query) {
      rows = rows.filter((row) =>
        [row.student_name, row.student_email].join(' ').toLowerCase().includes(query)
      );
    }

    if (band === 'high') rows = rows.filter((row) => row.percentage >= 80);
    else if (band === 'mid') rows = rows.filter((row) => row.percentage >= 60 && row.percentage < 80);
    else if (band === 'low') rows = rows.filter((row) => row.percentage < 60);

    return [...rows].sort((a, b) => {
      if (sort === 'highest') return b.percentage - a.percentage;
      if (sort === 'lowest') return a.percentage - b.percentage;
      if (sort === 'name') return a.student_name.localeCompare(b.student_name);
      return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
    });
  }, [results, search, band, sort]);

  const summary = useMemo(() => {
    if (results.length === 0) {
      return { attempts: 0, average: 0, highest: 0, lowest: 0, passRate: 0 };
    }
    const percentages = results.map((row) => row.percentage);
    const total = percentages.reduce((sum, value) => sum + value, 0);
    const passed = percentages.filter((value) => value >= 60).length;
    return {
      attempts: results.length,
      average: Math.round((total / results.length) * 10) / 10,
      highest: Math.max(...percentages),
      lowest: Math.min(...percentages),
      passRate: Math.round((passed / results.length) * 100),
    };
  }, [results]);

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading results...</p>;
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Quiz Results</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can view quiz results.</p>
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
        <Link
          href={`/admin/quizzes/${id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          <Eye size={15} /> View Quiz
        </Link>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Results</p>
        <h1 className="mt-1 text-3xl font-bold">{quiz ? quiz.title : 'Quiz Results'}</h1>
        {quiz?.deadline && (
          <p className="mt-1 text-sm text-slate-500">Deadline {formatDateTime(quiz.deadline)}</p>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-slate-500">
          Loading results...
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-slate-700">Unable to load results.</p>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Submissions', value: summary.attempts },
              { label: 'Average', value: `${summary.average}%` },
              { label: 'Highest', value: `${summary.highest}%` },
              { label: 'Lowest', value: `${summary.lowest}%` },
              { label: 'Pass rate (60%)', value: `${summary.passRate}%` },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-bold">Student results</h2>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student name or email"
                  aria-label="Search results"
                  className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
              <select
                value={band}
                onChange={(event) => setBand(event.target.value)}
                aria-label="Filter by score"
                className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
              >
                {BANDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort results"
                className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => downloadCsv(filtered)}
                disabled={filtered.length === 0}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 lg:ml-auto"
              >
                <Download size={15} /> Export CSV
              </button>
            </div>

            {results.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-slate-500">
                No student has submitted this quiz yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="mt-6 rounded-xl border border-stone-200 p-8 text-center text-sm text-slate-500">
                No results match your filters.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Student</th>
                      <th className="py-3 pr-4">Score</th>
                      <th className="py-3 pr-4">Correct</th>
                      <th className="py-3 pr-4">Wrong</th>
                      <th className="py-3 pr-4">Percentage</th>
                      <th className="py-3 pr-4">Submitted</th>
                      <th className="py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id} className="border-b border-stone-100">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900">{row.student_name}</p>
                          {row.student_email && (
                            <p className="text-xs text-slate-500">{row.student_email}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">
                          {row.score} / {row.total_questions}
                        </td>
                        <td className="py-3 pr-4 text-emerald-700">{row.correct_answers}</td>
                        <td className="py-3 pr-4 text-red-600">{row.wrong_answers}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreTone(row.percentage)}`}>
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{formatDateTime(row.submitted_at)}</td>
                        <td className="py-3">
                          <Link
                            href={`/admin/quizzes/${id}/results/${row.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <Eye size={13} /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={17} className="text-[#b91c1c]" />
              <h2 className="font-bold">Word performance</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Questions students answered incorrectly most often appear first.
            </p>

            {words.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No answers recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {words.map((word) => (
                  <div key={`${word.word_id || ''}-${word.label}`} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-semibold text-slate-800">
                      {word.label}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${
                          word.percentage >= 80
                            ? 'bg-emerald-500'
                            : word.percentage >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${word.percentage}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-slate-500">
                      {word.correct}/{word.total} ({word.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
