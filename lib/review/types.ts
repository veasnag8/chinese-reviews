export interface ReviewItem {
  id: string;
  wordId?: string;
  sentenceId?: string;
  chinese: string;
  pinyin?: string;
  khmer?: string;
  english?: string;
  classId: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  examplePinyin?: string;
  exampleKhmer?: string;
  hskLevel?: number;
  category?: string;
  imageUrl?: string;
  audioUrl?: string;
  lastReviewed?: Date;
  nextReview: Date;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  difficulty: "easy" | "good" | "hard";
}

export interface ReviewSession {
  id: string;
  userId: string;
  items: ReviewItem[];
  itemIndex: number;
  startedAt: Date;
  completedAt?: Date;
  correct: number;
  wrong: number;
  completed: boolean;
}

export interface ReviewResult {
  item: ReviewItem;
  isCorrect: boolean;
  userDifficulty: "easy" | "good" | "hard";
}

export interface SpacedRepetitionConfig {
  easeFactor: number;
  interval: number;
}

export const DEFAULT_CONFIG: SpacedRepetitionConfig = {
  easeFactor: 2.5,
  interval: 1,
};