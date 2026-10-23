// npm run test:homies — pure engine/adapter checks (no DB, no network).
import assert from 'node:assert/strict';
import { mintProfile } from '../mint';
import { advance, columnsOf, compact, newPetSim, project, readSim, viewOf, type CareEvent } from '../sim';

let passed = 0;
const ok = (label: string) => { passed++; console.log('  ✓', label); };
const t0 = Date.parse('2026-10-16T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const tony = newPetSim({ homieId: '00000000-0000-0000-0000-000000000001', species: 'tony', nowMs: t0 });
assert.equal(viewOf(tony).name, 'Tony'); assert.equal(viewOf(tony).stage, 'baby');
assert.ok(viewOf(tony).portrait.endsWith('tony-baby.png'));
ok('built-in Tony hatches as a baby');

const later = advance(tony, t0 + 60 * 60_000);
assert.ok(later.save.gameMinute > tony.save.gameMinute);
assert.ok(later.save.homies.tony.stats.hunger < tony.save.homies.tony.stats.hunger);
ok('stats decay as wall time passes');

const evs: CareEvent[] = [
  { id: 'b', created_at: iso(t0 + 30 * 60_000), actor_id: 'x', payload: { action: 'feed', food: 'meal' } },
  { id: 'a', created_at: iso(t0 + 30 * 60_000), actor_id: 'y', payload: { action: 'play' } },
];
const p1 = project(tony, evs, t0 + 60 * 60_000);
assert.equal(p1.applied, 2); assert.ok(p1.results.a && p1.results.b);
assert.ok(p1.sim.save.homies.tony.stats.hunger > later.save.homies.tony.stats.hunger);
const p2 = project(p1.sim, evs, t0 + 61 * 60_000);
assert.equal(p2.applied, 0);
ok('care events replay once, in order, and raise stats');

const roundTrip = readSim(JSON.parse(JSON.stringify(compact(p1.sim))));
assert.ok(roundTrip); assert.deepEqual(columnsOf(roundTrip), columnsOf(p1.sim));
assert.equal(readSim({ v: 1, engineId: 'evil', save: {} }), null);
ok('sim round-trips through jsonb; junk is rejected');

const grown = project(tony, [], t0 + 2 * 60 * 60_000);
assert.ok(grown.evolved, 'expected an evolution after 12 game hours');
assert.equal(grown.evolved.from, 'baby'); assert.equal(grown.evolved.to, 'kid');
ok('pets evolve baby -> kid after 8 game hours (80 real minutes)');

const custom = mintProfile({ name: 'Pickle', descriptors: ['Lazy', 'Kind', 'Nope'], home: 'A van', days: 'Fixing radios', habit: 'Hums at the kettle.', stage: 'teen', look: 'nori' });
assert.ok(custom); assert.deepEqual(custom.descriptors, ['Lazy', 'Kind']);
const pickle = newPetSim({ homieId: 'abcdef12-3456-7890-abcd-ef1234567890', species: 'custom', custom, stage: 'teen', nowMs: t0 });
const v = viewOf(pickle);
assert.equal(v.name, 'Pickle'); assert.equal(v.stage, 'teen'); assert.ok(v.portrait.endsWith('nori-teen.png'));
assert.ok(readSim(JSON.parse(JSON.stringify(pickle))));
const fed = project(pickle, [{ id: 'z', created_at: iso(t0 + 1000), actor_id: null, payload: { action: 'feed', food: 'fav' } }], t0 + 2000);
assert.match(fed.results.z, /Pickle|usual/i);
ok('custom homies mint from a template, start at any stage, and take care');

const longGone = project(tony, [], t0 + 30 * 24 * 60 * 60_000);
assert.ok(longGone.sim.save.homies.tony.stats.health >= 0);
ok('a month away is bounded (weathering) and stays valid');

console.log(`\nAll ${passed} homies engine checks passed.`);
