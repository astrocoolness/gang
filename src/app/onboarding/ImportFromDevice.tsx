'use client';

import { useState, useTransition } from 'react';
import { GANG_V1_KEY, parseGangV1, planGangV1Import, summarizePlan } from '@/lib/clique/device-import';
import { importGangV1 } from '@/lib/clique/device-import-action';

/** Reads gang:v1 from this browser (or an exported JSON file) and imports it into the account. */
export default function ImportFromDevice() {
  const [json, setJson] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [pending, start] = useTransition();

  function preview(raw: string | null, source: string) {
    setResult('');
    if (!raw) return setSummary(`No ${GANG_V1_KEY} data found ${source}.`);
    try {
      const s = summarizePlan(planGangV1Import(parseGangV1(raw)));
      setJson(raw);
      setSummary(`Found ${s.homies} Homies, ${s.spaces} Mehspaces and ${s.posts} posts ${source}.`);
    } catch {
      setJson(null);
      setSummary('That file is not a gang:v1 export.');
    }
  }

  return (
    <section className="gang-card flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Import from this device</h2>
      <p className="text-sm text-[var(--muted)]">
        Bring over Homies you made before accounts existed. Data saved on another site address won&apos;t show up here;
        use &quot;Export my data&quot; on the old site, then upload the file.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-[#2a2a38] px-3 py-1.5 text-sm"
          onClick={() => preview(window.localStorage.getItem(GANG_V1_KEY), 'in this browser')}>
          Check this browser
        </button>
        <label className="rounded-lg border border-[#2a2a38] px-3 py-1.5 text-sm cursor-pointer">
          Upload export file
          <input type="file" accept="application/json,.json" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) preview(await f.text(), 'in that file'); }} />
        </label>
      </div>
      {summary && <p className="text-sm">{summary}</p>}
      {json && (
        <button type="button" disabled={pending} className="rounded-lg bg-[var(--accent)] py-2 text-sm disabled:opacity-60"
          onClick={() => start(async () => setResult((await importGangV1(json)).message))}>
          {pending ? 'Importing…' : 'Import into my account'}
        </button>
      )}
      {result && <p className="text-sm text-green-400">{result}</p>}
    </section>
  );
}
