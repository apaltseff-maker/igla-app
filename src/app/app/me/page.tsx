import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('org_id, role')
    .single();

  return (
    <main className="p-6 space-y-2">
      <h1 className="text-2xl font-semibold">Профиль</h1>
      <div className="text-sm">email: {userData.user.email}</div>
      <pre className="text-xs bg-gray-100 p-3 rounded">
        {JSON.stringify({ profile, error }, null, 2)}
      </pre>
    </main>
  );
}
