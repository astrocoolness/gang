import type { CliqueActivity } from './types';

type Person = { username: string; display_name: string } | undefined;

const CARE: Record<string, string> = { feed: 'fed', play: 'played with', clean: 'cleaned up', talk: 'talked with' };
const STAGE: Record<string, string> = { baby: 'a baby', kid: 'a kid', teen: 'a teen', adult: 'an adult', elder: 'an elder' };

/** One line of Home feed copy for an activity. Pure: used by the server-rendered Home. */
export function activityLine(a: CliqueActivity, me: string, people: Record<string, Person>) {
  const who = (id: string | null) =>
    !id ? 'Someone' : id === me ? 'You' : people[id]?.display_name || (people[id]?.username ? `@${people[id]!.username}` : 'A friend');
  const actor = who(a.actor_id);
  const homie = typeof a.summary?.homie_name === 'string' ? a.summary.homie_name : 'a Homie';
  switch (a.verb) {
    case 'homie_created': return `${actor} made ${homie}.`;
    case 'homie_evolved': return `${homie} grew up${a.summary?.to ? ` into ${STAGE[String(a.summary.to)] ?? a.summary.to}` : ''}.`;
    case 'homie_claimed': return `${actor} claimed the page ${homie}.`;
    case 'homie_cared': {
      const verb = CARE[String(a.summary?.action)] ?? 'looked after';
      const owner = a.target_user_id === me ? 'your' : `${who(a.target_user_id)}'s`;
      return `${actor} ${verb} ${owner} Homie ${homie}.`;
    }
    case 'homie_reel': return `${homie} has a new reel.`;
    case 'homie_narrative': return `${homie} has a new story.`;
    case 'posted': return `${actor} posted${a.target_user_id ? ` on ${who(a.target_user_id)}'s Mehspace` : ''}: “${String(a.summary?.excerpt ?? '')}”`;
    case 'blurbed': return `${actor} updated their blurb.`;
    case 'befriended':
      return a.target_user_id === me
        ? `You and ${actor} are now friends.`
        : `${actor} and ${who(a.target_user_id)} are now friends.`;
    case 'joined_circle': return `${actor} joined a Circle.`;
    case 'created_circle': return `${actor} started a Circle.`;
    default: return `${actor} did something.`;
  }
}
