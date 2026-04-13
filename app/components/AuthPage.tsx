"use client";

import React, { useState } from "react";
import { signIn, signUp, confirmSignUp } from "aws-amplify/auth";
import { Loader2, ArrowRight, CheckCircle2, Calendar } from "lucide-react";

export default function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"signIn" | "signUp" | "confirm">("signIn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn({ username: email, password });
      onAuthenticated();
    } catch (err: any) {
      if (err.name === "UserNotConfirmedException") {
        setMode("confirm");
        setError("Please verify your email to continue.");
      } else {
        setError(err.message || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setMode("confirm");
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      // Auto sign-in after confirmation
      await signIn({ username: email, password });
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0F0F0F] text-white">
      {/* LEFT PANE - Information / Glimpse */}
      <div className="hidden lg:flex flex-col w-1/2 bg-[#141414] border-r border-[#272727] p-12 justify-between relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#3B5BDB] opacity-10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-2xl font-semibold mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B5BDB] to-[#60A5FA] flex items-center justify-center shadow-lg shadow-[#3B5BDB]/20">
              <Calendar className="text-white w-5 h-5" />
            </div>
            Planner
          </div>

          <h1 className="text-4xl leading-tight font-medium tracking-tight mb-6">
            Organize your day,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              powered by AI.
            </span>
          </h1>

          <div className="space-y-6 mt-12">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-[#3B5BDB] mt-0.5" />
              <div>
                <h3 className="text-lg font-medium">Smart AI Assistant</h3>
                <p className="text-[#8E8E93] text-sm mt-1 leading-relaxed max-w-sm">
                  Add, edit, and orchestrate tasks using natural language.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-[#3B5BDB] mt-0.5" />
              <div>
                <h3 className="text-lg font-medium">Unified Calendar</h3>
                <p className="text-[#8E8E93] text-sm mt-1 leading-relaxed max-w-sm">
                  Sync your external ICS feeds natively inside a breathtaking UI.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-[#3B5BDB] mt-0.5" />
              <div>
                <h3 className="text-lg font-medium">Tasks & Events</h3>
                <p className="text-[#8E8E93] text-sm mt-1 leading-relaxed max-w-sm">
                  Never miss an important event or a daily task.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-[#636366] font-medium relative z-10">
          Powered by AWS Amplify & Next.js
        </div>
      </div>

      {/* RIGHT PANE - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0F0F0F]">
        <div className="w-full max-w-sm">
          {mode !== "confirm" ? (
            <>
              <div className="mb-10 text-center lg:text-left">
                <div className="flex justify-center lg:hidden mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#3B5BDB] to-[#60A5FA] flex items-center justify-center shadow-lg shadow-[#3B5BDB]/20">
                    <Calendar className="text-white w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-3xl font-medium tracking-tight mb-2">
                  {mode === "signIn" ? "Welcome back" : "Create an account"}
                </h2>
                <p className="text-[#8E8E93] text-sm">
                  {mode === "signIn"
                    ? "Enter your details to sign in to your workspace."
                    : "Fill out the fields below to get started."}
                </p>
              </div>

              <form onSubmit={mode === "signIn" ? handleSignIn : handleSignUp} className="space-y-4">
                {error && (
                  <div className="p-3 text-[13px] bg-red-900/40 text-red-300 border border-red-500/30 rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-[#A1A1AA]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1C1C1E] border border-[#38383A] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB] transition-all"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-[#A1A1AA]">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1C1C1E] border border-[#38383A] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB] transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full bg-[#3B5BDB] hover:bg-blue-600 disabled:opacity-50 text-white font-medium text-sm rounded-lg py-3 flex items-center justify-center gap-2 transition-colors mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {mode === "signIn" ? "Sign In" : "Sign Up"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-[#8E8E93]">
                {mode === "signIn" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => {
                    setMode(mode === "signIn" ? "signUp" : "signIn");
                    setError("");
                  }}
                  className="text-[#3B5BDB] hover:underline font-medium focus:outline-none"
                >
                  {mode === "signIn" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </>
          ) : (
            // CONFIRMATION UI
            <>
              <div className="mb-10 text-center lg:text-left">
                <h2 className="text-3xl font-medium tracking-tight mb-2">Check your email</h2>
                <p className="text-[#8E8E93] text-sm leading-relaxed">
                  We've sent a 6-digit confirmation code to <span className="text-white font-medium">{email}</span>.
                </p>
              </div>

              <form onSubmit={handleConfirm} className="space-y-5">
                {error && (
                  <div className="p-3 text-[13px] bg-red-900/40 text-red-300 border border-red-500/30 rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-[#A1A1AA]">Confirmation Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#1C1C1E] border border-[#38383A] rounded-lg px-4 py-3 text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB] transition-all"
                    placeholder="••••••"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full bg-[#3B5BDB] hover:bg-blue-600 disabled:opacity-50 text-white font-medium text-sm rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-[#8E8E93] hover:text-white text-sm"
                    onClick={() => {
                      setMode("signUp");
                      setCode("");
                      setError("");
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
