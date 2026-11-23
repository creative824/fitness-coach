"use client";

import { Check, Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { AvatarEditor } from "@/components/ui/avatar-editor";
import { FaceAvatar } from "@/components/ui/face-avatar";
import type { AvatarConfig } from "@/lib/avatar";
import { saveAvatar } from "@/lib/profile/avatar-actions";

/** The face on the profile, with a button that opens the editor in place. */
export function AvatarCard({ initial, name }: { initial: AvatarConfig; name: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(false);
    start(async () => {
      const r = await saveAvatar(value).catch(() => ({ ok: false }));
      if (r.ok) {
        setSaved(value);
        setOpen(false);
      } else setError(true);
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-4">
        <FaceAvatar seed="me" config={saved} size={64} />
        <div className="flex flex-1 flex-col">
          <span className="font-semibold">האווטאר שלי</span>
          <span className="text-sm text-ink-muted">ככה רואים אותך בתחרויות</span>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-field px-3 text-sm font-medium hover:bg-line/60">
          <Pencil aria-hidden="true" className="size-4" />
          עריכה
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <AvatarEditor value={value} onChange={setValue} name={name} />
      {error ? (
        <p role="alert" className="text-sm text-warning">
          השמירה לא הצליחה. נסו שוב.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand px-4 font-medium text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
          שמירה
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(saved);
            setOpen(false);
          }}
          className="min-h-11 cursor-pointer rounded-xl bg-field px-4 text-sm hover:bg-line/60"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
