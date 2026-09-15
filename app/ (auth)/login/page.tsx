"use client";

import { signInWithPassword } from "@supabase/supabase-js";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function LoginPage() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: { email: string; password: string }) => {
    setState("submitting");
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    
    if (error) {
      setState("error");
      return;
    }
    
    setState("success");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-foreground text-center">Sign In</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email address</label>
            <Input
              placeholder="Enter your email"
              {...register("email")}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              {...register("password")}
            />
          </div>
          
          <Button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        
        <div className="text-center text-sm text-muted-foreground">
          <a href="/register" className="underline">Create an account</a>
        </div>
      </div>
    </div>
  );
}