'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGang } from '@/lib/store';
import { ATTENTION_COST_PER_MINUTE, canDial } from '@/lib/dial';
import AttentionBar from '@/components/AttentionBar';

/** Seconds between attention ticks: drains 1 point per tick at the per-minute rate. */
const TICK_SECONDS = 60 / ATTENTION_COST_PER_MINUTE;

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function DialPage() {
  const { id } = useParams<{ id: string }>();
  const { homies, ready, setAttention } = useGang();
  const homie = homies.find((h) => h.id === id);
  const [onCall, setOnCall] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drained, setDrained] = useState(0);
  const attentionRef = useRef(0);
  attentionRef.current = homie?.attention ?? 0;

  useEffect(() => {
    if (!onCall) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next % TICK_SECONDS === 0) {
          setAttention(id, (a) => a - 1);
          setDrained((d) => d + 1);
          if (attentionRef.current - 1 <= 0) setOnCall(false);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onCall, id, setAttention]);

  if (!ready) return null;
  if (!homie) {
    return <main className="p-12 text-center">Homie not found. <Link href="/homies" className="text-[var(--accent)]">Back to Homies</Link></main>;
  }

  const muted = !canDial(homie.attention);

  function start() {
    setElapsed(0);
    setDrained(0);
    setOnCall(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <Link href="/dial" className="text-sm text-[var(--muted)]">← Dial</Link>
      <div className={`text-8xl w-40 h-40 flex items-center justify-center rounded-full bg-[#14141c] border border-[#2a2a38] ${onCall ? 'dial-ring' : ''} ${muted ? 'opacity-40 grayscale' : ''}`}>
        {homie.face_url}
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold">{homie.name}</h1>
        <p className="text-[var(--muted)]">{onCall ? `On the line · ${fmt(elapsed)}` : muted ? 'Line muted' : `${homie.voice_id} voice · ready`}</p>
      </div>
      <div className="w-64"><AttentionBar value={homie.attention} /></div>

      {muted && !onCall ? (
        <div className="text-center flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)] max-w-xs">{homie.name} has no attention left. Spend time on their Mess Space to bring the line back.</p>
          <Link href={`/mess-space/${homie.id}`} className="rounded-full bg-[var(--accent)] px-6 py-3">Go to Mess Space</Link>
        </div>
      ) : onCall ? (
        <button onClick={() => setOnCall(false)} className="rounded-full bg-[#ff5c7c] w-20 h-20 text-3xl" aria-label="Hang up">✆</button>
      ) : (
        <button onClick={start} className="rounded-full bg-[#2ecc71] w-20 h-20 text-3xl" aria-label="Call">✆</button>
      )}

      {!onCall && drained > 0 && (
        <p className="text-sm text-[var(--muted)]">Last call: {fmt(elapsed)} · −{drained} attention</p>
      )}
      <p className="text-xs text-[var(--muted)]">Calls cost {ATTENTION_COST_PER_MINUTE} attention per minute.</p>
    </main>
  );
}
