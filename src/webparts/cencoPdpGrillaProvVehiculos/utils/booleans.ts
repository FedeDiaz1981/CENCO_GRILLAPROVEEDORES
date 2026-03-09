const TRUE_STRINGS: Record<string, true> = {
  "1": true,
  true: true,
  yes: true,
  y: true,
  si: true,
  s: true,
  on: true,
};

const FALSE_STRINGS: Record<string, true> = {
  "0": true,
  false: true,
  no: true,
  n: true,
  off: true,
  "": true,
};

const normalizeBooleanText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

export const normalizeBooleanValue = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return false;
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = normalizeBooleanText(value);
    if (TRUE_STRINGS[normalized]) return true;
    if (FALSE_STRINGS[normalized]) return false;
    return normalized.length > 0;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("value" in record) return normalizeBooleanValue(record.value);
    if ("Value" in record) return normalizeBooleanValue(record.Value);

    if ("results" in record && Array.isArray(record.results) && record.results.length === 1) {
      return normalizeBooleanValue(record.results[0]);
    }
  }

  return Boolean(value);
};
