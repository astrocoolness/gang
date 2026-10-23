import { redirect } from 'next/navigation';

// Short share link: /clique/claim/<code> -> /clique/homies/claim?code=<code>
export default async function ClaimShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/homies/claim?code=${encodeURIComponent(code.slice(0, 64))}`);
}
