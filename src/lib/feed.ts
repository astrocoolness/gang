import type { Homie, MessSpace } from '@/types';

export type LocalFeedEntry = {
  id: string;
  spaceId: string;
  homieId: string;
  homieName: string;
  face: string;
  author: string;
  body: string;
  createdAt: string;
  likes: number;
};
export type FeedSort = 'recent' | 'popular';

export function buildLocalFeed(
  homies: readonly Homie[],
  spaces: readonly MessSpace[],
  options: { search?: string; sort?: FeedSort; limit?: number } = {},
): LocalFeedEntry[] {
  const byHomie=new Map(homies.map(h=>[h.id,h]));
  const search=(options.search||'').toLocaleLowerCase().trim().slice(0,80);
  const sort=options.sort==='popular'?'popular':'recent';
  const limit=Math.max(1,Math.min(200,Number.isSafeInteger(options.limit)?options.limit!:100));
  const items: LocalFeedEntry[]=[];
  for (const space of spaces) {
    const h=byHomie.get(space.homie_id);
    if (!h || !Array.isArray(space.posts)) continue;
    for (const post of space.posts) {
      if (!post || typeof post.body!=='string' || !post.body.trim() || post.body.length>10000) continue;
      const stamp=Date.parse(post.created_at);
      if(!Number.isFinite(stamp)) continue;
      const author=post.author_homie_id==='local-visitor'?'You':byHomie.get(post.author_homie_id)?.name||'Unknown author';
      const entry={
        id:post.id,spaceId:space.id,homieId:space.homie_id,homieName:h.name,face:h.face_url,
        author,body:post.body,createdAt:post.created_at,
        likes:Array.isArray(post.likes)?new Set(post.likes.filter(x=>typeof x==='string')).size:0,
      };
      if(search && ![entry.body,entry.homieName,entry.author].some(s=>s.toLocaleLowerCase().includes(search))) continue;
      items.push(entry);
    }
  }
  const byDate=(a:LocalFeedEntry,b:LocalFeedEntry)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id);
  items.sort(sort==='popular'?(a,b)=>b.likes-a.likes||byDate(a,b):byDate);
  return items.slice(0,limit);
}
