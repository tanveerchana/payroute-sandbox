import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceToken } from '../src/client.js';
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
test('browser workspace token is stable within six days and rotates before storage expiry', () => {
  const storage = memory();
  const original = workspaceToken(storage, 1000000);
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.equal(workspaceToken(storage, 1000000 + 5 * 86400000), original);
  assert.notEqual(workspaceToken(storage, 1000000 + 6 * 86400000), original);
});
test('legacy or malformed browser tokens are replaced with a fresh timestamped token', () => {
  const storage = memory();
  storage.setItem('payroute-token', 'a'.repeat(64));
  assert.notEqual(workspaceToken(storage, 1000000), 'a'.repeat(64));
  assert.equal(storage.getItem('payroute-token-created'), '1000000');
});

import { requestWorkspace } from '../src/client.js';
import { configureAccess, setAccess } from '../src/access/access.js';
import { seedWorkspace } from '../src/domain.js';

test('account workspace requests use scoped cookies without reading or creating a demo token', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let storageReads = 0;
  let request: RequestInit | undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => {
        storageReads++;
        return null;
      },
      setItem: () => {},
    },
  });
  configureAccess('payroute');
  setAccess({
    mode: 'account',
    role: 'editor',
    workspaceId: '00000000-0000-4000-8000-000000000001',
    user: { id: 'user-one', email: 'test@example.com' },
  });
  globalThis.fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ state: seedWorkspace(), revision: 1 }), { status: 200 });
  };
  try {
    await requestWorkspace({ type: 'simulate', amount: '1.00' });
    const headers = new Headers(request?.headers);
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.get('X-Workspace-Mode'), 'account');
    assert.equal(headers.get('X-Workspace-Id'), '00000000-0000-4000-8000-000000000001');
    assert.equal(headers.get('Content-Type'), 'application/json');
    assert.equal(request?.credentials, 'same-origin');
    assert.equal(storageReads, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete (globalThis as any).localStorage;
  }
});

test('demo workspace requests use only the isolated browser bearer capability', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memory();
  let request: RequestInit | undefined;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  configureAccess('payroute');
  setAccess({ mode: 'demo' });
  globalThis.fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ state: seedWorkspace(), revision: 1 }), { status: 200 });
  };
  try {
    await requestWorkspace();
    const headers = new Headers(request?.headers);
    assert.match(headers.get('Authorization') ?? '', /^Bearer [a-f0-9]{64}$/);
    assert.equal(headers.get('X-Workspace-Mode'), 'demo');
    assert.equal(headers.has('X-Workspace-Id'), false);
    assert.equal(request?.credentials, 'same-origin');
    assert.equal(request?.method, 'GET');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete (globalThis as any).localStorage;
    setAccess({ mode: 'account' });
  }
});
