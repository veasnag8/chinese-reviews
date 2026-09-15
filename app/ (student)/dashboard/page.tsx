import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [stats, setStats] = useState({
    wordsLearned: 0,
    sentencesLearned: 0,
    mastered: 0,
    accuracy: 0,
  });
  const [recentClasses, setRecentClasses] = useState<Array<{ name: string; date: string; items: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      router.push("/login");
      return;
    }
    setUser(data.user.id);
    fetchStats();
    fetchRecentClasses();
    setIsLoading(false);
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
    
    const { count: masteredCount, error: masteredError } = await supabase
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user)
      .eq("difficulty", "easy");
    
    if (wordsError || sentencesError || masteredError) return;
    
    const accuracy = wordsCount > 0 ? Math.round((masteredCount / wordsCount) * 100) : 0;
    
    setStats({
      wordsLearned: wordsCount || 0,
      sentencesLearned: sentencesCount || 0,
      mastered: masteredCount || 0,
      accuracy,
    });
  };

  const fetchRecentClasses = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("classes")
      .select("name, date")
      .eq("user_id", user)
      .order("date", { ascending: false })
      .limit(5);
    
    if (error) return;
    
    const items = data?.map((cls: any) => ({
      name: cls.name,
      date: formatDate(cls.date),
      items: 0, // Would need to count words + sentences
    })) || [];
    
    setRecentClasses(items);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- Stats Cards -->
          <div>
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Today's Review</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-2xl font-bold">{stats.wordsLearned}</p>
                  <p className="text-sm text-muted-foreground">Words</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sentencesLearned}</p>
                  <p className="text-sm text-muted-foreground">Sentences</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.mastered}</p>
                  <p className="text-sm text-muted-foreground">Mastered</p>
                </div>
              </div>
            </Card>
          </div>
          
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Recent Classes</h3>
            {recentClasses.length === 0 ? (
              <EmptyState>
                <p>No classes yet</p>
                <p className="text-sm mt-2">Create your first class to get started</p>
                <Button onClick={() => router.push("/classes")}>Add Class</Button>
              </EmptyState>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentClasses.map((cls, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span>{cls.name}</span>
                    <span>{cls.date}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          
          {/* Progress Chart placeholder */}
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Progress</h3>
            <p className="text-sm text-muted-foreground">Charts coming soon</p>
          </Card>
        </div>
      </div>
    </div>
  );
}