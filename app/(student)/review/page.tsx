'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trophy, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

export default function ReviewPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [wordPool, setWordPool] = useState<QuizMeaning[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [completed, setCompleted] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [reviewCompletedToday, setReviewCompletedToday] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      
      const { data } = await supabase.rpc('has_completed_daily_review');
      setReviewCompletedToday(data === true);
    };
    checkReviewStatus();
  }, []);

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
    setAnswered(false);
    setScore(0);
    setAnswers([]);
    setCompleted(false);
    setCompleteError('');
    setShowResults(false);
  };

  const completeReview = async () => {
    if (!supabase || completed) return;
    setCompleteError('');

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setCompleteError('Please sign in again.');
      return;
    }

    const { error } = await supabase.rpc('complete_daily_review');
    if (error) {
      setCompleteError(error.message);
      return;
    }

    setCompleted(true);
    setShowResults(true);
    setReviewCompletedToday(true);
  };

  if (loading) return <p className="text-slate-500">Loading review...</p>;

  // Show completed message if already done today
  if (reviewCompletedToday && !showResults && !completed) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <Trophy className="mx-auto text-amber-500" size={42} />
        <p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">REVIEW TODAY COMPLETED</p>
        <p className="mt-2 text-slate-600">You've already completed your daily review.</p>
        <p className="mt-4 text-lg font-semibold text-[#b91c1c]">Can Review Tomorrow</p>
      </div>
    );
  }

  if (questions.length < 2)
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-slate-500">
        Not enough words from the last 7 days. Add more words to practice.
      </div>
    );

  // Show results after completion
  if (showResults) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <Trophy className="mx-auto text-amber-500" size={42} />
          <p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">REVIEW COMPLETE</p>
          <h1 className="mt-2 text-3xl font-bold">
            Your score: {score} / {quizQuestions.length}
          </h1>
          {completeError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{completeError}</p>}
          <p className="mt-5 text-lg font-semibold text-[#b91c1c]">Can Review Tomorrow</p>
        </div>

        {/* Results breakdown - check answer word by word */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Review Results</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {answers.map((answer, idx) => {
              const q = quizQuestions.find(qq => qq.id === answer.question_id);
              const isCorrect = answer.is_correct;
              return (
                <div key={answer.question_id} className={`rounded-xl p-4 ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Question {idx + 1}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {isCorrect ? (
                        <>
                          <Check size={12} /> Correct
                        </>
                      ) : (
                        <>
                          <X size={12} /> Incorrect
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-center mb-2">{q?.chinese}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className={`p-2 rounded ${isCorrect ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <span className="font-medium">Your answer:</span> {answer.selected_answer || '(no answer)'}
                    </div>
                    <div className="p-2 rounded bg-emerald-100">
                      <span className="font-medium">Correct:</span> {q?.correct_answer}
                    </div>
                    {q?.pinyin && <div className="col-span-2 p-2 rounded bg-slate-100"><span className="font-medium">Pinyin:</span> {q.pinyin}</div>}
                    {q?.khmer && <div className="col-span-2 p-2 rounded bg-slate-100"><span className="font-medium">Khmer:</span> {q.khmer}</div>}
                    {q?.english && <div className="col-span-2 p-2 rounded bg-slate-100"><span className="font-medium">English:</span> {q.english}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <p className="text-lg font-semibold text-[#b91c1c]">Can Review Tomorrow</p>
        </div>
      </div>
    );
  }

  // Main review flow - question exists here
  const correct = selectedAnswer === question.correct_answer;
  const handleAnswer = (choice: string) => {
    if (answered) return;
    setSelectedAnswer(choice);
    setAnswered(true);
    const isCorrect = choice === question.correct_answer;
    if (isCorrect) setScore((current) => current + 1);
    setAnswers((current) => [...current, { question_id: question.id, selected_answer: choice, is_correct: isCorrect }]);
  };

  const next = () => {
    if (questionIndex + 1 >= quizQuestions.length) {
      // All questions answered, show results
      setShowResults(true);
    } else {
      setQuestionIndex((current) => current + 1);
    }
    setSelectedAnswer('');
    setAnswered(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Daily Review</p>
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
              disabled={answered}
              onClick={() => handleAnswer(choice)}
              className={`rounded-xl border p-4 text-left font-medium transition ${
                answered
                  ? choice === question.correct_answer
                    ? 'border-emerald-500 bg-emerald-50'
                    : choice === selectedAnswer
                    ? 'border-red-500 bg-red-50'
                    : 'border-stone-200'
                  : selectedAnswer === choice
                  ? 'border-[#b91c1c] bg-red-50'
                  : 'border-stone-200 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              {String.fromCharCode(65 + index)}. {choice}
              {answered && choice === question.correct_answer && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <Check size={16} /> Correct
                </span>
              )}
              {answered && choice === selectedAnswer && choice !== question.correct_answer && (
                <span className="ml-2 inline-flex items-center gap-1 text-red-600">
                  <X size={16} /> Incorrect
                </span>
              )}
            </button>
          ))}
        </div>
        {answered && (
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
          {answered ? (
            <button onClick={next} className="rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white">
              Next question
            </button>
          ) : (
            <p className="text-sm text-slate-500 self-center">Select an answer to continue</p>
          )}
        </div>
      </section>
    </div>
  );
}