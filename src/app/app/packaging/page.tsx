import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PackagingClient from "./ui";

export default async function PackagingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  return <PackagingClient />;
}
