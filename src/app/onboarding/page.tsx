import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/env';
import { getSessionProfile } from '@/lib/clique/profiles';
import { toUsernameCandidate } from '@/lib/clique/validate';
import { signOut } from '@/app/auth/login/actions';
import ProfileForm from './ProfileForm';
import ImportFromDevice from './ImportFromDevice';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  if (!supabaseConfigured) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="gang-card text-[var(--muted)]">
          Accounts aren&apos;t switched on for this deployment yet. Your Homies are still saved on this device.{' '}
          <Link href="/homies" className="text-[var(--accent)]">Go to Homies</Link>
        </p>
      </main>
    );
  }

  const session = await getSessionProfile();
  if (!session) redirect('/auth/login?next=/onboarding');
  const { profile, email } = session;
  const isNew = !profile;
  const initial = profile
    ? { username: profile.username, display_name: profile.display_name, bio: profile.bio, status: profile.status, privacy: profile.privacy }
    : { username: toUsernameCandidate(email?.split('@')[0] ?? ''), display_name: '', bio: '', status: '', privacy: 'friends' as const };

  return (
    <main className="max-w-xl mx-auto px-4 py-12 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">{isNew ? 'Welcome to Clique' : 'Edit your profile'}</h1>
        <p className="text-sm text-[var(--muted)]">
          {isNew ? 'Pick a username so your friends can find you. You can change it later.' : `Signed in as ${email ?? 'you'}.`}
        </p>
      </div>
      <ProfileForm initial={initial} isNew={isNew} />
      {!isNew && <ImportFromDevice />}
      <form action={signOut}><button className="text-sm text-[var(--muted)] underline">Sign out</button></form>
    </main>
  );
}
