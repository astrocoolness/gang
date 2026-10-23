import { FRAME_SANDBOX } from '@/lib/mehspace/frame';

/**
 * The ONLY place custom Mehspace HTML is shown: a sandboxed srcdoc iframe with no allow-scripts and
 * no allow-same-origin (opaque origin: no cookies, no access to Clique), plus a strict CSP inside the
 * document (see frameDocument). `doc` must come from frameDocument() over sanitizer output.
 */
export default function MehspaceFrame({ doc, height, title }: { doc: string; height: number; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={doc}
      sandbox={FRAME_SANDBOX}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="w-full rounded-lg border border-[#2a2a38] bg-black/20"
      style={{ height }}
    />
  );
}
