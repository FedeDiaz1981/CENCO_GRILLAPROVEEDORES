import type { EditField } from "../services/IVehiculosService";

export type ViewColumnConfigEntry = {
  internalName: string;
  title: string;
  type?: string;
  visible: boolean;
  editable?: boolean;
  order: number;
};

export type ViewColumnConfig = {
  version: 3;
  listId: string;
  viewId?: string;
  capturedAt: string;
  fields: ViewColumnConfigEntry[];
  columns: ViewColumnConfigEntry[];
};

type RawConfig = {
  version?: unknown;
  listId?: unknown;
  viewId?: unknown;
  capturedAt?: unknown;
  fields?: unknown;
  columns?: unknown;
};

const asString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeViewColumnConfigEntries(entries: unknown): ViewColumnConfigEntry[] {
  if (!Array.isArray(entries)) return [];

  const out: ViewColumnConfigEntry[] = [];

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) return;

    const internalName = asString(entry.internalName);
    const title = asString(entry.title) ?? internalName;
    if (!internalName || !title) return;

    out.push({
      internalName,
      title,
      type: asString(entry.type),
      visible: entry.visible !== false,
      editable: entry.editable !== false,
      order: typeof entry.order === "number" && Number.isFinite(entry.order) ? entry.order : index,
    });
  });

  return out.sort((a, b) => a.order - b.order);
}

export function parseViewColumnConfig(raw: string | undefined): ViewColumnConfig | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as RawConfig;
    const version = Number(parsed.version);
    if (version !== 1 && version !== 2 && version !== 3) return undefined;

    const listId = asString(parsed.listId);
    const capturedAt = asString(parsed.capturedAt);
    const viewId = asString(parsed.viewId);
    if (!listId || !capturedAt) return undefined;
    if (version === 1 && !viewId) return undefined;

    const fields = normalizeViewColumnConfigEntries(parsed.fields);
    const columns = normalizeViewColumnConfigEntries(parsed.columns);
    const effectiveColumns = columns.length ? columns : fields;

    return {
      version: 3,
      listId,
      viewId,
      capturedAt,
      fields: fields.length ? fields : effectiveColumns,
      columns: effectiveColumns,
    };
  } catch {
    return undefined;
  }
}

export function buildViewColumnConfig(input: {
  listId: string;
  viewId?: string;
    columns: Array<Partial<ViewColumnConfigEntry> & Pick<ViewColumnConfigEntry, "internalName" | "title">>;
  capturedAt?: string;
}): ViewColumnConfig {
  const fields = normalizeViewColumnConfigEntries(
    input.columns.map((col, index) => ({
      internalName: col.internalName,
      title: col.title,
      type: col.type,
      visible: col.visible !== false,
      editable: col.editable !== false,
      order: typeof col.order === "number" && Number.isFinite(col.order) ? col.order : index,
    }))
  );
  const columns = fields.filter((col) => col.visible);

  return {
    version: 3,
    listId: String(input.listId),
    viewId: asString(input.viewId),
    capturedAt: input.capturedAt || new Date().toISOString(),
    fields,
    columns,
  };
}

export function stringifyViewColumnConfig(config: ViewColumnConfig): string {
  return JSON.stringify(config);
}

export function configToFields(config: ViewColumnConfig | undefined): EditField[] {
  if (!config) return [];

  return (config.fields?.length ? config.fields : config.columns)
    .filter((col) => col.visible)
    .map((col) => ({
      internalName: col.internalName,
      title: col.title,
      type: col.type || "Text",
      required: false,
      readOnly: col.editable === false,
    }));
}
