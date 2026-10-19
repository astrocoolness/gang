'use client';

import { GANG_V1_KEY } from '@/lib/clique/device-import';

/** Downloads this browser's gang:v1 data so it can be imported on rva.guru/clique after sign-in. */
export default function ExportDeviceData() {
  function download() {
    const raw = window.localStorage.getItem(GANG_V1_KEY) ?? '{"homies":[],"spaces":[]}';
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clique-device-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button type="button" onClick={download} className="text-sm text-[var(--muted)] underline self-start">
      Export my data
    </button>
  );
}
