"use client";

import { useState } from "react";
import { getPitch } from "@/app/actions/ai";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function testGemini() {
    setLoading(true);
    setResult(null);
    
    // Simple test call
    const res = await getPitch(
      "Test User",
      "Test Agency",
      "Test Reel",
      "A test description to see if the API is working."
    );

    if (res.success) {
      setResult({ success: true, message: "Success! Gemini responded: " + res.pitch?.substring(0, 50) + "..." });
    } else {
      setResult({ success: false, message: "Error: " + (res.error || "Unknown failure") });
    }
    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto py-20 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-black mb-2">System Diagnostics</h1>
        <p className="text-gray-500">Test your API connections here.</p>
      </div>

      <div className="glass-panel space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">Gemini AI Engine</h3>
            <p className="text-xs text-gray-500">Verifies your GEMINI_API_KEY from .env.local</p>
          </div>
          <button 
            onClick={testGemini}
            disabled={loading}
            className="btn-primary flex items-center text-sm py-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Test Connection
          </button>
        </div>

        {result && (
          <div className={cn(
            "p-4 rounded-xl flex items-start space-x-3 animate-in zoom-in-95",
            result.success ? "bg-green-950/20 text-green-400 border border-green-500/20" : "bg-red-950/20 text-red-400 border border-red-500/20"
          )}>
            {result.success ? <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />}
            <p className="text-sm font-medium leading-relaxed">{result.message}</p>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-600">
          Note: If this fails, ensure your key is correct in <code className="bg-white/5 px-1 rounded">.env.local</code> and you have restarted your dev server.
        </p>
      </div>
    </div>
  );
}
