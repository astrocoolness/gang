'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { createHomieAction, type FormState } from '@/app/homies/actions';
import { DESCRIPTOR_OPTIONS, KINDS, LOOK_OPTIONS, SPECIES_OPTIONS, STAGE_OPTIONS } from '@/lib/homies/constants';
import { asset } from '@/lib/homies/asset';
import type { HomieKind } from '@/lib/clique/types';
import { FacePicker, FieldError, inputCls, VisibilitySelect } from './fields';

export default function CreateHomieForm({ initialKind, hasAvatar }: { initialKind: HomieKind; hasAvatar: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createHomieAction, { status: 'idle' });
  const [kind, setKind] = useState<HomieKind>(hasAvatar && initialKind === 'avatar' ? 'pet' : initialKind);
  const [species, setSpecies] = useState<string>('tony');
  const [look, setLook] = useState<string>('tony');
  const e = state.errors ?? {};
  const custom = kind === 'pet' && species === 'custom';
  const builtinPet = kind === 'pet' && !custom;

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-sm text-[var(--muted)] mb-2">What are you making?</legend>
        {KINDS.map((k) => {
          const disabled = k.kind === 'avatar' && hasAvatar;
          return (
            <label key={k.kind} className={`gang-card cursor-pointer ${kind === k.kind ? 'border-[var(--accent)]' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <input type="radio" name="kind" value={k.kind} checked={kind === k.kind} disabled={disabled}
                onChange={() => setKind(k.kind)} className="sr-only" />
              <span className="font-semibold">{k.label}</span>
              <span className="block text-xs text-[var(--muted)] mt-1">{disabled ? 'You already have one.' : k.blurb}</span>
            </label>
          );
        })}
      </fieldset>
      <FieldError msg={e.kind} />

      {kind === 'pet' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm text-[var(--muted)] mb-2">Who are you raising?</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            {SPECIES_OPTIONS.map((sp) => (
              <label key={sp.id} className={`gang-card cursor-pointer flex flex-col items-center gap-2 text-center ${species === sp.id ? 'border-[var(--accent)]' : ''}`}>
                <input type="radio" name="species" value={sp.id} checked={species === sp.id} onChange={() => setSpecies(sp.id)} className="sr-only" />
                {sp.id !== 'custom'
                  ? <Image src={asset(`/homies/${sp.id}-baby.png`)} alt="" width={72} height={72} className="rounded-full" />
                  : <span className="text-4xl h-[72px] flex items-center">✨</span>}
                <span className="font-semibold">{sp.label}</span>
                <span className="text-xs text-[var(--muted)]">{sp.blurb}</span>
              </label>
            ))}
          </div>
          <FieldError msg={e.species} />
          <label className="text-sm text-[var(--muted)] flex flex-col gap-2 max-w-xs">Starting age
            <select name="stage" defaultValue="baby" className={inputCls}>
              {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </fieldset>
      )}

      <div className="gang-card flex flex-col gap-4">
        {!builtinPet && (
          <label className="text-sm text-[var(--muted)] flex flex-col gap-2">
            {kind === 'friend_page' ? "Your friend's name" : 'Name'}
            <input name="name" required maxLength={custom ? 16 : 40} className={inputCls}
              placeholder={kind === 'avatar' ? 'What should your Homie be called?' : kind === 'friend_page' ? 'e.g. Marcus' : 'e.g. Pickle'} />
            <FieldError msg={e.name} />
          </label>
        )}
        {kind !== 'pet' && <FacePicker />}

        {custom && (
          <>
            <div>
              <p className="text-sm text-[var(--muted)] mb-2">Look</p>
              <div className="flex gap-3">
                {LOOK_OPTIONS.map((l) => (
                  <label key={l} className={`rounded-full border-2 cursor-pointer ${look === l ? 'border-[var(--accent)]' : 'border-transparent'}`}>
                    <input type="radio" name="look" value={l} checked={look === l} onChange={() => setLook(l)} className="sr-only" />
                    <Image src={asset(`/homies/${l}-kid.png`)} alt={l} width={56} height={56} className="rounded-full" />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--muted)] mb-2">Vibe (up to 5)</p>
              <div className="flex flex-wrap gap-2">
                {DESCRIPTOR_OPTIONS.map((d) => (
                  <label key={d} className="text-xs px-3 py-1 rounded-full border border-[#2a2a38] has-[:checked]:border-[var(--accent)] has-[:checked]:text-[var(--accent)] cursor-pointer">
                    <input type="checkbox" name="descriptors" value={d} className="sr-only" />{d}
                  </label>
                ))}
              </div>
            </div>
            <input name="home" maxLength={80} placeholder="Where do they live? (e.g. A van by the river)" className={inputCls} />
            <input name="days" maxLength={80} placeholder="How do they spend their days? (e.g. Fixing radios)" className={inputCls} />
            <input name="habit" maxLength={80} placeholder="A habit (e.g. Hums at the kettle.)" className={inputCls} />
          </>
        )}

        <label className="text-sm text-[var(--muted)] flex flex-col gap-2">
          {kind === 'friend_page' ? 'About them' : 'Backstory'}
          <textarea name="backstory" rows={3} maxLength={2000} className={inputCls} />
          <FieldError msg={e.backstory} />
        </label>
        <input name="interests" placeholder="Interests, comma separated (e.g. skating, jazz)" className={inputCls} />
        <VisibilitySelect />
      </div>

      {state.status === 'error' && state.message && <p className="text-sm text-[#ff5c7c]" role="alert">{state.message}</p>}
      <button disabled={pending} className="self-start rounded-lg bg-[var(--accent)] px-5 py-2 font-medium disabled:opacity-50">
        {pending ? 'Making…' : kind === 'pet' ? 'Hatch' : 'Create Homie'}
      </button>
    </form>
  );
}
