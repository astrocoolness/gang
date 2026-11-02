import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalFeed } from '../src/lib/feed.ts';
const homies=[{id:'h1',name:'Alex',face_url:'🐯'},{id:'h2',name:'Sam',face_url:'⭐'}];
const spaces=[{id:'s1',homie_id:'h1',posts:[
{id:'p1',author_homie_id:'local-visitor',body:'Late night show',created_at:'2026-11-01T20:00:00Z',likes:['a','a','b']},
{id:'p2',author_homie_id:'h2',body:'Record digging',created_at:'2026-11-02T09:00:00Z',likes:['b']},
]},{id:'s2',homie_id:'h2',posts:[
{id:'p3',author_homie_id:'h2',body:'Bluegrass concert',created_at:'2026-11-02T08:00:00Z',likes:['a','b','c']},
]}];
test('local feed sorts by time and preserves source/author',()=>{
 const feed=buildLocalFeed(homies,spaces);
 assert.deepEqual(feed.map(x=>x.id),['p2','p3','p1']);
 assert.equal(feed[2].author,'You');
 assert.equal(feed[0].homieId,'h1');
 assert.equal(feed[2].likes,2);
});
test('popular and case-insensitive search work',()=>{
 assert.deepEqual(buildLocalFeed(homies,spaces,{sort:'popular'}).map(x=>x.id),['p3','p1','p2']);
 assert.deepEqual(buildLocalFeed(homies,spaces,{search:'CONCERT'}).map(x=>x.id),['p3']);
});
test('missing homies, invalid posts and invalid timestamps are omitted',()=>{
 const broken=[...spaces,{id:'s3',homie_id:'missing',posts:[{id:'private',body:'secret',created_at:'2026-11-02T08:00:00Z'}]},
 {id:'s4',homie_id:'h1',posts:[{id:'bad',body:'bad',created_at:'not-a-date'}]}];
 assert.equal(buildLocalFeed(homies,broken).length,3);
});
test('pagination cap is bounded and source arrays are not mutated',()=>{
 const copy=JSON.stringify(spaces);
 assert.equal(buildLocalFeed(homies,spaces,{limit:1}).length,1);
 assert.equal(buildLocalFeed(homies,spaces,{limit:900}).length,3);
 assert.equal(JSON.stringify(spaces),copy);
});
