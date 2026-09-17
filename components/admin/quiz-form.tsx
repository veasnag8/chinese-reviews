'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sendQuizNotification } from '@/lib/notify';
import {
  buildQuestionsFromWords,
  emptyQuestion,
  fetchWordPool,
  fromDateTimeLocal,
  HSK_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_OPTIONS,
  STATUS_OPTIONS,
  saveQuiz,
  toDateTimeLocal,
  type QuizDetail,
  type QuizInput,
  type QuizOption,
  type QuizQuestion,
  type QuizQuestionType,
  type QuizStatus,
  type WordPoolItem,
} from '@/lib/quizzes';

type QuizFormProps = {
  initial?: QuizDetail | null;
  userId: string;
};

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal';

export function QuizForm({ initial }: QuizFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [hskLevel, setHskLevel] = useState(
    initial?.hsk_level === null || initial?.hsk_level === undefined ? '' : String(initial.hsk_level)
  );
  const [status, setStatus] = useState<QuizStatus>(initial?.status || 'draft');
  const [startAt, setStartAt] = useState(toDateTimeLocal(initial?.start_at));
  const [deadline, setDeadline] = useState(toDateTimeLocal(initial?.deadline));
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initial?.questions || []
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [wordPool, setWordPool] = useState<WordPoolItem[]>([]);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState('');
  const [wordSearch, setWordSearch] = useState('');
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setWordLoading(true);
    setWordError('');

    fetchWordPool().then((result) => {
      if (!active) return;
      if (result.error) setWordError(result.error);
      setWordPool(result.data);
    }).catch(() => {
      if (active) setWordError('Unable to load words. Please reload and try again.');
    }).finally(() => {
      if (active) setWordLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredWords = useMemo(() => {
    const query = wordSearch.trim().toLowerCase();
    if (!query) return wordPool;
    return wordPool.filter((word) =>
      [word.chinese, word.pinyin, word.khmer, word.english, word.category, word.class_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [wordPool, wordSearch]);

  const toggleWord = (id: string) =>
    setSelectedWordIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuestions((current) =>
      current.map((question, i) => (i === index ? { ...question, ...patch } : question))
    );
  };

  const addQuestion = () => setQuestions((current) => [...current, emptyQuestion()]);

  const removeQuestion = (index: number) =>
    setQuestions((current) => current.filter((_, i) => i !== index));

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const changeQuestionType = (index: number, type: QuizQuestionType) => {
    if (type !== 'true-false') {
      updateQuestion(index, { question_type: type });
      return;
    }

    const current = questions[index];
    const trueExisting = current.options.find((option) => option.option_text.trim().toLowerCase() === 'true');
    const falseExisting = current.options.find((option) => option.option_text.trim().toLowerCase() === 'false');
    let trueCorrect = trueExisting?.is_correct ?? true;
    let falseCorrect = falseExisting?.is_correct ?? false;
    if (!trueCorrect && !falseCorrect) trueCorrect = true;
    if (trueCorrect && falseCorrect) falseCorrect = false;

    updateQuestion(index, {
      question_type: type,
      options: [
        { option_text: 'True', is_correct: trueCorrect },
        { option_text: 'False', is_correct: falseCorrect },
      ],
    });
  };

  const addOption = (qIndex: number) =>
    updateQuestion(qIndex, {
      options: [...questions[qIndex].options, { option_text: '', is_correct: false }],
    });

  const removeOption = (qIndex: number, oIndex: number) =>
    updateQuestion(qIndex, {
      options: questions[qIndex].options.filter((_, i) => i !== oIndex),
    });

  const updateOption = (qIndex: number, oIndex: number, patch: Partial<QuizOption>) =>
    updateQuestion(qIndex, {
      options: questions[qIndex].options.map((option, i) =>
        i === oIndex ? { ...option, ...patch } : option
      ),
    });

  const selectSingleCorrect = (qIndex: number, oIndex: number) =>
    updateQuestion(qIndex, {
      options: questions[qIndex].options.map((option, i) => ({
        ...option,
        is_correct: i === oIndex,
      })),
    });

  const toggleMultipleCorrect = (qIndex: number, oIndex: number) =>
    updateOption(qIndex, oIndex, {
      is_correct: !questions[qIndex].options[oIndex].is_correct,
    });

  const validate = (questions: QuizQuestion[]): string | null => {
    if (!title.trim()) return 'Quiz title is required.';
    if (questions.length === 0) return 'Add at least one question.';

    const start = fromDateTimeLocal(startAt);
    const end = fromDateTimeLocal(deadline);
    if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
      return 'The deadline must be after the start time.';
    }

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const labelled = `Question ${index + 1}`;

      if (!question.question.trim()) return `${labelled}: question text is required.`;

      const filledOptions = question.options.filter((option) => option.option_text.trim());

      if (question.question_type === 'true-false') {
        if (!question.options.some((option) => option.is_correct)) {
          return `${labelled}: select the correct answer.`;
        }
        continue;
      }

      if (filledOptions.length < 2) {
        return `${labelled}: add at least two answer options.`;
      }
      if (!filledOptions.some((option) => option.is_correct)) {
        return `${labelled}: select the correct answer.`;
      }
      if (
        question.question_type === 'single' &&
        filledOptions.filter((option) => option.is_correct).length > 1
      ) {
        return `${labelled}: single choice can only have one correct answer.`;
      }
    }

    return null;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    let generated: QuizQuestion[];
    try {
      generated = buildQuestionsFromWords(
        wordPool.filter((word) => selectedWordIds.includes(word.id)),
        wordPool
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create questions.');
      return;
    }
    const savedQuestions = [...questions, ...generated];
    const validationError = validate(savedQuestions);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const input: QuizInput = {
      title,
      description,
      category,
      hsk_level: hskLevel ? Number(hskLevel) : null,
      status,
      start_at: fromDateTimeLocal(startAt),
      deadline: fromDateTimeLocal(deadline),
      questions: savedQuestions,
    };

    const result = await saveQuiz(input, { id: initial?.id });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    window.dispatchEvent(new Event('quizzes-changed'));
    let notification: { ok: boolean; error?: string } | undefined;
    const startTime = fromDateTimeLocal(startAt);
    const startsNow = !startTime || new Date(startTime).getTime() <= Date.now();
    const hasEnded = input.deadline && new Date(input.deadline).getTime() < Date.now();
    if (result.id && status === 'active' && startsNow && !hasEnded) {
      const questionCount = savedQuestions.length;
      notification = await sendQuizNotification(
        'quiz-available',
        `${title.trim()} • ${questionCount} question${questionCount === 1 ? '' : 's'}${
          deadline ? ` • Due ${new Date(fromDateTimeLocal(deadline) as string).toLocaleString()}` : ''
        }`,
        { title: 'New Quiz Available', quizId: result.id, link: `/quizzes/${result.id}` }
      );
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'quiz-flash',
        notification?.error
          ? `Quiz saved, but the notification failed: ${notification.error}`
          : isEditing
            ? 'Quiz updated successfully.'
            : 'Quiz created successfully.'
      );
    }

    router.push('/admin/quizzes');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin/quizzes')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
          >
            <ChevronLeft size={16} /> Back to Quiz Management
          </button>
          <h1 className="mt-2 text-3xl font-bold">{isEditing ? 'Edit Quiz' : 'Add Quiz'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose words and save. Each selected word becomes a question with three randomized wrong answers.
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold">Quiz information</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold sm:col-span-2">
            Quiz title
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Basic Greetings"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-semibold sm:col-span-2">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description of what this quiz covers"
              rows={3}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-semibold">
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="e.g. Greeting"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-semibold">
            HSK level
            <select
              value={hskLevel}
              onChange={(event) => setHskLevel(event.target.value)}
              className={fieldClass}
            >
              {HSK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Start date &amp; time
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-semibold">
            Deadline
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-semibold sm:col-span-2">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QuizStatus)}
              className={fieldClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Setting the quiz to Active notifies students right away when the start time has passed.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Select words</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select words from the Words List. Saving adds one correct answer and three unique random wrong answers for each word.
            </p>
          </div>
        </div>

          <div className="mt-4 space-y-3">
            <input
              value={wordSearch}
              onChange={(event) => setWordSearch(event.target.value)}
              placeholder="Search words by Chinese, pinyin, meaning or class"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
            />

            {wordLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={15} /> Loading words...
              </p>
            ) : wordError ? (
              <p className="text-sm text-red-600">{wordError}</p>
            ) : filteredWords.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-slate-500">
                No words available. Add words first from the Words List.
              </p>
            ) : (
              <>
                <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-stone-200 p-3">
                  {filteredWords.map((word) => (
                    <label
                      key={word.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWordIds.includes(word.id)}
                        onChange={() => toggleWord(word.id)}
                        className="size-4"
                      />
                      <span className="font-semibold text-slate-900">{word.chinese}</span>
                      <span className="text-slate-500">{word.pinyin || ''}</span>
                      <span className="truncate text-slate-500">
                        {(word.khmer || word.english || '').trim()}
                      </span>
                      {word.class_name && (
                        <span className="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-slate-500">
                          {word.class_name}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <p className="text-sm text-slate-500">{selectedWordIds.length} selected — questions are created when you save.</p>
              </>
            )}
          </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Questions ({questions.length})</h2>
          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus size={15} /> Add question
          </Button>
        </div>

        {questions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-slate-500">
            No questions yet. Select words above and save, or click “Add question”.
          </p>
        )}

        {questions.map((question, qIndex) => (
          <div key={question.clientId} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Question {qIndex + 1}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Move question ${qIndex + 1} up`}
                  disabled={qIndex === 0}
                  onClick={() => moveQuestion(qIndex, -1)}
                  className="rounded-lg border border-stone-200 p-1.5 text-slate-600 disabled:opacity-40"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move question ${qIndex + 1} down`}
                  disabled={qIndex === questions.length - 1}
                  onClick={() => moveQuestion(qIndex, 1)}
                  className="rounded-lg border border-stone-200 p-1.5 text-slate-600 disabled:opacity-40"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold sm:col-span-2">
                Question text
                <Textarea
                  required
                  value={question.question}
                  onChange={(event) => updateQuestion(qIndex, { question: event.target.value })}
                  placeholder="Enter the question"
                  className="mt-1.5"
                />
              </label>

              <label className="block text-sm font-semibold">
                Question type
                <select
                  value={question.question_type}
                  onChange={(event) => changeQuestionType(qIndex, event.target.value as QuizQuestionType)}
                  className={fieldClass}
                >
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm font-semibold">
                Selected type
                <p className="mt-1.5 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm font-normal text-slate-600">
                  {QUESTION_TYPE_LABELS[question.question_type]}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Answer options</p>
                {question.question_type !== 'true-false' && (
                  <button
                    type="button"
                    onClick={() => addOption(qIndex)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#b91c1c]"
                  >
                    <Plus size={13} /> Add option
                  </button>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {question.question_type === 'multiple'
                  ? 'Tick every option that is correct.'
                  : 'Choose the one correct option.'}
              </p>

              <div className="mt-3 space-y-2">
                {question.options.map((option, oIndex) => {
                  const inputType = question.question_type === 'multiple' ? 'checkbox' : 'radio';
                  return (
                    <div key={oIndex} className="flex items-center gap-3">
                      <input
                        type={inputType}
                        name={`correct-${question.clientId}`}
                        aria-label={`Mark option ${oIndex + 1} as correct`}
                        checked={option.is_correct}
                        onChange={() =>
                          question.question_type === 'multiple'
                            ? toggleMultipleCorrect(qIndex, oIndex)
                            : selectSingleCorrect(qIndex, oIndex)
                        }
                        className="size-4"
                      />
                      <input
                        value={option.option_text}
                        readOnly={question.question_type === 'true-false'}
                        onChange={(event) => updateOption(qIndex, oIndex, { option_text: event.target.value })}
                        placeholder={`Option ${oIndex + 1}`}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm font-normal ${
                          option.is_correct ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200'
                        }`}
                      />
                      {question.question_type !== 'true-false' && question.options.length > 2 && (
                        <button
                          type="button"
                          aria-label={`Remove option ${oIndex + 1}`}
                          onClick={() => removeOption(qIndex, oIndex)}
                          className="rounded-lg border border-stone-200 p-1.5 text-slate-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Explanation (optional)
                <Textarea
                  value={question.explanation}
                  onChange={(event) => updateQuestion(qIndex, { explanation: event.target.value })}
                  placeholder="Explain why the correct answer is right"
                  className="mt-1.5"
                />
              </label>

              <label className="block text-sm font-semibold">
                Hint (optional)
                <Input
                  value={question.hint}
                  onChange={(event) => updateQuestion(qIndex, { hint: event.target.value })}
                  placeholder="A short hint for students"
                  className="mt-1.5"
                />
              </label>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Quiz'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => router.push('/admin/quizzes')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
