import { useState, useEffect } from "react";
import { addDays, isSaturday, isSunday, isMonday, isTuesday, isWednesday, isThursday, isFriday, nextDay, format } from "date-fns";

export interface SchedulingConfig {
  daysBetween: number;
  dailyLimit: number;
  activeDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export function getDefaultConfig(): SchedulingConfig {
  return { daysBetween: 3, dailyLimit: 10, activeDays: [2, 3, 4, 5] }; // Default: Tue, Wed, Thu, Fri
}

/**
 * Hook to safely access scheduling config with hydration awareness
 */
export function useSchedulingConfig() {
  const [config, setConfig] = useState<SchedulingConfig>(getDefaultConfig());
  
  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem("scheduling_config");
      if (saved) {
        try {
          setConfig(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse scheduling config", e);
        }
      }
    };

    load();
    window.addEventListener("scheduling_config_updated", load);
    return () => window.removeEventListener("scheduling_config_updated", load);
  }, []);

  return config;
}


/**
 * Helper class to track daily limits while scheduling many items
 */
export class ScheduleTracker {
  private map: Map<string, number> = new Map();
  private config: SchedulingConfig;

  constructor(config: SchedulingConfig, existingCounts?: Map<string, number>) {
    this.config = config;
    if (existingCounts) {
      this.map = new Map(existingCounts);
    }
  }

  getNextAvailableDate(startDate: Date, minGapDays: number = 0): Date {
    let current = new Date(startDate);
    if (minGapDays > 0) {
      current.setDate(current.getDate() + minGapDays);
    }

    while (true) {
      const dateStr = format(current, "yyyy-MM-dd");
      const count = this.map.get(dateStr) || 0;
      const isAllowedDay = this.config.activeDays.includes(current.getDay());
      
      if (isAllowedDay && count < this.config.dailyLimit) {
        this.map.set(dateStr, count + 1);
        return new Date(current);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  addCount(dateStr: string) {
    this.map.set(dateStr, (this.map.get(dateStr) || 0) + 1);
  }

  getDailyCounts(): Map<string, number> {
    return new Map(this.map);
  }
}

/**
 * Calculates the next valid mailing date based on config.
 */
export function getNextValidDate(startDate: Date, activeDays: number[]): Date {
  let date = new Date(startDate);
  let attempts = 0;
  
  while (!activeDays.includes(date.getDay()) && attempts < 14) {
    date.setDate(date.getDate() + 1);
    attempts++;
  }
  
  return date;
}

/**
 * Adds an offset to a date and then finds the next valid date.
 */
export function getOffsetValidDate(startDate: Date, days: number, activeDays: number[]): Date {
  let date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return getNextValidDate(date, activeDays);
}

