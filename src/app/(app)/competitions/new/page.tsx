import type { Metadata } from "next";
import { BackLink, CreateCompetitionForm } from "@/components/competitions/create-form";
import { PageHeader } from "@/components/ui/page-header";
import { getProfileSummary } from "@/lib/data/profile";
import { requireUser } from "@/lib/data/user";

export const metadata: Metadata = { title: "תחרות חדשה" };

export default async function NewCompetitionPage() {
  const user = await requireUser();
  const profile = await getProfileSummary(user.id);
  return (
    <>
      <BackLink />
      <PageHeader title="תחרות חדשה" subtitle="פרטית: רק מי שמקבל ממך את הקוד יכול להצטרף." />
      <CreateCompetitionForm defaultNickname={profile?.display_name?.trim().slice(0, 30) ?? ""} />
    </>
  );
}
