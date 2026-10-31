"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title={t.common.errorTitle}
      body={t.common.errorBody}
      action={<Button onClick={() => reset()}>{t.common.retry}</Button>}
    />
  );
}
