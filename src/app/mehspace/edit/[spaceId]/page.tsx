import Link from 'next/link';
import { notFound } from 'next/navigation';
import { frameHeight, loadForEdit, renderError } from '@/lib/clique/mehspace';
import BasicsForm from '@/components/mehspace/BasicsForm';
import TopFriendsForm from '@/components/mehspace/TopFriendsForm';
import CustomEditor from '@/components/mehspace/CustomEditor';
import MediaUploader from '@/components/mehspace/MediaUploader';
import { requireUser } from '../../guard';

export const metadata = { title: 'Edit Mehspace · Clique' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gang-card flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function EditMehspace({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) notFound();
  await requireUser(`/mehspace/edit/${spaceId}`);
  const d = await loadForEdit(spaceId);
  if (!d) notFound();
  const s = d.space;
  const layout = s.layout_json ?? {};
  const err = renderError(s);
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6 pb-24">
      <Link href={d.href} className="text-sm text-[var(--muted)]">← Back to the page</Link>
      <h1 className="text-4xl font-bold">Edit Mehspace</h1>

      <Section title="Basics, mood & theme">
        <BasicsForm isUser={s.owner_type === 'user'} v={{
          id: s.id, title: s.title, mood: s.mood, about: s.about, interests: s.interests, heroes: s.heroes,
          theme: s.theme, visibility: s.visibility, song_url: s.song_url, frame_height: frameHeight(s),
        }} />
      </Section>

      <Section title="Photo & song">
        <MediaUploader spaceId={s.id} userId={d.userId} kind="photo" hasFile={typeof layout.photo_path === 'string'} />
        <MediaUploader spaceId={s.id} userId={d.userId} kind="song" hasFile={typeof layout.song_path === 'string'} />
        <p className="text-xs text-[var(--muted)]">Stored privately in Clique; only people who can see this page can load them.</p>
      </Section>

      <Section title="Top 8">
        <TopFriendsForm spaceId={s.id} friends={d.friends.map((f) => ({ id: f.id, username: f.username, display_name: f.display_name }))} initial={s.top_friends} />
      </Section>

      <Section title="Custom HTML & CSS">
        <p className="text-xs text-[var(--muted)]">
          Status: <span data-testid="render-status">{s.render_status}</span>
          {err ? ` · ${err}` : ''}
        </p>
        <CustomEditor spaceId={s.id} html={s.custom_html} css={s.custom_css} theme={s.theme} height={frameHeight(s)} />
      </Section>
    </main>
  );
}
