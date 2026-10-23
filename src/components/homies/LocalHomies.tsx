'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type React from 'react';
import { useGang } from '@/lib/store';
import HomieCard from '@/components/HomieCard';
import ExportDeviceData from '@/components/ExportDeviceData';

const FACES = ['😎', '🦊', '🐸', '👽', '🤖', '🐱', '💀', '🌞'];
const VOICES = ['warm', 'raspy', 'bright', 'deep', 'whisper'];

/** gang:v1 device Homies (localStorage). Used when Supabase is not configured or nobody is signed in. */
export default function LocalHomies({ notice }: { notice?: React.ReactNode }) {
  const { homies, ready, createHomie, deleteHomie } = useGang();
  const [name, setName] = useState('');
  const [face, setFace] = useState(FACES[0]);
  const [voice, setVoice] = useState(VOICES[0]);
  const [backstory, setBackstory] = useState('');
  const [interests, setInterests] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const list = interests.split(',').map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) return setError('Give your Homie a name.');
    if (list.length === 0) return setError('Add at least one interest.');
    createHomie({ name: name.trim(), face_url: face, voice_id: voice, backstory: backstory.trim(), interests: list });
    setName(''); setBackstory(''); setInterests(''); setError('');
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8">
      <Link href="/" className="text-sm text-[var(--muted)]">← Home</Link>
      <h1 className="text-4xl font-bold">Homies</h1>
      {notice}
      <ExportDeviceData />

      <form onSubmit={submit} className="gang-card flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Create a Homie</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={40}
          className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2" />
        <div>
          <p className="text-sm text-[var(--muted)] mb-2">Face</p>
          <div className="flex flex-wrap gap-2">
            {FACES.map((f) => (
              <button type="button" key={f} onClick={() => setFace(f)}
                className={`text-2xl w-11 h-11 rounded-full border ${face === f ? 'border-[var(--accent)]' : 'border-[#2a2a38]'}`}>{f}</button>
            ))}
          </div>
        </div>
        <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Voice
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2 text-[var(--fg)]">
            {VOICES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} placeholder="Backstory" rows={3}
          className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2" />
        <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Interests, comma separated (e.g. skating, jazz)"
          className="bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2" />
        {error && <p className="text-sm text-[#ff5c7c]">{error}</p>}
        <button className="self-start rounded-lg bg-[var(--accent)] px-5 py-2 font-medium">Create Homie</button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ready && homies.length === 0 && <p className="text-[var(--muted)]">No Homies yet — make your first one above.</p>}
        {homies.map((h) => <HomieCard key={h.id} homie={h} onDelete={() => deleteHomie(h.id)} />)}
      </section>
    </main>
  );
}
