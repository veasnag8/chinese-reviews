import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("Chinese");
  const [targetLanguage, setTargetLanguage] = useState("Chinese");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState(false);

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
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    
    if (profile) {
      setFullName(profile.full_name || "");
      setNativeLanguage(profile.native_language || "Chinese");
      setTargetLanguage(profile.target_language || "Chinese");
      setAvatarUrl(profile.avatar_url || "");
    }
    
    setIsLoading(false);
  };

  const onUpdateProfile = async () => {
    setIsLoading(true);
    
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user!,
        full_name: fullName,
        native_language: nativeLanguage,
        target_language: targetLanguage,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      setIsLoading(false);
      return;
    }
    
    setSuccess(true);
    setIsLoading(false);
    
    setTimeout(() => setSuccess(false), 3000);
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Card className="p-8">
          {success && (
            <div className="mb-4 p-4 rounded-md bg-green-100 text-green-800">
              Profile updated successfully!
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-foreground mb-6">Settings</h2>
          
          <form>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <Input
                placeholder="Your full name"
                value={fullName}
                onValueChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Native Language</label>
              <Input
                placeholder="e.g., Chinese"
                value={nativeLanguage}
                onValueChange={(e) => setNativeLanguage(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Target Language</label>
              <Input
                placeholder="e.g., Chinese"
                value={targetLanguage}
                onValueChange={(e) => setTargetLanguage(e.target.value)}
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Avatar URL (optional)</label>
              <Input
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onValueChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            
            <Button type="submit" onClick={onUpdateProfile} 
              disabled={isLoading}
              className="w-full">
              {isLoading ? "Saving..." : "Update Profile"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}