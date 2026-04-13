"use client";

import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { getCurrentUser } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import AuthPage from "@/app/components/AuthPage";
import { Loader2 } from "lucide-react";

Amplify.configure(outputs);

export default function AuthClient({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const checkAuth = async () => {
    try {
      await getCurrentUser();
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0F0F0F]">
        <Loader2 className="w-8 h-8 text-[#3B5BDB] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return <>{children}</>;
}
