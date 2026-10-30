export const currencies = ['AUD', 'USD', 'CAD', 'EUR'] as const;
export type Currency = (typeof currencies)[number];
export type ProviderId = 'atlas' | 'pulse' | 'harbor';
export type Scenario = 'success' | 'primary_outage' | 'hard_decline' | 'all_down';
export type Provider = {
  id: ProviderId;
  name: string;
  enabled: boolean;
  outage: boolean;
  feeBps: number;
  fixedFeeMinor: number;
  latencyMs: number;
};
export type Attempt = {
  providerId: ProviderId;
  outcome: 'approved' | 'unavailable' | 'declined';
  latencyMs: number;
  reason: string;
};
export type Payment = {
  id: string;
  key: string;
  fingerprint: string;
  amountMinor: number;
  currency: Currency;
  scenario: Scenario;
  reference: string;
  status: 'succeeded' | 'declined' | 'failed';
  attempts: Attempt[];
  feeMinor: number;
  latencyMs: number;
  providerId?: ProviderId;
  createdAt: string;
};
export type Issue = {
  type: 'missing' | 'amount_mismatch' | 'currency_mismatch' | 'duplicate' | 'unexpected';
  transactionId: string;
  expected?: number;
  actual?: number;
  detail: string;
};
export type Reconciliation = {
  issues: Issue[];
  matched: number;
  totalRows: number;
  paymentCount: number;
  statement: string;
};
export type Workspace = {
  version: 1;
  providers: Provider[];
  transactions: Payment[];
  reconciliation: Reconciliation | null;
};
export type ReduceResult = { state: Workspace; result?: { payment?: Payment; replayed?: boolean } };
const initialProviders = (): Provider[] => [
  {
    id: 'atlas',
    name: 'Atlas',
    enabled: true,
    outage: false,
    feeBps: 170,
    fixedFeeMinor: 30,
    latencyMs: 142,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    enabled: true,
    outage: false,
    feeBps: 190,
    fixedFeeMinor: 25,
    latencyMs: 186,
  },
  {
    id: 'harbor',
    name: 'Harbor',
    enabled: true,
    outage: false,
    feeBps: 210,
    fixedFeeMinor: 20,
    latencyMs: 224,
  },
];
export function parseAmount(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a decimal amount with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 1 || minor > 100000000)
    throw new Error('Amount must be between 0.01 and 1,000,000.00.');
  return minor;
}
const isCurrency = (v: unknown): v is Currency => currencies.includes(v as Currency);
const scenarios: Scenario[] = ['success', 'primary_outage', 'hard_decline', 'all_down'];
export function reduceWorkspace(state: Workspace, command: any): ReduceResult {
  if (!command || typeof command !== 'object') throw new Error('A command is required.');
  if (command.type === 'simulate') {
    const amountMinor = parseAmount(command.amount);
    if (!isCurrency(command.currency)) throw new Error('Choose AUD, USD, CAD or EUR.');
    if (!scenarios.includes(command.scenario)) throw new Error('Unknown sandbox scenario.');
    if (typeof command.key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(command.key))
      throw new Error(
        'Idempotency key must contain 8–128 letters, numbers, underscores or hyphens.',
      );
    if (
      typeof command.reference !== 'string' ||
      command.reference.length > 80 ||
      /[\r\n\u0000-\u001f]/.test(command.reference)
    )
      throw new Error('Reference must be up to 80 printable characters.');
    const fingerprint = JSON.stringify([
      amountMinor,
      command.currency,
      command.scenario,
      command.reference,
    ]);
    const existing = state.transactions.find((p) => p.key === command.key);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new Error('Idempotency conflict: this key belongs to a different request.');
      return { state, result: { payment: existing, replayed: true } };
    }
    if (state.transactions.length >= 200)
      throw new Error('Workspace limit of 200 payments reached. Reset the sandbox to continue.');
    const index = state.transactions.length;
    const available = state.providers.filter((p) => p.enabled);
    const attempts: Attempt[] = [];
    let status: Payment['status'] = 'failed';
    let providerId: ProviderId | undefined;
    let feeMinor = 0;
    for (const [position, provider] of available.entries()) {
      const down =
        provider.outage ||
        command.scenario === 'all_down' ||
        (command.scenario === 'primary_outage' && position === 0);
      const outcome: Attempt['outcome'] = down
        ? 'unavailable'
        : command.scenario === 'hard_decline'
          ? 'declined'
          : 'approved';
      const latencyMs = down ? 800 + (index % 5) * 19 : provider.latencyMs + (index % 7) * 11;
      attempts.push({
        providerId: provider.id,
        outcome,
        latencyMs,
        reason: down
          ? 'Simulated provider timeout. Safe to try the next route.'
          : outcome === 'declined'
            ? 'Simulated hard decline. Terminal response; no retry permitted.'
            : 'Simulated authorization approved.',
      });
      if (outcome === 'declined') {
        status = 'declined';
        break;
      }
      if (outcome === 'approved') {
        status = 'succeeded';
        providerId = provider.id;
        feeMinor = Math.round((amountMinor * provider.feeBps) / 10000) + provider.fixedFeeMinor;
        break;
      }
    }
    const payment: Payment = {
      id: `pay_${String(index + 1).padStart(6, '0')}`,
      key: command.key,
      fingerprint,
      amountMinor,
      currency: command.currency,
      scenario: command.scenario,
      reference: command.reference,
      status,
      attempts,
      feeMinor,
      latencyMs: attempts.reduce((n, a) => n + a.latencyMs, 0),
      providerId,
      createdAt: new Date(Date.UTC(2026, 9, 30, 8, 0) + index * 180000).toISOString(),
    };
    return {
      state: { ...state, transactions: [...state.transactions, payment], reconciliation: null },
      result: { payment, replayed: false },
    };
  }
  if (command.type === 'provider') {
    if (
      !state.providers.some((p) => p.id === command.id) ||
      typeof command.enabled !== 'boolean' ||
      typeof command.outage !== 'boolean'
    )
      throw new Error('Invalid provider configuration.');
    return {
      state: {
        ...state,
        providers: state.providers.map((p) =>
          p.id === command.id ? { ...p, enabled: command.enabled, outage: command.outage } : p,
        ),
      },
    };
  }
  if (command.type === 'route') {
    if (
      !Array.isArray(command.order) ||
      command.order.length !== 3 ||
      new Set(command.order).size !== 3 ||
      !command.order.every((id: unknown) => state.providers.some((p) => p.id === id))
    )
      throw new Error('Route must include each provider exactly once.');
    return {
      state: {
        ...state,
        providers: command.order.map((id: ProviderId) => state.providers.find((p) => p.id === id)!),
      },
    };
  }
  if (command.type === 'reconcile') {
    const csv = command.demo === true ? demoStatement(state.transactions) : command.csv;
    return { state: { ...state, reconciliation: reconcile(state.transactions, csv) } };
  }
  if (command.type === 'reset') return { state: seedWorkspace() };
  throw new Error('Unknown sandbox command.');
}
export function seedWorkspace(): Workspace {
  let state: Workspace = {
    version: 1,
    providers: initialProviders(),
    transactions: [],
    reconciliation: null,
  };
  const amounts = [
    '129.00',
    '249.50',
    '79.95',
    '1200.00',
    '39.00',
    '569.00',
    '24.99',
    '890.00',
    '189.00',
    '69.00',
    '345.00',
    '1499.00',
  ];
  for (let i = 0; i < 36; i++) {
    const scenario: Scenario =
      i === 7 || i === 23
        ? 'hard_decline'
        : i === 16
          ? 'all_down'
          : i % 6 === 3
            ? 'primary_outage'
            : 'success';
    state = reduceWorkspace(state, {
      type: 'simulate',
      amount: amounts[i % amounts.length],
      currency: i % 8 === 4 ? 'USD' : i % 13 === 5 ? 'EUR' : 'AUD',
      scenario,
      key: `seed_payment_${String(i + 1).padStart(4, '0')}`,
      reference: `Order #${1041 + i}`,
    }).state;
  }
  return state;
}
function parseCsv(csv: unknown): string[][] {
  if (typeof csv !== 'string' || csv.length > 30000)
    throw new Error('Statement must be CSV text under 30 KB.');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const pushField = () => {
    row.push(field.trim());
    field = '';
    closed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((v) => v !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === '"') {
      if (field !== '' || closed) throw new Error('Malformed CSV quoting.');
      quoted = true;
    } else if (c === ',') pushField();
    else if (c === '\n') pushRow();
    else if (c === '\r') {
      if (csv[i + 1] === '\n') i++;
      pushRow();
    } else {
      if (closed && c.trim() !== '') throw new Error('Malformed CSV quoting.');
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (field !== '' || row.length) pushRow();
  if (rows.length > 501) throw new Error('Statements are limited to 500 records.');
  return rows;
}
export function reconcile(transactions: Payment[], csv: unknown): Reconciliation {
  const rows = parseCsv(csv);
  const header = rows.shift();
  if (!header || header.join(',') !== 'transaction_id,amount_minor,currency')
    throw new Error('CSV header must be transaction_id,amount_minor,currency.');
  const records = rows.map((row, i) => {
    if (row.length !== 3 || !row[0] || !/^\d{1,10}$/.test(row[1]) || !isCurrency(row[2]))
      throw new Error(
        `Invalid statement record on row ${i + 2}. Use integer minor units and a supported currency.`,
      );
    return { id: row[0], amountMinor: Number(row[1]), currency: row[2] };
  });
  const successful = transactions.filter((p) => p.status === 'succeeded');
  const issues: Issue[] = [];
  let matched = 0;
  const byId = new Map<string, typeof records>();
  for (const row of records) {
    const group = byId.get(row.id) || [];
    group.push(row);
    byId.set(row.id, group);
  }
  for (const [id, group] of byId) {
    if (group.length > 1)
      issues.push({
        type: 'duplicate',
        transactionId: id,
        detail: `${group.length} settlement records share this transaction ID.`,
      });
    if (!successful.some((p) => p.id === id))
      issues.push({
        type: 'unexpected',
        transactionId: id,
        detail: 'No successful sandbox payment matches this statement record.',
      });
  }
  for (const payment of successful) {
    const group = byId.get(payment.id);
    if (!group) {
      issues.push({
        type: 'missing',
        transactionId: payment.id,
        expected: payment.amountMinor,
        detail: 'Successful payment is absent from the statement.',
      });
      continue;
    }
    const amountMismatch = group.find((row) => row.amountMinor !== payment.amountMinor);
    const currencyMismatch = group.find((row) => row.currency !== payment.currency);
    if (amountMismatch)
      issues.push({
        type: 'amount_mismatch',
        transactionId: payment.id,
        expected: payment.amountMinor,
        actual: amountMismatch.amountMinor,
        detail: `Expected ${payment.amountMinor} minor units; statement contains ${amountMismatch.amountMinor}.`,
      });
    if (currencyMismatch)
      issues.push({
        type: 'currency_mismatch',
        transactionId: payment.id,
        detail: `Expected ${payment.currency}; statement contains ${currencyMismatch.currency}.`,
      });
    if (!amountMismatch && !currencyMismatch && group.length === 1) matched++;
  }
  return {
    issues,
    matched,
    totalRows: records.length,
    paymentCount: transactions.length,
    statement: csv as string,
  };
}
export function demoStatement(transactions: Payment[]): string {
  const success = transactions.filter((p) => p.status === 'succeeded');
  const rows = success
    .slice(1)
    .map((p, i) => `${p.id},${p.amountMinor + (i === 0 ? 100 : 0)},${p.currency}`);
  if (rows.length > 1) rows.push(rows[1]);
  return `transaction_id,amount_minor,currency\n${rows.join('\n')}`;
}
const csvCell = (value: unknown): string => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
};
export function exportCsv(transactions: Payment[]): string {
  return [
    'transaction_id,amount_minor,currency,status,provider,fee_minor,latency_ms,reference,idempotency_key,synthetic_created_at',
    ...transactions.map((p) =>
      [
        p.id,
        p.amountMinor,
        p.currency,
        p.status,
        p.providerId ?? '',
        p.feeMinor,
        p.latencyMs,
        p.reference,
        p.key,
        p.createdAt,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');
}
export const formatMoney = (amountMinor: number, currency: Currency): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amountMinor / 100);
