'use client';

import { useState } from 'react';
import { FACES, VISIBILITY_OPTIONS } from '@/lib/homies/constants';

export const inputCls = 'bg-[#0f0f16] border border-[#2a2a38] rounded-lg px-3 py-2 text-[var(--fg)]';

export function FacePicker({ defaultFace }: { defaultFace?: string }) {
  const [face, setFace] = useState(defaultFace && FACES.includes(defaultFace) ? defaultFace : FACES[0]);
  return (
    <div>
      <p className="text-sm text-[var(--muted)] mb-2">Face</p>
      <input type="hidden" name="face" value={face} />
      <div className="flex flex-wrap gap-2">
        {FACES.map((f) => (
          <button type="button" key={f} onClick={() => setFace(f)} aria-pressed={face === f}
            className={`text-2xl w-11 h-11 rounded-full border ${face === f ? 'border-[var(--accent)]' : 'border-[#2a2a38]'}`}>{f}</button>
        ))}
      </div>
    </div>
  );
}

export function VisibilitySelect({ defaultValue = 'friends' }: { defaultValue?: string }) {
  return (
    <label className="text-sm text-[var(--muted)] flex flex-col gap-2">Who can see it
      <select name="visibility" defaultValue={defaultValue} className={inputCls}>
        {VISIBILITY_OPTIONS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-[#ff5c7c]">{msg}</p> : null;
}
