"use client";

import { useState, useEffect } from "react";
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

    const userId = data.user.id;
    setUser(userId);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error(profileError);
    }

    if (profile) {
      const typedProfile = profile as {
        full_name?: string | null;
        native_language?: string | null;
        target_language?: string | null;
        avatar_url?: string | null;
      };

      setFullName(typedProfile.full_name || "");
      setNativeLanguage(
        typedProfile.native_language || "Chinese"
      );
      setTargetLanguage(
        typedProfile.target_language || "Chinese"
      );
      setAvatarUrl(typedProfile.avatar_url || "");
    }

    setIsLoading(false);
  };

  const onUpdateProfile = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!user) return;

    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user,
        full_name: fullName,
        native_language: nativeLanguage,
        target_language: targetLanguage,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      } as any);

    if (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);

    setTimeout(() => {
      setSuccess(false);
    }, 3000);
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

          <h2 className="text-2xl font-bold text-foreground mb-6">
            Settings
          </h2>

          <form onSubmit={onUpdateProfile}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Full Name
              </label>

              <Input
                placeholder="Your full name"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Native Language
              </label>

              <Input
                placeholder="e.g., Chinese"
                value={nativeLanguage}
                onChange={(e) =>
                  setNativeLanguage(e.target.value)
                }
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Target Language
              </label>

              <Input
                placeholder="e.g., Chinese"
                value={targetLanguage}
                onChange={(e) =>
                  setTargetLanguage(e.target.value)
                }
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Avatar URL (optional)
              </label>

              <Input
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) =>
                  setAvatarUrl(e.target.value)
                }
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Saving..." : "Update Profile"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
