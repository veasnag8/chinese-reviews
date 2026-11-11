export type LessonKey = `Lesson ${number}` | 'Outside Words';

export const CORE_LESSONS: LessonKey[] = ['Lesson 1', 'Lesson 2', 'Lesson 3'];

export const LESSON_1_WORDS = [
  '你',
  '好',
  '我',
  '叫',
  '是',
  '人',
  '吗',
  '他',
  '不',
  '日本',
  '法国',
  '加拿大',
] as const;

export const LESSON_2_WORDS = [
  '这',
  '的',
  '书',
  '词典',
  '地图',
  '本子',
  '笔',
  '有',
  '没有',
  '支',
  '个',
  '两',
  '本',
  '张',
] as const;

export const LESSON_3_WORDS = [
  '什么',
  '家',
  '照片',
  '几',
  '口',
  '谁',
  '哥哥',
  '爸爸',
  '妈妈',
  '姐姐',
  '和',
  '做',
  '工作',
  '妹妹',
  '大夫',
  '全',
  '弟弟',
] as const;

const LESSON_1_SET = new Set<string>(LESSON_1_WORDS);
const LESSON_2_SET = new Set<string>(LESSON_2_WORDS);
const LESSON_3_SET = new Set<string>(LESSON_3_WORDS);

function normalizeChinese(text: string): string {
  return text.trim().replace(/[。！？!?.,，、；;：:\s]/g, '');
}

/**
 * Classifies a Chinese vocabulary word into Lesson N (when class lesson_number is provided),
 * otherwise matches Lessons 1-3 vocabulary or falls back to Outside Words.
 */
export function classifyWordLesson(
  chinese: string,
  lessonNumber?: number | null
): LessonKey {
  if (typeof lessonNumber === 'number' && lessonNumber >= 1) {
    return `Lesson ${lessonNumber}`;
  }

  const clean = normalizeChinese(chinese);
  if (LESSON_1_SET.has(clean)) return 'Lesson 1';
  if (LESSON_2_SET.has(clean)) return 'Lesson 2';
  if (LESSON_3_SET.has(clean)) return 'Lesson 3';
  return 'Outside Words';
}

/**
 * Classifies a Chinese sentence into Lesson N (when class lesson_number is provided),
 * otherwise matches against the highest lesson vocabulary in the sentence.
 */
export function classifySentenceLesson(
  chineseSentence: string,
  lessonNumber?: number | null
): LessonKey {
  if (typeof lessonNumber === 'number' && lessonNumber >= 1) {
    return `Lesson ${lessonNumber}`;
  }

  const clean = normalizeChinese(chineseSentence);
  if (!clean) return 'Outside Words';

  if (LESSON_3_WORDS.some((w) => clean.includes(w))) return 'Lesson 3';
  if (LESSON_2_WORDS.some((w) => clean.includes(w))) return 'Lesson 2';
  if (LESSON_1_WORDS.some((w) => clean.includes(w))) return 'Lesson 1';
  return 'Outside Words';
}

/**
 * Sorts lesson keys as Lesson 1, Lesson 2, ..., Lesson N, followed by Outside Words.
 */
export function sortLessonKeys(keys: Iterable<LessonKey>): LessonKey[] {
  const unique = Array.from(new Set(keys));
  return unique.sort((a, b) => {
    if (a === 'Outside Words') return 1;
    if (b === 'Outside Words') return -1;
    const numA = Number(a.replace('Lesson ', ''));
    const numB = Number(b.replace('Lesson ', ''));
    return numA - numB;
  });
}
