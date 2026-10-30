import type { Workspace, Payment } from './domain';
export type Envelope = {
  state: Workspace;
  revision: number;
  result?: { payment?: Payment; replayed?: boolean };
};
export function workspaceToken(
  _storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  _now = Date.now(),
): string {
  const existing = _storage.getItem('payroute-token');
  const created = Number(_storage.getItem('payroute-token-created'));
  if (
    existing &&
    /^[a-f0-9]{64}$/.test(existing) &&
    created > 0 &&
    _now >= created &&
    _now - created < 6 * 86400000
  )
    return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  _storage.setItem('payroute-token', token);
  _storage.setItem('payroute-token-created', String(_now));
  return token;
}
export async function requestWorkspace(command?: Record<string, unknown>): Promise<Envelope> {
  const response = await fetch('/api/workspace', {
    method: command ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${workspaceToken()}`,
      ...(command ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(command ? { body: JSON.stringify({ command }) } : {}),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Workspace API is unavailable. Check deployment and database configuration.');
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || 'Workspace request failed. Please retry.',
    );
  if (!data.state || !Array.isArray(data.state.transactions))
    throw new Error('Invalid workspace response. Please reload.');
  return data;
}
export function download(name: string, data: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
