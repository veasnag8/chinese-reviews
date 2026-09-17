'use client';

import { useRole } from '@/lib/use-role';
import { QuizForm } from '@/components/admin/quiz-form';

export default function NewQuizPage() {
  const { status, userId } = useRole();

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">Loading...</p>;
  }

  if (status === 'denied' || !userId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Add Quiz</h1>
        <p className="mt-2 text-slate-500">Only teachers and admins can create quizzes.</p>
      </div>
    );
  }

  return <QuizForm userId={userId} />;
}
