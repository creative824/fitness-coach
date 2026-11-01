import type { Metadata } from "next";
import { BackLink } from "@/components/competitions/create-form";
import { JoinCompetitionForm } from "@/components/competitions/join-form";
import { PageHeader } from "@/components/ui/page-header";
import { getProfileSummary } from "@/lib/data/profile";
import { requireUser } from "@/lib/data/user";

export const metadata: Metadata = { title: "הצטרפות לתחרות" };

export default async function JoinCompetitionPage({ searchParams }: PageProps<"/competitions/join">) {
  const user = await requireUser();
  const [profile, sp] = await Promise.all([getProfileSummary(user.id), searchParams]);
  const code = typeof sp.code === "string" ? sp.code.slice(0, 12).toUpperCase() : "";
  return (
    <>
      <BackLink />
      <PageHeader title="הצטרפות לתחרות" subtitle="הקוד מגיע ממי שיצר את התחרות." />
      <JoinCompetitionForm initialCode={code} defaultNickname={profile?.display_name?.trim().slice(0, 30) ?? ""} />
    </>
  );
}
