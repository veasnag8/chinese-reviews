import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { scheduler } from "@/lib/review/scheduler";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function ReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [reviewResult, setReviewResult] = useState<{
    isCorrect: boolean | null;
    userDifficulty: "easy" | "good" | "hard";
  } | null>(null);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    wrong: 0,
    total: 0,
  });
  const [isReviewing, setIsReviewing] = useState(false);
  const [difficulty, setDifficulty] = useState("good");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchDueItems();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      router.push("/login");
      return;
    }
    setUser(data.user.id);
  };

  const fetchDueItems = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("review_items")
      .select("*")
      .eq("user_id", user)
      .lte("next_review", new Date().toISOString())
      .order("next_review", { ascending: true })
      .limit(20);
    
    if (error) return;
    setDueItems(data || []);
    setCurrentIndex(0);
    if (data && data.length > 0) {
      setCurrentItem(data[0]);
    }
  };

  const { register, handleSubmit } = useForm({
    resolver: zodResolver(z.object({})),
  });

  const startReview = async () => {
    await fetchDueItems();
    setIsReviewing(true);
  };

  const submitAnswer = async (selectedAnswer: string) => {
    if (!currentItem) return;
    
    const correctAnswer = currentItem.english || currentItem.chinese;
    const isCorrect = selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    
    setIsCorrect(isCorrect);
    setShowAnswer(true);
    setReviewResult({
      isCorrect,
      userDifficulty: difficulty,
    });
    
    // Update review item using spaced repetition
    const updatedItem = scheduler.calculateNextReview(
      {
        ...currentItem,
        chinese: currentItem.chinese,
        pinyin: currentItem.pinyin,
        khmer: currentItem.khmer,
        english: currentItem.english,
        classId: currentItem.class_id,
        reviewCount: currentItem.review_count,
        correctCount: currentItem.correct_count,
        wrongCount: currentItem.wrong_count,
        difficulty: currentItem.difficulty,
      },
      {
        isCorrect,
        userDifficulty: difficulty,
      }
    );
    
    // Save updated review item to database
    if (user) {
      await supabase
        .from("review_items")
        .upsert({
          id: currentItem.id,
          user_id: user,
          word_id: currentItem.word_id,
          sentence_id: currentItem.sentence_id,
          item_type: currentItem.item_type,
          chinese: updatedItem.chinese,
          pinyin: updatedItem.pinyin,
          khmer: updatedItem.khmer,
          english: updatedItem.english,
          due_date: formatDate(updatedItem.nextReview),
          last_reviewed: new Date().toISOString(),
          next_review: formatDate(updatedItem.nextReview),
          review_count: updatedItem.reviewCount,
          correct_count: updatedItem.correctCount,
          wrong_count: updatedItem.wrongCount,
          difficulty: updatedItem.difficulty,
        });
    }
    
    // Move to next item or end session
    setCurrentIndex(currentIndex + 1);
    setTimeout(() => {
      if (currentIndex + 1 < dueItems.length) {
        setCurrentItem(dueItems[currentIndex + 1]);
        setShowAnswer(false);
        setIsCorrect(null);
        setReviewResult(null);
        setDifficulty("good");
      } else {
        setIsReviewing(false);
        // Save session stats
        supabase.from("study_sessions").insert({
          user_id: user,
          items_count: sessionStats.total,
          correct_count: sessionStats.correct,
          wrong_count: sessionStats.wrong,
          accuracy: Math.round((sessionStats.correct / sessionStats.total) * 100),
        });
      }
    }, 1500);
  };

  if (!user) {
    return null;
  }

  if (!isReviewing && dueItems.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-md mx-auto p-8">
          <h3 className="text-2xl font-medium mb-4">No Items Due</h3>
          <p className="text-muted-foreground mb-6">
            All caught up! No review items are due at this time.
          </p>
          <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        {/* Progress Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold text-foreground">Review Session</h2>
            <p className="text-sm text-muted-foreground">
              {sessionStats.total} items {sessionStats.correct} correct {sessionStats.wrong} wrong
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Difficulty:</span>
            <Toggle
              onClick={() => setDifficulty(prev => {
                if (prev === "easy") return "good";
                if (prev === "good") return "hard";
                return "easy";
              })}
              selected={difficulty === "easy"}
            >
              😎 Easy
            </Toggle>
            <Toggle
              onClick={() => setDifficulty(prev => {
                if (prev === "easy") return "good";
                if (prev === "good") return "hard";
                return "easy";
              })}
              selected={difficulty === "good"}
            >
              🙂 Good
            </Toggle>
            <Toggle
              onClick={() => setDifficulty(prev => {
                if (prev === "easy") return "good";
                if (prev === "good") return "hard";
                return "easy";
              })}
              selected={difficulty === "hard"}
            >
              😰 Hard
            </Toggle>
          </div>
        </div>

        {/* Current Item Card */}
        {isReviewing && currentItem && (
          <Card className="p-6 max-w-2xl mx-auto">
            <div className="space-y-4">
              
              {/* Chinese Character */}
              <div className="text-center">
                <div className="text-6xl font-chinese mb-2">
                  {currentItem.chinese}
                </div>
                {currentItem.pinyin && (
                  <div className="text-lg text-muted-foreground">
                    {currentItem.pinyin}
                  </div>
                )}
                {currentItem.khmer && (
                  <div className="text-lg text-primary">
                    {currentItem.khmer}
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="mt-2"
                >
                  {showAnswer ? "Hide" : "Show Answer"}
                </Button>
              </div>
              
              {/* Question Type */}
              {currentItem.item_type === "word" && !showAnswer && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">What does this mean?</p>
                  <div className="space-y-2">
                    <Button onClick={() => submitAnswer(currentItem.english || "")} variant="primary">
                      {currentItem.english || "—"}
                    </Button>
                    <Button variant="outline" onClick={() => submitAnswer(currentItem.khmer || "")}>
                      {currentItem.khmer || "—"}
                    </Button>
                    <Button variant="outline" onClick={() => submitAnswer(currentItem.pinyin || "")}>
                      {currentItem.pinyin || "—"}
                    </Button>
                  </div>
                </div>
              )}
              
              {currentItem.item_type === "sentence" && !showAnswer && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {currentItem.chinese}
                  </p>
                  <Button variant="primary" onClick={() => submitAnswer(currentItem.english || "")}>
                    Translate
                  </Button>
                </div>
              )}
              
              {showAnswer && currentResult && (
                <div className="p-4 rounded-md mb-4">
                  {isCorrect ? (
                    <p className="text-success text-lg font-medium">✓ Correct</p>
                  ) : (
                    <div>
                      <p className="text-danger text-lg font-medium">✗ Incorrect</p>
                      <p className="text-sm text-muted-foreground">
                        Correct answer: {currentResult.correctAnswer}
                      </p>
                    </div>
                  )}
                  <p className="text-sm mt-2">
                    Difficulty: {currentResult.userDifficulty?.charAt(0).toUpperCase() + currentResult.userDifficulty?.slice(1)}
                  </p>
                </div>
              )}
              
              {/* Navigation */}
              {currentIndex > 0 && !showAnswer && (
                <Button
                  onClick={() => {
                    setCurrentIndex(currentIndex - 1);
                    setCurrentItem(dueItems[currentIndex - 1]);
                  }}
                  variant="outline">
                    Previous
                </Button>
              )}
              
              {currentIndex < dueItems.length - 1 && !showAnswer && (
                <Button onClick={() => submitAnswer("")} variant="primary">
                  Next
                </Button>
              )}
              
              {currentIndex === dueItems.length - 1 && !showAnswer && (
                <Button variant="primary" onClick={() => submitAnswer("")}>
                  Finish Review
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}