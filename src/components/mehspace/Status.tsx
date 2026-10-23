import type { MehState } from '@/app/mehspace/actions';

export default function Status({ state }: { state: MehState }) {
  if (!state.message) return null;
  return <p role={state.status === 'error' ? 'alert' : 'status'} className={`text-sm ${state.status === 'error' ? 'text-[#ff5c7c]' : 'text-[var(--accent)]'}`}>{state.message}</p>;
}
