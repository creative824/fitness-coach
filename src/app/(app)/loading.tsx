import { LoadingState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

export default function Loading() {
  return <LoadingState label={getDictionary().common.loading} />;
}
