import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', userData.user.id)
    .single();

  let org: { id: string; name: string } | null = null;
  if (profile?.org_id) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', profile.org_id)
      .single();
    org = orgData;
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Профиль</h1>
      
      <div className="space-y-2">
        <div className="text-sm">
          <strong>Email:</strong> {userData.user.email}
        </div>
        <div className="text-sm">
          <strong>User ID:</strong> {userData.user.id}
        </div>
        
        {profileError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <strong>Ошибка профиля:</strong> {profileError.message}
            <div className="mt-2 text-xs">
              Возможно, профиль не создан. Примените миграцию 20250128_auto_create_org_on_signup.sql
            </div>
          </div>
        )}
        
        {profile && (
          <div className="space-y-1">
            <div className="text-sm">
              <strong>Роль:</strong> {profile.role || 'не указана'}
            </div>
            <div className="text-sm">
              <strong>Org ID:</strong> {profile.org_id || 'не указан'}
            </div>
            {!profile.org_id && (
              <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ У вас нет org_id. Примените миграцию для создания организации.
              </div>
            )}
          </div>
        )}
        
        {org && (
          <div className="text-sm">
            <strong>Организация:</strong> {org.name} ({org.id})
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded border">
        <h2 className="font-semibold mb-2">Отладочная информация:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(
            {
              user: {
                id: userData.user.id,
                email: userData.user.email,
              },
              profile: profile || null,
              profileError: profileError ? {
                message: profileError.message,
                code: profileError.code,
                details: profileError.details,
              } : null,
              org: org || null,
            },
            null,
            2
          )}
        </pre>
      </div>
    </main>
  );
}
