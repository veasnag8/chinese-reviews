"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default function ProgressPage() {
  const [user, setUser] = useState<string | null>(null);
  const [stats, setStats] = useState({
    wordsLearned: 0,
    sentencesLearned: 0,
    reviewSessions: 0,
    averageAccuracy: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchUser();
    fetchStats();
    fetchRecentSessions();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Redirect to login
    }
    setUser(data.user.id);
  };

  const fetchStats = async () => {
    if (!user) return;
    
    const { count: wordsCount, error: wordsError } = await supabase
      .from("words")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user);
    
    const { count: sentencesCount, error: sentencesError } = await supabase
      .from("sentences")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user);
    
    const { count: sessionsCount, error: sessionsError } = await supabase
      .from("study_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user);
    
    const { data: historyData, error: historyError } = await supabase
      .from("review_history")
      .select("correct")
      .eq("user_id", user);
    
    let avgAccuracy = 0;
    if (!historyError && historyData && historyData.length > 0) {
      const totalCorrect = historyData.reduce((sum, item) => sum + (item.correct ? 1 : 0), 0);
      avgAccuracy = Math.round((totalCorrect / historyData.length) * 100);
    }
    
    if (wordsError || sentencesError || sessionsError) return;
    
    setStats({
      wordsLearned: wordsCount || 0,
      sentencesLearned: sentencesCount || 0,
      reviewSessions: sessionsCount || 0,
      averageAccuracy,
    });
  };

  const fetchRecentSessions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("study_sessions")
      .select("*, completed_at")
      .eq("user_id", user)
      .order("started_at", { ascending: false })
      .limit(5);
    
    if (error) return;
    setRecentSessions(data || []);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">Progress</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-3xl font-bold">{stats.wordsLearned}</p>
              <p className="text-muted-foreground">Words Learned</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.sentencesLearned}</p>
              <p className="text-muted-foreground">Sentences Learned</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-3xl font-bold">{stats.reviewSessions}</p>
              <p className="text-muted-foreground">Review Sessions</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.averageAccuracy}%</p>
              <p className="text-muted-foreground">Average Accuracy</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-medium">Current Streak</p>
              <p className="text-4xl font-bold text-primary">{stats.currentStreak} days</p>
            </div>
            <div>
              <p className="text-xl font-medium">Longest Streak</p>
              <p className="text-4xl font-bold">{stats.longestStreak} days</p>
            </div>
          </div>
          
          {/* Recent Sessions */}
          {recentSessions.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Recent Review Sessions</h3>
              <ul className="space-y-3 text-sm">
                {recentSessions.map((session: any) => (
                  <li key={session.id} className="p-3 rounded-md border bg-muted">
                    <div className="flex items-center justify-between">
                      <span>{formatDate(session.started_at)}</span>
                      <span>{session.accuracy}% accuracy</span>
                    </div>
                    <p className="mt-1">
                      {session.items_count} items - {session.correct_count} correct
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState>
              <p>No review sessions yet</p>
              <p className="text-sm mt-2">Start reviewing to track your progress</p>
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}