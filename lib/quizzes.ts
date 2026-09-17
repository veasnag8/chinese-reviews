import { supabase } from '@/lib/supabase';
import { meaningFromWord, shuffleChoices } from '@/lib/quiz/distractors';

/**
 * The hand-written Database type does not fully satisfy Supabase's
 * GenericSchema, so typed rpc() inference collapses to never. Call the
 * server-authoritative functions through this thin, explicit wrapper instead.
 */
type RpcResponse<T> = { data: T; error: { message: string } | null };

const callRpc = <T,>(fn: string, args: Record<string, unknown>): Promise<RpcResponse<T>> => {
  const client = supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<RpcResponse<T>>;
  };
  return client.rpc(fn, args);
};

export type QuizStatus = 'draft' | 'active' | 'inactive' | 'expired' | 'archived';
export type QuizQuestionType = 'single' | 'multiple' | 'true-false';

export type QuizOption = {
  id?: string;
  option_text: string;
  is_correct: boolean;
};

export type QuizQuestion = {
  id?: string;
  clientId: string;
  question: string;
  question_type: QuizQuestionType;
  explanation: string;
  hint: string;
  word_id?: string | null;
  options: QuizOption[];
};

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  hsk_level: number | null;
  status: QuizStatus;
  start_at: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

export type QuizSummary = Quiz & { question_count: number; submitted_count: number };

export type QuizDetail = Quiz & { questions: QuizQuestion[] };

export type QuizInput = {
  title: string;
  description: string;
  category: string;
  hsk_level: number | null;
  status: QuizStatus;
  start_at: string | null;
  deadline: string | null;
  questions: QuizQuestion[];
};

export type WordPoolItem = {
  id: string;
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  category: string | null;
  class_id: string | null;
  class_name: string | null;
};

export type StudentQuizQuestion = {
  id: string;
  question: string;
  question_type: QuizQuestionType;
  hint: string | null;
  sort_order: number;
  options: { id: string; option_text: string; sort_order: number }[];
};

export type StudentQuiz = {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    hsk_level: number | null;
    status: QuizStatus;
    start_at: string | null;
    deadline: string | null;
  };
  questions: StudentQuizQuestion[];
};

export type StudentResultAnswer = {
  question_id: string;
  question: string;
  selected_option_id: string | null;
  student_answer: string | null;
  correct_option_id: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  sort_order: number;
  word_id: string | null;
};

export type AttemptSummary = {
  id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
};

export type StudentResult = {
  attempt: AttemptSummary;
  quiz: { id: string; title: string; deadline: string | null };
  answers: StudentResultAnswer[];
};

export type StudentQuizListItem = Quiz & {
  question_count: number;
  submitted: boolean;
  attempt_status: 'submitted' | 'in_progress' | 'expired' | null;
  score: number | null;
  total_questions: number | null;
  percentage: number | null;
};

export type QuizSubmissionRow = {
  id: string;
  user_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number;
  started_at: string | null;
  submitted_at: string | null;
  student_name: string;
  student_email: string;
};

export type WordPerformanceRow = {
  word_id: string | null;
  label: string;
  correct: number;
  total: number;
  percentage: number;
};

export const STATUS_LABELS: Record<QuizStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  inactive: 'Inactive',
  expired: 'Expired',
  archived: 'Archived',
};

export const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single: 'Single choice',
  multiple: 'Multiple choice',
  'true-false': 'True / False',
};

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const QUESTION_TYPE_OPTIONS = [
  { value: 'single', label: 'Single choice' },
  { value: 'multiple', label: 'Multiple choice' },
  { value: 'true-false', label: 'True / False' },
];

export const HSK_OPTIONS = [
  { value: '', label: 'No HSK level' },
  { value: '0', label: 'Foundation' },
  { value: '1', label: 'HSK 1' },
  { value: '2', label: 'HSK 2' },
  { value: '3', label: 'HSK 3' },
  { value: '4', label: 'HSK 4' },
  { value: '5', label: 'HSK 5' },
  { value: '6', label: 'HSK 6' },
];

export const hskLabel = (level: number | null | undefined) => {
  if (level === null || level === undefined) return '—';
  return level === 0 ? 'Foundation' : `HSK ${level}`;
};

/** While a quiz is active but its deadline has passed, show it as expired. */
export function effectiveStatus(quiz: Pick<Quiz, 'status' | 'deadline'>): QuizStatus {
  if (
    quiz.status === 'active' &&
    quiz.deadline &&
    new Date(quiz.deadline).getTime() < Date.now()
  ) {
    return 'expired';
  }
  return quiz.status;
}

export function formatDateTime(value: string | null | undefined): string {
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
}

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function remainingMs(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return end - Date.now();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `q-${Math.random().toString(36).slice(2)}`;

export const emptyQuestion = (): QuizQuestion => ({
  clientId: newClientId(),
  question: '',
  question_type: 'single',
  explanation: '',
  hint: '',
  word_id: null,
  options: [
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
  ],
});

export function buildQuestionsFromWords(
  selected: WordPoolItem[],
  pool: WordPoolItem[]
): QuizQuestion[] {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const questions: QuizQuestion[] = [];

  selected.forEach((word) => {
    const answer = meaningFromWord(word);
    if (!answer) throw new Error(`Add a meaning for “${word.chinese}” before saving.`);

    const candidates = new Map<string, string>();
    pool.forEach((candidate) => {
      const meaning = meaningFromWord(candidate);
      const key = normalize(meaning);
      if (candidate.id !== word.id && candidate.chinese.trim() !== word.chinese.trim() &&
          key && key !== normalize(answer)) {
        candidates.set(key, meaning);
      }
    });
    const distractors = shuffleChoices(Array.from(candidates.values())).slice(0, 3);
    if (distractors.length !== 3) {
      throw new Error(`“${word.chinese}” needs three distinct wrong answers. Add more words with different meanings to the Words List.`);
    }

    const options = shuffleChoices([
      { option_text: answer, is_correct: true },
      ...distractors.map((text) => ({ option_text: text, is_correct: false })),
    ]);

    questions.push({
      clientId: newClientId(),
      question: `What is the meaning of “${word.chinese}”?`,
      question_type: 'single',
      explanation: '',
      hint: '',
      word_id: word.id,
      options,
    });
  });

  return questions;
}

export async function fetchWordPool(): Promise<{ data: WordPoolItem[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };

  const { data, error } = await supabase
    .from('words')
    .select('id, chinese, pinyin, khmer, english, category, class_id, classes!words_class_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  const rows = (data || []) as unknown as {
    id: string;
    chinese: string;
    pinyin: string | null;
    khmer: string | null;
    english: string | null;
    category: string | null;
    class_id: string | null;
    classes: { name: string } | null;
  }[];

  return {
    data: rows.map((row) => ({
      id: row.id,
      chinese: row.chinese,
      pinyin: row.pinyin,
      khmer: row.khmer,
      english: row.english,
      category: row.category,
      class_id: row.class_id,
      class_name: row.classes?.name ?? null,
    })),
  };
}

export async function fetchQuizSummaries(): Promise<{ data: QuizSummary[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };

  const [quizzesResult, itemsResult, submissionsResult] = await Promise.all([
    supabase
      .from('quizzes')
      .select('id, title, description, category, hsk_level, status, start_at, deadline, created_at, updated_at')
      .order('updated_at', { ascending: false }),
    supabase.from('quiz_items').select('quiz_id'),
    supabase.from('quiz_submissions').select('quiz_id, status').eq('status', 'submitted'),
  ]);

  if (quizzesResult.error) return { data: [], error: quizzesResult.error.message };
  if (itemsResult.error) return { data: [], error: itemsResult.error.message };
  if (submissionsResult.error) return { data: [], error: submissionsResult.error.message };

  const questionCounts = new Map<string, number>();
  ((itemsResult.data || []) as { quiz_id: string }[]).forEach((row) => {
    questionCounts.set(row.quiz_id, (questionCounts.get(row.quiz_id) || 0) + 1);
  });

  const submissionCounts = new Map<string, number>();
  ((submissionsResult.data || []) as { quiz_id: string }[]).forEach((row) => {
    submissionCounts.set(row.quiz_id, (submissionCounts.get(row.quiz_id) || 0) + 1);
  });

  const data = ((quizzesResult.data || []) as Quiz[]).map((quiz) => ({
    ...quiz,
    question_count: questionCounts.get(quiz.id) || 0,
    submitted_count: submissionCounts.get(quiz.id) || 0,
  }));

  return { data };
}

export async function fetchQuizDetail(id: string): Promise<{ data: QuizDetail | null; error?: string }> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };

  const { data: quiz, error } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!quiz) return { data: null, error: 'Quiz not found.' };

  const { data: items, error: itemsError } = await supabase
    .from('quiz_items')
    .select('id, question, question_type, explanation, hint, word_id, sort_order')
    .eq('quiz_id', id)
    .order('sort_order', { ascending: true });

  if (itemsError) return { data: null, error: itemsError.message };

  const itemRows = (items || []) as {
    id: string;
    question: string;
    question_type: QuizQuestionType;
    explanation: string | null;
    hint: string | null;
    word_id: string | null;
  }[];

  const itemIds = itemRows.map((item) => item.id);
  let optionRows: {
    id: string;
    question_id: string;
    option_text: string;
    is_correct: boolean;
  }[] = [];

  if (itemIds.length > 0) {
    const { data: options, error: optionsError } = await supabase
      .from('quiz_options')
      .select('id, question_id, option_text, is_correct, sort_order')
      .in('question_id', itemIds)
      .order('sort_order', { ascending: true });

    if (optionsError) return { data: null, error: optionsError.message };
    optionRows = (options || []) as typeof optionRows;
  }

  const questions: QuizQuestion[] = itemRows.map((item) => ({
    id: item.id,
    clientId: item.id,
    question: item.question,
    question_type: item.question_type,
    explanation: item.explanation || '',
    hint: item.hint || '',
    word_id: item.word_id,
    options: optionRows
      .filter((option) => option.question_id === item.id)
      .map((option) => ({
        id: option.id,
        option_text: option.option_text,
        is_correct: option.is_correct,
      })),
  }));

  return { data: { ...(quiz as Quiz), questions } };
}

export async function saveQuiz(
  input: QuizInput,
  options: { id?: string; userId?: string }
): Promise<{ id?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const p_questions = input.questions
    .map((question) => ({
      question: question.question.trim(),
      question_type: question.question_type,
      explanation: question.explanation.trim(),
      hint: question.hint.trim(),
      word_id: question.word_id ?? null,
      options: question.options
        .filter((option) => option.option_text.trim())
        .map((option) => ({
          option_text: option.option_text.trim(),
          is_correct: option.is_correct,
        })),
    }))
    .filter((question) => question.question.length > 0);

  const { data, error } = await callRpc<string | null>('save_quiz', {
    p_quiz_id: options.id ?? null,
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_hsk_level: input.hsk_level,
    p_status: input.status,
    p_start_at: input.start_at,
    p_deadline: input.deadline,
    p_questions,
  });

  if (error) return { error: error.message };
  return { id: data || options.id };
}

export async function deleteQuiz(id: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  return error ? { error: error.message } : {};
}

// Student ---------------------------------------------------------------------

export async function fetchStudentQuizList(): Promise<{
  data: StudentQuizListItem[];
  error?: string;
}> {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };

  const [quizzesResult, itemsResult, submissionsResult] = await Promise.all([
    supabase.from('quizzes').select('*').order('updated_at', { ascending: false }),
    supabase.from('quiz_items').select('quiz_id'),
    supabase
      .from('quiz_submissions')
      .select('quiz_id, status, score, total_questions, percentage')
      .order('created_at', { ascending: false }),
  ]);

  if (quizzesResult.error) return { data: [], error: quizzesResult.error.message };
  if (itemsResult.error) return { data: [], error: itemsResult.error.message };
  if (submissionsResult.error) return { data: [], error: submissionsResult.error.message };

  const questionCounts = new Map<string, number>();
  ((itemsResult.data || []) as { quiz_id: string }[]).forEach((row) => {
    questionCounts.set(row.quiz_id, (questionCounts.get(row.quiz_id) || 0) + 1);
  });

  const submissionByQuiz = new Map<
    string,
    { status: string; score: number; total_questions: number; percentage: number }
  >();
  ((submissionsResult.data || []) as {
    quiz_id: string;
    status: string;
    score: number;
    total_questions: number;
    percentage: number;
  }[]).forEach((row) => {
    if (!submissionByQuiz.has(row.quiz_id) || row.status === 'submitted') {
      submissionByQuiz.set(row.quiz_id, row);
    }
  });

  const data = ((quizzesResult.data || []) as Quiz[]).map((quiz) => {
    const submission = submissionByQuiz.get(quiz.id) || null;
    return {
      ...quiz,
      question_count: questionCounts.get(quiz.id) || 0,
      submitted: submission?.status === 'submitted',
      attempt_status: (submission?.status as StudentQuizListItem['attempt_status']) ?? null,
      score: submission?.score ?? null,
      total_questions: submission?.total_questions ?? null,
      percentage: submission?.percentage ?? null,
    };
  });

  return { data };
}

export async function fetchStudentQuiz(
  id: string
): Promise<{ data: StudentQuiz | null; error?: string }> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };

  const { data, error } = await callRpc<StudentQuiz | null>('get_student_quiz', { p_quiz_id: id });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Quiz not found.' };
  return { data };
}

export async function startQuizAttempt(
  id: string
): Promise<{ attemptId?: string; status?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { data, error } = await callRpc<{ attempt_id?: string; status?: string } | null>(
    'start_quiz_attempt',
    { p_quiz_id: id }
  );
  if (error) return { error: error.message };

  return { attemptId: data?.attempt_id, status: data?.status };
}

export async function submitQuizAttempt(
  id: string,
  answers: { question_id: string; selected_option_id: string | null }[]
): Promise<{ error?: string; alreadySubmitted?: boolean }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { data, error } = await callRpc<{ already_submitted?: boolean } | null>(
    'submit_quiz_attempt',
    { p_quiz_id: id, p_answers: answers }
  );
  if (error) return { error: error.message };

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('quizzes-changed'));
  return { alreadySubmitted: Boolean(data?.already_submitted) };
}

export async function fetchStudentResult(
  id: string
): Promise<{ data: StudentResult | null; error?: string }> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };

  const { data, error } = await callRpc<StudentResult | null>('get_student_result', {
    p_quiz_id: id,
  });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null };
  return { data };
}

// Admin results ---------------------------------------------------------------

export async function fetchQuizResults(
  quizId: string
): Promise<{ data: QuizSubmissionRow[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };

  const { data: submissions, error } = await supabase
    .from('quiz_submissions')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  const rows = (submissions || []) as {
    id: string;
    user_id: string;
    score: number;
    total_questions: number;
    correct_answers: number;
    wrong_answers: number;
    percentage: number;
    started_at: string | null;
    submitted_at: string | null;
  }[];

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profiles = new Map<string, { full_name: string | null; email: string | null }>();

  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    ((profileRows || []) as { id: string; full_name: string | null; email: string | null }[]).forEach(
      (row) => profiles.set(row.id, { full_name: row.full_name, email: row.email })
    );
  }

  return {
    data: rows.map((row) => ({
      ...row,
      student_name: profiles.get(row.user_id)?.full_name || 'Unknown student',
      student_email: profiles.get(row.user_id)?.email || '',
    })),
  };
}

export async function fetchResultDetail(
  attemptId: string
): Promise<{ data: StudentResult & { student_name: string; student_email: string } | null; error?: string }> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };

  const { data: attempt, error } = await supabase
    .from('quiz_submissions')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!attempt) return { data: null, error: 'Result not found.' };

  const attemptRow = attempt as unknown as AttemptSummary & {
    quiz_id: string;
    user_id: string;
  };

  const [quizResult, answersResult, profileResult] = await Promise.all([
    supabase.from('quizzes').select('id, title, deadline').eq('id', attemptRow.quiz_id).maybeSingle(),
    supabase
      .from('quiz_submission_answers')
      .select('question_id, selected_option_id, correct_option_id, is_correct, quiz_items!inner(question, sort_order, word_id)')
      .eq('attempt_id', attemptId),
    supabase.from('profiles').select('full_name, email').eq('id', attemptRow.user_id).maybeSingle(),
  ]);

  if (answersResult.error) return { data: null, error: answersResult.error.message };

  const answerRows = (answersResult.data || []) as unknown as {
    question_id: string;
    selected_option_id: string | null;
    correct_option_id: string | null;
    is_correct: boolean;
    quiz_items: { question: string; sort_order: number; word_id: string | null } | null;
  }[];

  const optionIds = Array.from(
    new Set(
      answerRows.flatMap((row) =>
        [row.selected_option_id, row.correct_option_id].filter((value): value is string => Boolean(value))
      )
    )
  );

  const optionLabels = new Map<string, string>();
  if (optionIds.length > 0) {
    const { data: options } = await supabase
      .from('quiz_options')
      .select('id, option_text')
      .in('id', optionIds);
    ((options || []) as { id: string; option_text: string }[]).forEach((row) =>
      optionLabels.set(row.id, row.option_text)
    );
  }

  const answers: StudentResultAnswer[] = answerRows
    .map((row) => ({
      question_id: row.question_id,
      question: row.quiz_items?.question || '',
      selected_option_id: row.selected_option_id,
      student_answer: row.selected_option_id ? optionLabels.get(row.selected_option_id) || null : null,
      correct_option_id: row.correct_option_id,
      correct_answer: row.correct_option_id ? optionLabels.get(row.correct_option_id) || null : null,
      is_correct: row.is_correct,
      sort_order: row.quiz_items?.sort_order ?? 0,
      word_id: row.quiz_items?.word_id ?? null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const quizRow = quizResult.data as { id: string; title: string; deadline: string | null } | null;
  const profileRow = profileResult.data as { full_name: string | null; email: string | null } | null;

  return {
    data: {
      attempt: {
        id: attemptRow.id,
        score: attemptRow.score,
        total_questions: attemptRow.total_questions,
        correct_answers: attemptRow.correct_answers,
        wrong_answers: attemptRow.wrong_answers,
        percentage: attemptRow.percentage,
        status: attemptRow.status,
        started_at: attemptRow.started_at,
        submitted_at: attemptRow.submitted_at,
      },
      quiz: {
        id: quizRow?.id || attemptRow.quiz_id,
        title: quizRow?.title || 'Quiz',
        deadline: quizRow?.deadline ?? null,
      },
      answers,
      student_name: profileRow?.full_name || 'Unknown student',
      student_email: profileRow?.email || '',
    },
  };
}

export async function fetchWordPerformance(
  quizId: string
): Promise<{ data: WordPerformanceRow[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };

  const { data: items, error: itemsError } = await supabase
    .from('quiz_items')
    .select('id, question, word_id')
    .eq('quiz_id', quizId);

  if (itemsError) return { data: [], error: itemsError.message };

  const itemRows = (items || []) as { id: string; question: string; word_id: string | null }[];
  if (itemRows.length === 0) return { data: [] };

  const { data: answers, error: answersError } = await supabase
    .from('quiz_submission_answers')
    .select('question_id, is_correct, quiz_submissions!inner(quiz_id)')
    .eq('quiz_submissions.quiz_id', quizId);

  if (answersError) return { data: [], error: answersError.message };

  const answerRows = (answers || []) as unknown as { question_id: string; is_correct: boolean }[];

  const stats = new Map<string, { correct: number; total: number }>();
  answerRows.forEach((row) => {
    const current = stats.get(row.question_id) || { correct: 0, total: 0 };
    current.total += 1;
    if (row.is_correct) current.correct += 1;
    stats.set(row.question_id, current);
  });

  const wordIds = Array.from(
    new Set(itemRows.map((item) => item.word_id).filter((value): value is string => Boolean(value)))
  );

  const wordLabels = new Map<string, string>();
  if (wordIds.length > 0) {
    const { data: words } = await supabase.from('words').select('id, chinese').in('id', wordIds);
    ((words || []) as { id: string; chinese: string }[]).forEach((row) =>
      wordLabels.set(row.id, row.chinese)
    );
  }

  const data = itemRows.map((item) => {
    const stat = stats.get(item.id) || { correct: 0, total: 0 };
    const label = item.word_id
      ? wordLabels.get(item.word_id) || item.question
      : item.question.length > 40
        ? `${item.question.slice(0, 40)}…`
        : item.question;
    return {
      word_id: item.word_id,
      label,
      correct: stat.correct,
      total: stat.total,
      percentage: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
    };
  });

  data.sort((a, b) => a.percentage - b.percentage);
  return { data };
}
