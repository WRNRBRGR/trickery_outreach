"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center p-1 bg-[var(--surface)] border border-[var(--border)] rounded-full w-fit">
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "p-1.5 rounded-full transition-all",
          theme === "light" ? "bg-[var(--background)] shadow-sm text-[var(--accent)]" : "text-gray-500 hover:text-gray-300"
        )}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "p-1.5 rounded-full transition-all",
          theme === "dark" ? "bg-[var(--background)] shadow-sm text-[var(--accent)]" : "text-gray-500 hover:text-gray-300"
        )}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
