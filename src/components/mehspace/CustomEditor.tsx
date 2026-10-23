'use client';

import { useActionState, useState, useTransition } from 'react';
import { previewAction, saveCustomAction, type MehState } from '@/app/mehspace/actions';
import { TEMPLATES } from '@/lib/mehspace/themes';
import { inputCls } from '@/components/homies/fields';
import MehspaceFrame from './MehspaceFrame';
import Status from './Status';

export default function CustomEditor({ spaceId, html: initialHtml, css: initialCss, theme, height }: {
  spaceId: string; html: string; css: string; theme: string; height: number;
}) {
  const [state, action, pending] = useActionState<MehState, FormData>(saveCustomAction, { status: 'idle' });
  const [html, setHtml] = useState(initialHtml);
  const [css, setCss] = useState(initialCss);
  const [preview, setPreview] = useState<{ doc: string; error?: string } | null>(null);
  const [previewing, start] = useTransition();

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if ((html || css) && !window.confirm('Replace your current HTML and CSS with this template?')) return;
    setHtml(t.html);
    setCss(t.css);
    setPreview(null);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={spaceId} />
      <label className="text-sm text-[var(--muted)] flex items-center gap-2">Start from a template
        <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ''; }} className={inputCls}>
          <option value="" disabled>Choose…</option>
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">HTML
        <textarea name="custom_html" value={html} onChange={(e) => setHtml(e.target.value)} rows={12} spellCheck={false} maxLength={100000}
          className={`${inputCls} font-mono text-xs`} />
      </label>
      <label className="text-sm text-[var(--muted)] flex flex-col gap-2">CSS
        <textarea name="custom_css" value={css} onChange={(e) => setCss(e.target.value)} rows={10} spellCheck={false} maxLength={50000}
          className={`${inputCls} font-mono text-xs`} />
      </label>
      <p className="text-xs text-[var(--muted)]">
        No scripts, event handlers or forms. Links and images must be https. Your CSS only styles your box. It shows in a sandboxed frame.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={previewing} onClick={() => start(async () => setPreview(await previewAction(html, css, theme)))}
          className="rounded-lg border border-[#2a2a38] px-4 py-2 hover:border-[var(--accent)]">{previewing ? 'Sanitizing…' : 'Preview'}</button>
        <button disabled={pending} className="rounded-lg bg-[var(--accent)] text-black px-4 py-2 font-medium">{pending ? 'Publishing…' : 'Save & publish'}</button>
      </div>
      <Status state={state} />
      {preview?.error && <p className="text-sm text-[#ff5c7c]" role="alert">{preview.error}</p>}
      {preview?.doc && <MehspaceFrame doc={preview.doc} height={height} title="Preview of your custom section" />}
    </form>
  );
}
