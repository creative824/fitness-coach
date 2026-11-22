"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Shared state of the today screen, so a tap in the menu or the workout updates the status card
 * at the top on the same frame.
 */
interface DayState {
  eatenKcal: number;
  setEatenKcal: (n: number) => void;
  workout: { done: number; total: number };
  setWorkout: (w: { done: number; total: number }) => void;
  activeMinutes: number;
  setActiveMinutes: (n: number) => void;
}

const Ctx = createContext<DayState | null>(null);

export function DayProvider({
  children,
  eatenKcal,
  workout,
  activeMinutes,
}: {
  children: ReactNode;
  eatenKcal: number;
  workout: { done: number; total: number };
  activeMinutes: number;
}) {
  const [eaten, setEaten] = useState(eatenKcal);
  const [w, setW] = useState(workout);
  const [mins, setMins] = useState(activeMinutes);
  return (
    <Ctx.Provider value={{ eatenKcal: eaten, setEatenKcal: setEaten, workout: w, setWorkout: setW, activeMinutes: mins, setActiveMinutes: setMins }}>
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
