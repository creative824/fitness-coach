"use client";

import { Droplet, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addWaterFill } from "@/lib/water/actions";
import { WeightTracker, type WeightInfo } from "./weight-tracker";

/** Water and weight in one small panel under the day's numbers. */
export function DayExtras({ water, weight, localWeight = false }: { water: WaterMini | null; weight: WeightInfo | null; localWeight?: boolean }) {
  if (!water && !weight) return null;
  return (
    <section aria-label="מים ומשקל" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-card)]">
      {water ? <WaterRow water={water} /> : null}
      {weight ? <WeightTracker info={weight} local={localWeight} /> : null}
    </section>
  );
}

export interface WaterMini {
  drank: number;
  target: number | null;
  vesselMl: number;
  taskId: string | null;
}

export function WaterRow({ water }: { water: WaterMini }) {
  const [drank, setDrank] = useState(water.drank);
  const [, start] = useTransition();
  const cups = water.target ? Math.max(1, Math.round(water.target / water.vesselMl)) : null;
  const done = Math.floor(drank / water.vesselMl);

  function add() {
    const size = water.vesselMl;
    const before = water.target !== null && drank >= water.target;
    const after = water.target !== null && drank + size >= water.target;
    setDrank((d) => d + size);
    start(async () => {
      const r = await addWaterFill(size, water.taskId, before === after ? null : after).catch(() => ({ ok: false }));
      if (!r.ok) setDrank((d) => d - size);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Droplet aria-hidden="true" className="size-4 fill-sky text-sky" />
        מים
        <span className="num font-normal text-white/80">
          {done}
          {cups ? `/${cups}` : ""}
        </span>
        <span className="text-xs font-normal text-white/50">כוסות</span>
      </span>
      <button
        type="button"
        onClick={add}
        aria-label="שתיתי כוס"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-white/10 transition-[background-color,transform] hover:bg-white/20 active:scale-95"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

