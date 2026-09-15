"use client";

import { signUp } from "@supabase/supabase-js";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
});

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "", fullName: "" });
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: { email: string; password: string; fullName: string }) => {
    setState("submitting");
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    });
    
    if (error) {
      setState("error");
      return;
    }
    
    setState("success");
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-foreground text-center">Create Account</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email address</label>
            <Input
              placeholder="Enter your email"
              {...register("email")}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Full name</label>
            <Input
              placeholder="Enter your name"
              {...register("fullName")}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              placeholder="Create a password"
              {...register("password")}
            />
          </div>
          
          <Button type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Creating account..." : "Create Account"}
          </Button>
        </form>
        
        <div className="text-center text-sm text-muted-foreground">
          <a href="/login" className="underline">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  );
}