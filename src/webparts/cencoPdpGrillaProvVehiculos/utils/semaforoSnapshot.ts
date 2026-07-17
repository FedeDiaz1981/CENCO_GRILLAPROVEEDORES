import type { SemaforoConfig } from "../services/IVehiculosService";

export type SemaforoSnapshot = {
  version: 1;
  listTitle: string;
  keyField: string;
  capturedAt: string;
  rules: SemaforoConfig;
};

type RawSnapshot = {
  version?: unknown;
  listTitle?: unknown;
  keyField?: unknown;
  capturedAt?: unknown;
  rules?: unknown;
};

const asString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
};

const asRules = (value: unknown): SemaforoConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: SemaforoConfig = {};
  for (const rawKey of Object.keys(value as Record<string, unknown>)) {
    const rawVal = (value as Record<string, unknown>)[rawKey];
    const key = asString(rawKey);
    if (!key || !rawVal || typeof rawVal !== "object") continue;
    const rule = rawVal as Record<string, unknown>;
    const dateField = asString(rule.dateField);
    const warnDays = Number(rule.warnDays);
    if (dateField) out[key.toLowerCase()] = { dateField, warnDays: Number.isFinite(warnDays) ? warnDays : 0 };
  }
  return out;
};

export function parseSemaforoSnapshot(raw: string | undefined): SemaforoSnapshot | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as RawSnapshot;
    if (Number(parsed.version) !== 1) return undefined;

    const listTitle = asString(parsed.listTitle);
    const keyField = asString(parsed.keyField);
    const capturedAt = asString(parsed.capturedAt);
    if (!listTitle || !keyField || !capturedAt) return undefined;

    return {
      version: 1,
      listTitle,
      keyField,
      capturedAt,
      rules: asRules(parsed.rules),
    };
  } catch {
    return undefined;
  }
}

export function buildSemaforoSnapshot(input: {
  listTitle: string;
  keyField: string;
  rules: SemaforoConfig;
  capturedAt?: string;
}): SemaforoSnapshot {
  return {
    version: 1,
    listTitle: String(input.listTitle),
    keyField: String(input.keyField),
    capturedAt: input.capturedAt || new Date().toISOString(),
    rules: input.rules || {},
  };
}

export function stringifySemaforoSnapshot(snapshot: SemaforoSnapshot): string {
  return JSON.stringify(snapshot);
}
