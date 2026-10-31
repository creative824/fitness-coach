import { ButtonLink } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t.common.notFoundTitle}</h1>
      <p className="text-ink-muted">{t.common.notFoundBody}</p>
      <ButtonLink href="/">{t.common.backHome}</ButtonLink>
    </main>
  );
}
