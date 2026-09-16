import { type ReviewItem, type ReviewSession, type ReviewResult, type SpacedRepetitionConfig, DEFAULT_CONFIG } from "./types";

export function calculateNextReview(
  item: ReviewItem,
  result: ReviewResult,
  config: SpacedRepetitionConfig = DEFAULT_CONFIG
): ReviewItem {
  const { easeFactor = DEFAULT_CONFIG.easeFactor, interval = DEFAULT_CONFIG.interval } = config;

  let newEaseFactor = easeFactor;
  let newInterval = interval;

  if (result.isCorrect) {
    if (item.reviewCount === 0) {
      newInterval = 1;
    } else {
      newInterval = Math.round(item.nextReview.getTime() / 86400000 * easeFactor / config.easeFactor);
    }

    if (result.userDifficulty === "easy") {
      newEaseFactor = Math.max(1.3, easeFactor + 0.1);
      newInterval = Math.round(newInterval * 2.5);
    } else if (result.userDifficulty === "good") {
      newEaseFactor = easeFactor + 0.05;
      newInterval = Math.round(newInterval * 1.5);
    } else if (result.userDifficulty === "hard") {
      newEaseFactor = Math.max(1.3, easeFactor - 0.15);
      newInterval = Math.round(newInterval * 0.5);
    }
  } else {
    newEaseFactor = Math.max(1.3, easeFactor - 0.2);
    newInterval = 1;
  }

  return {
    ...item,
    lastReviewed: new Date(),
    nextReview: addDays(new Date(), newInterval),
    reviewCount: item.reviewCount + 1,
    correctCount: result.isCorrect ? item.correctCount + 1 : item.correctCount,
    wrongCount: result.isCorrect ? item.wrongCount : item.wrongCount + 1,
    difficulty: result.userDifficulty,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDueItems(items: ReviewItem[]): ReviewItem[] {
  const now = new Date();
  return items.filter((item) => new Date(item.nextReview) <= now);
}

export function getReviewOrder(items: ReviewItem[]): ReviewItem[] {
  return items.sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
}
