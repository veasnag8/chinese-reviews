'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/use-role';
import { QuizForm } from '@/components/admin/quiz-form';
import { fetchQuizDetail, type QuizDetail } from '@/lib/quizzes';

export default function EditQuizPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { status, isAdmin, userId } = useRole();

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (status !== 'allowed' || !isAdmin || !id) return;

    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');

      const result = await fetchQuizDetail(id);

      if (!active) return;

      if (result.error || !result.data) {
        setLoadError(result.error || 'Quiz not found.');
        setQuiz(null);
      } else {
        setQuiz(result.data);
      }

      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [status, isAdmin, id]);

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading quiz...</p>;
  }

  if (status === 'denied' || !isAdmin) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Edit Quiz</h1>
        <p className="mt-2 text-slate-500">Only admins can edit quizzes.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="p-6 text-slate-500">Loading quiz...</p>;
  }

  if (loadError || !quiz || !userId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="text-slate-700">Unable to load quiz.</p>
        <p className="mt-1 text-sm text-slate-500">{loadError || 'Quiz not found.'}</p>
        <a
          href="/admin/quizzes"
          className="mt-4 inline-block rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to Quiz Management
        </a>
      </div>
    );
  }

  return <QuizForm initial={quiz} userId={userId} />;
}
