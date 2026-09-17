'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Send, Trophy, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { resolveDisplayName, sendQuizNotification } from '@/lib/notify';
import { meaningFromWord, pickSimilarDistractors, shuffleChoices, type QuizMeaning } from '@/lib/quiz/distractors';

type QuizQuestion = {
  id: string;
  chinese: string;
  correct_answer: string;
  options?: string[] | null;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  class_id?: string | null;
};

type QuizAnswer = {
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
};

type WordRow = {
  chinese: string;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  category?: string | null;
  class_id?: string | null;
  created_at?: string | null;
  classes?: { date?: string | null } | null;
};

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [wordPool, setWordPool] = useState<QuizMeaning[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadQuestions = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];

      const [wordsResult] = await Promise.all([
        supabase
          .from('words')
          .select('chinese, pinyin, khmer, english, category, class_id, created_at, classes!words_class_id_fkey (date)')
          .gte('created_at', dateStr)
          .order('created_at', { ascending: false }),
      ]);

      const wordRows = ((wordsResult.data || []) as WordRow[])
        .filter((word) => word.chinese)
        .map((word) => ({
          chinese: word.chinese,
          answer: (word.khmer || word.english || word.pinyin || '').trim(),
          pinyin: word.pinyin,
          khmer: word.khmer,
          english: word.english,
          category: word.category,
          class_id: word.class_id,
        }))
        .filter((item) => item.answer);

      if (wordRows.length < 2) {
        setWordPool([]);
        setLoading(false);
        return;
      }

      const shuffled = [...wordRows].sort(() => Math.random() - 0.5).slice(0, 10);
      const generatedQuestions = shuffled.map((word) => ({
        id: crypto.randomUUID(),
        chinese: word.chinese,
        correct_answer: word.answer,
        pinyin: word.pinyin,
        khmer: word.khmer,
        english: word.english,
        class_id: word.class_id,
      }));

      setQuestions(generatedQuestions);
      setWordPool(
        shuffled.map((word) => ({
          chinese: word.chinese,
          answer: word.answer,
          pinyin: word.pinyin,
          khmer: word.khmer,
          english: word.english,
          category: word.category,
          class_id: word.class_id,
        }))
      );
      setLoading(false);
    };

    loadQuestions();
  }, []);

  const quizQuestions = useMemo(
    () =>
      questions.map((question) => {
        const target = {
          chinese: question.chinese,
          answer: question.correct_answer,
          pinyin: question.pinyin,
          khmer: question.khmer,
          english: question.english,
          class_id: question.class_id,
        };
        const similar = pickSimilarDistractors(target, wordPool, 3);
        return {
          ...question,
          choices: shuffleChoices([question.correct_answer, ...similar]),
        };
      }),
    [questions, wordPool]
  );

  const question = quizQuestions[questionIndex];

  const restart = () => {
    setQuestionIndex(0);
    setSelectedAnswer('');
    setChecked(false);
    setScore(0);
    setAnswers([]);
    setSubmitted(false);
    setSubmitError('');
  };

  const submitQuiz = async () => {
    if (!supabase || submitted || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setSubmitError('Please sign in again.');
      setSubmitting(false);
      return;
    }

    const runId = crypto.randomUUID();
    const attempts = quizQuestions.map((q) => {
      const answer = answers.find((item) => item.question_id === q.id);
      return {
        user_id: user.id,
        quiz_id: runId,
        question_id: q.id,
        selected_answer: answer?.selected_answer ?? null,
        is_correct: answer?.is_correct ?? false,
        time_spent: 0,
        completed_at: new Date().toISOString(),
      };
    });

    const { error: attemptsError } = await supabase.from('quiz_attempts').insert(attempts as never);
    if (attemptsError) {
      setSubmitError(attemptsError.message);
      setSubmitting(false);
      return;
    }

    const result = await sendQuizNotification(
      'quiz-submission',
      `${resolveDisplayName(user)} submitted the quiz and scored ${score} / ${quizQuestions.length}`
    );
    if (!result.ok) setSubmitError(result.error || 'Could not notify other users.');
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <p className="text-slate-500">Loading quiz...</p>;

  if (questions.length < 2)
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-slate-500">
        Not enough words from the last 7 days. Add more words to play.
      </div>
    );

  if (!question)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <Trophy className="mx-auto text-amber-500" size={42} />
        <p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">QUIZ COMPLETE</p>
        <h1 className="mt-2 text-3xl font-bold">
          Your score: {score} / {quizQuestions.length}
        </h1>
        {submitError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
        {submitted ? (
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            <Check size={16} /> Submitted — other users were notified.
          </p>
        ) : (
          <button
            onClick={submitQuiz}
            disabled={submitting}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send size={17} /> {submitting ? 'Submitting...' : 'Submit quiz'}
          </button>
        )}
        <button onClick={restart} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
          <RotateCcw size={17} /> Try again
        </button>
      </div>
    );

  const correct = selectedAnswer === question.correct_answer;
  const next = () => {
    if (correct) setScore((current) => current + 1);
    setAnswers((current) => [...current, { question_id: question.id, selected_answer: selectedAnswer, is_correct: correct }]);
    setQuestionIndex((current) => current + 1);
    setSelectedAnswer('');
    setChecked(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Daily Quiz</p>
          <h1 className="mt-1 text-3xl font-bold">Test your Chinese (Last 7 Days)</h1>
        </div>
        <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
          {questionIndex + 1} / {quizQuestions.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-[#b91c1c]" style={{ width: `${(questionIndex / quizQuestions.length) * 100}%` }} />
      </div>
      <section className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <p className="text-sm text-slate-500">Choose the correct answer</p>
        <p className="mt-5 text-6xl font-semibold">{question.chinese}</p>
        <div className="mt-8 grid gap-3 text-left">
          {question.choices.map((choice, index) => (
            <button
              key={`${choice}-${index}`}
              disabled={checked}
              onClick={() => setSelectedAnswer(choice)}
              className={`rounded-xl border p-4 text-left font-medium ${selectedAnswer === choice ? 'border-[#b91c1c] bg-red-50' : 'border-stone-200'} ${checked && choice === question.correct_answer ? 'border-emerald-500 bg-emerald-50' : ''}`}
            >
              {String.fromCharCode(65 + index)}. {choice}
            </button>
          ))}
        </div>
        {checked && (
          <p className={`mt-5 rounded-xl p-3 text-sm font-semibold ${correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {correct ? (
              <>
                <Check className="mr-1 inline" size={16} /> Correct!
              </>
            ) : (
              <>
                <X className="mr-1 inline" size={16} /> Correct answer: {question.correct_answer}
              </>
            )}
          </p>
        )}
        <div className="mt-7 flex justify-end">
          {checked ? (
            <button onClick={next} className="rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white">
              Next question
            </button>
          ) : (
            <button disabled={!selectedAnswer} onClick={() => setChecked(true)} className="rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
              Check answer
            </button>
          )}
        </div>
      </section>
    </div>
  );
}