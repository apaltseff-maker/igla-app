import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TableSkeleton } from "../_components/table-skeleton";

const PackagingClient = dynamic(() => import("./ui"), {
  loading: () => <TableSkeleton rows={5} cols={5} />,
});

export const revalidate = 30;

export default async function PackagingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return <PackagingClient />;
}
