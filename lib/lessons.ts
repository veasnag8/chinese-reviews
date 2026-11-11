export type LessonKey = 'Lesson 1' | 'Lesson 2' | 'Lesson 3' | 'Outside Words';

export const LESSON_ORDER: LessonKey[] = [
  'Lesson 1',
  'Lesson 2',
  'Lesson 3',
  'Outside Words',
];

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
 * Classifies a Chinese vocabulary word into Lesson 1, Lesson 2, Lesson 3, or Outside Words.
 */
export function classifyWordLesson(chinese: string): LessonKey {
  const clean = normalizeChinese(chinese);
  if (LESSON_1_SET.has(clean)) return 'Lesson 1';
  if (LESSON_2_SET.has(clean)) return 'Lesson 2';
  if (LESSON_3_SET.has(clean)) return 'Lesson 3';
  return 'Outside Words';
}

/**
 * Classifies a Chinese sentence into Lesson 1, Lesson 2, Lesson 3, or Outside Words.
 * Uses class lesson_number when provided (1-3), otherwise matches against the highest lesson vocabulary in the sentence.
 */
export function classifySentenceLesson(
  chineseSentence: string,
  lessonNumber?: number | null
): LessonKey {
  if (lessonNumber === 1) return 'Lesson 1';
  if (lessonNumber === 2) return 'Lesson 2';
  if (lessonNumber === 3) return 'Lesson 3';

  const clean = normalizeChinese(chineseSentence);
  if (!clean) return 'Outside Words';

  if (LESSON_3_WORDS.some((w) => clean.includes(w))) return 'Lesson 3';
  if (LESSON_2_WORDS.some((w) => clean.includes(w))) return 'Lesson 2';
  if (LESSON_1_WORDS.some((w) => clean.includes(w))) return 'Lesson 1';
  return 'Outside Words';
}
