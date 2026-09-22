export type QuizMeaning = {
  chinese: string;
  answer: string;
  pinyin?: string | null;
  khmer?: string | null;
  english?: string | null;
  category?: string | null;
  class_id?: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function sharedCharacters(a: string, b: string) {
  return [...a].filter((char) => b.includes(char)).length;
}

function similarityScore(target: QuizMeaning, candidate: QuizMeaning) {
  const targetAnswer = normalize(target.answer);
  const candidateAnswer = normalize(candidate.answer);
  if (!candidateAnswer || candidateAnswer === targetAnswer) return -1;
  if (candidate.chinese.trim() === target.chinese.trim()) return -1;

  let score = 1;
  if (target.class_id && candidate.class_id === target.class_id) score += 6;
  if (target.category && candidate.category && candidate.category === target.category) score += 5;
  if (target.chinese.length === candidate.chinese.length) score += 3;
  score += sharedCharacters(target.chinese, candidate.chinese) * 2;

  const lengthGap = Math.abs(targetAnswer.length - candidateAnswer.length);
  score += Math.max(0, 4 - lengthGap);

  if (target.pinyin && candidate.pinyin && target.pinyin[0] === candidate.pinyin[0]) score += 1;
  return score;
}

export function pickSimilarDistractors(
  target: QuizMeaning,
  pool: QuizMeaning[],
  count = 3
) {
  const ranked = pool
    .map((candidate) => ({ candidate, score: similarityScore(target, candidate) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const chosen: string[] = [];
  const seen = new Set([normalize(target.answer)]);

  for (const { candidate } of ranked) {
    const key = normalize(candidate.answer);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(candidate.answer);
    if (chosen.length === count) break;
  }

  return chosen;
}

export function shuffleChoices<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function meaningFromWord(word: {
  khmer?: string | null;
  english?: string | null;
  pinyin?: string | null;
}) {
  return (word.khmer || word.english || word.pinyin || '').trim();
}

export function meaningFromSentence(sentence: {
  khmer_translation?: string | null;
  english_translation?: string | null;
  pinyin?: string | null;
}) {
  return (sentence.khmer_translation || sentence.english_translation || sentence.pinyin || '').trim();
}
