'use client'

import { useState, Suspense, useTransition } from 'react'
import { login } from './actions'
import { useSearchParams } from 'next/navigation'
import { Loader2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [isPending, startTransition] = useTransition()

  return (
    <form 
      className="glass-panel p-8 space-y-6 relative z-10"
      action={(formData) => startTransition(() => {
        login(formData)
      })}
    >
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold px-4 py-3 rounded-xl flex items-center space-x-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] pl-1">Email Address</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <Mail className="w-5 h-5" />
            </div>
            <input 
              name="email"
              type="email" 
              required
              placeholder="admin@trickery.com"
              className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/50 rounded-xl px-10 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)]/50 outline-none transition-all font-medium"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] pl-1">Password</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <Lock className="w-5 h-5" />
            </div>
            <input 
              name="password"
              type="password" 
              required
              placeholder="••••••••••••"
              className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/50 rounded-xl px-10 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)]/50 outline-none transition-all font-medium"
            />
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isPending}
        className="w-full bg-[var(--foreground)] text-[var(--background)] font-bold rounded-xl py-3.5 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 group"
      >
        {isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <div className="flex items-center space-x-2">
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--accent)]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-[var(--accent)]/10">
            <ShieldCheck className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-center">Secure Access</h1>
          <p className="text-[var(--muted)] text-center mt-2 font-medium">
            Enter your credentials to access the database.
          </p>
        </div>

        <Suspense fallback={
          <div className="glass-panel p-8 flex justify-center items-center relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] mt-8 opacity-50">
          Trickery Marketing © 2026
        </p>
      </div>
    </div>
  )
}
