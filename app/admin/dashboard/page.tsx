"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function AdminDashboardPage() {
  const [user, setUser] = useState<string | null>(null);
  const [stats, setStats] = useState({
    users: 0,
    words: 0,
    sentences: 0,
    classes: 0,
    reviewsToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchUser();
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Check for admin
    }
    setUser(data.user.id);
  };

  const fetchStats = async () => {
    if (!user) return;
    
    // Count users - this is simplified, in real app would check role
    const { count: usersCount, error: usersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    
    // Count words
    const { count: wordsCount, error: wordsError } = await supabase
      .from("words")
      .select("*", { count: "exact", head: true });
    
    // Count sentences
    const { count: sentencesCount, error: sentencesError } = await supabase
      .from("sentences")
      .select("*", { count: "exact", head: true });
    
    // Count classes
    const { count: classesCount, error: classesError } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true });
    
    // Count reviews today (simplified)
    const today = new Date().toISOString().split("T")[0];
    const { count: reviewsCount, error: reviewsError } = await supabase
      .from("review_history")
      .select("*", { count: "exact", head: true })
      .gte("completed_at", `${today}T00:00:00Z`);
    
    if (usersError || wordsError || sentencesError || classesError || reviewsError) return;
    
    setStats({
      users: usersCount || 0,
      words: wordsCount || 0,
      sentences: sentencesCount || 0,
      classes: classesCount || 0,
      reviewsToday: reviewsCount || 0,
    });
  };

  const fetchRecentActivity = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("review_history")
      .select(`
        *,
        profiles!review_history_user_id_fkey (*)
      `)
      .order("completed_at", { ascending: false })
      .limit(5);
    
    if (error) return;
    setRecentActivity(data || []);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Stats Cards */}
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Users</h3>
            <p className="text-3xl font-bold">{stats.users}</p>
            <p className="text-muted-foreground">Total users</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Words</h3>
            <p className="text-3xl font-bold">{stats.words}</p>
            <p className="text-muted-foreground">Total words</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Sentences</h3>
            <p className="text-3xl font-bold">{stats.sentences}</p>
            <p className="text-muted-foreground">Total sentences</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Classes</h3>
            <p className="text-3xl font-bold">{stats.classes}</p>
            <p className="text-muted-foreground">Total classes</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Reviews Today</h3>
            <p className="text-3xl font-bold">{stats.reviewsToday}</p>
            <p className="text-muted-foreground">Total reviews</p>
          </Card>
        </div>
        
        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground">No activity yet</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recentActivity.map((activity: any) => (
                <li key={activity.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                  <div>
                    <span className="text-sm">{activity.user_id}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(activity.completed_at)}</span>
                  </div>
                  <span className="text-xs text-primary">{activity.correct ? "Correct" : "Incorrect"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}


