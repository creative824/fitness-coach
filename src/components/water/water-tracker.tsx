import { Droplet, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";
import { addWaterFill, setWaterVessel, undoWaterFill } from "@/lib/water/actions";
import type { WaterToday } from "@/lib/water/data";
import { VESSEL_SIZES_ML } from "@/lib/water/plan";

const t = getDictionary().water;

/**
 * Water card for the today screen: one drop per fill of the user's own glass or bottle,
 * a +1 button per finished fill, and a pace line that spreads drinking over the day.
 * Server-rendered; every button is a server-action form.
 */
export function WaterTracker({ water }: { water: WaterToday }) {
  const { pace, vesselMl, drankMl } = water;
  const vesselName = t.vessels[String(vesselMl) as keyof typeof t.vessels] ?? `${vesselMl}`;
  const fillsDone = pace ? pace.fillsDone : Math.floor(drankMl / vesselMl);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t.title}</h2>
        {pace ? (
          <span className="ltr-nums text-sm text-ink-muted">{t.progress(pace.fillsDone, pace.fillsTotal)}</span>
        ) : null}
      </div>

      {pace ? (
        <>
          <ol className="flex flex-wrap gap-1.5" aria-label={t.progress(pace.fillsDone, pace.fillsTotal)}>
            {Array.from({ length: pace.fillsTotal }, (_, i) => (
              <li key={i}>
                <Droplet
                  aria-hidden="true"
                  className={`size-7 ${i < pace.fillsDone ? "fill-brand text-brand" : i < pace.fillsExpected ? "text-warning" : "text-line"}`}
                />
              </li>
            ))}
          </ol>
          <p className="text-sm" role="status">
            <span className="font-medium">{t.status[pace.status]}</span>
            {pace.nextAt ? <span className="text-ink-muted"> · {t.nextAt(pace.nextAt)}</span> : null}
          </p>
        </>
      ) : (
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{t.noTarget}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action={addWaterFill}>
          <Button type="submit" className="min-h-12 px-6">
            {t.add} · {vesselName}
          </Button>
        </form>
        {fillsDone > 0 || drankMl > 0 ? (
          <form action={undoWaterFill}>
            <Button type="submit" variant="ghost" className="min-h-12 px-3" aria-label={t.undo} title={t.undo}>
              <Undo2 aria-hidden="true" className="size-5" />
            </Button>
          </form>
        ) : null}
      </div>

      <form action={setWaterVessel} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t.vesselLabel}</span>
        <div className="flex flex-wrap gap-2">
          {VESSEL_SIZES_ML.map((v) => (
            <button
              key={v}
              type="submit"
              name="vessel_ml"
              value={v}
              aria-pressed={v === vesselMl}
              className={`min-h-10 rounded-xl border px-3 text-sm ${v === vesselMl ? "border-brand bg-brand-soft font-medium" : "border-line"}`}
            >
              {t.vessels[String(v) as keyof typeof t.vessels]} <span className="ltr-nums text-ink-muted">{v}</span>
            </button>
          ))}
        </div>
      </form>

      <p className="text-xs text-ink-muted">{t.howItWorks}</p>
    </Card>
  );
}
