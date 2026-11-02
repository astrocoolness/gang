'use client';
import { useState } from 'react';

export default function LinkControls({linked}:{linked:boolean}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  async function act(path:string) {
    setError(''); setBusy(true);
    try {
      const res=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin'});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Action failed');
      if(typeof data.linkUrl==='string' && data.linkUrl.startsWith('https://')) {
        window.location.assign(data.linkUrl);
        return;
      }
      if(path.endsWith('/revoke') && data.status==='revoked') { setDone(true); return; }
      throw new Error('Unexpected response');
    } catch(e) { setError(e instanceof Error?e.message:'Request failed'); }
    finally { setBusy(false); }
  }
  return <section className="gang-card flex flex-col gap-4">
    <h2 className="text-xl font-semibold">HOMIES account connection</h2>
    <p className="text-sm text-[var(--muted)]">{done?'The account link was revoked.':linked?'Your HOMIES account is linked.':'You can link one signed-in HOMIES account, with your explicit confirmation.'}</p>
    <p className="text-xs text-[var(--muted)]">Connecting identities does not publish your characters, photos, messages or activity.</p>
    {linked&&!done?<button type="button" disabled={busy} onClick={()=>act('/clique/api/apps/homies/link/revoke')} className="rounded-lg border border-[#444] px-4 py-3 disabled:opacity-40">Revoke connection</button>:
      <button type="button" disabled={busy} onClick={()=>act('/clique/api/apps/homies/link/start')} className="rounded-lg bg-[var(--accent)] px-4 py-3 disabled:opacity-40">Link HOMIES account</button>}
    {error&&<p role="alert" className="text-red-400">{error}</p>}
  </section>;
}
