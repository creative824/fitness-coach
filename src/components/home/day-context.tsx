"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Shared state of the today screen, so a tap in the menu or the workout updates the status card
 * at the top on the same frame.
 */
interface DayState {
  eatenKcal: number;
  setEatenKcal: (n: number) => void;
  eatenProtein: number;
  setEatenProtein: (n: number) => void;
  workout: { done: number; total: number };
  setWorkout: (w: { done: number; total: number }) => void;
  activeMinutes: number;
  setActiveMinutes: (n: number) => void;
  /** Exercises and small daily tasks done, for the tasks score. */
  actions: { done: number; total: number };
  setActions: (a: { done: number; total: number }) => void;
  /** The small daily tasks, split for the daily score: movement tasks count for fitness. */
  tasks: { moves: Count; other: Count };
  setTasks: (t: { moves: Count; other: Count }) => void;
}

export interface Count {
  done: number;
  total: number;
}

const Ctx = createContext<DayState | null>(null);

export function DayProvider({
  children,
  eatenKcal,
  eatenProtein = 0,
  workout,
  activeMinutes,
}: {
  children: ReactNode;
  eatenKcal: number;
  eatenProtein?: number;
  workout: { done: number; total: number };
  activeMinutes: number;
}) {
  const [eaten, setEaten] = useState(eatenKcal);
  const [protein, setProtein] = useState(eatenProtein);
  const [w, setW] = useState(workout);
  const [mins, setMins] = useState(activeMinutes);
  const [actions, setActions] = useState({ done: 0, total: 0 });
  const [tasks, setTasks] = useState({ moves: { done: 0, total: 0 }, other: { done: 0, total: 0 } });
  return (
    <Ctx.Provider
      value={{
        eatenKcal: eaten,
        setEatenKcal: setEaten,
        eatenProtein: protein,
        setEatenProtein: setProtein,
        workout: w,
        setWorkout: setW,
        activeMinutes: mins,
        setActiveMinutes: setMins,
        actions,
        setActions,
        tasks,
        setTasks,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDay(): DayState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDay outside DayProvider");
  return v;
}

export const fmt = (n: number) => new Intl.NumberFormat("he-IL").format(Math.round(n));
