import type { EditField } from "../services/IVehiculosService";

export type SnapshotColumn = {
  key: string;
  name: string;
  fieldName?: string;
  minWidth?: number;
  isResizable?: boolean;
};

export type SnapshotField = EditField & {
  order: number;
  inView: boolean;
};

export type ViewSnapshot = {
  version: 2;
  listId: string;
  viewId: string;
  toggleField?: string;
  capturedAt: string;
  view: {
    title?: string;
    rowLimit?: number;
    viewQuery?: string;
    htmlSchemaXml?: string;
    fieldNames: string[];
  };
  columns: SnapshotColumn[];
  fields: SnapshotField[];
  items: Array<Record<string, unknown>>;
};

type RawSnapshotV1 = {
  version: 1;
  listId?: unknown;
  viewId?: unknown;
  toggleField?: unknown;
  capturedAt?: unknown;
  columns?: unknown;
  items?: unknown;
};

type RawSnapshotV2 = {
  version: 2;
  listId?: unknown;
  viewId?: unknown;
  toggleField?: unknown;
  capturedAt?: unknown;
  view?: unknown;
  columns?: unknown;
  fields?: unknown;
  items?: unknown;
};

const asString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeKey = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isMeaningfulValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const getRowValueByCandidates = (
  row: Record<string, unknown>,
  candidates: Array<unknown>
): unknown => {
  const normalizedIndex = new Map<string, string>();

  for (const key of Object.keys(row)) {
    const norm = normalizeKey(key);
    if (norm && !normalizedIndex.has(norm)) normalizedIndex.set(norm, key);
  }

  for (const candidate of candidates) {
    const key = String(candidate ?? "").trim();
    if (!key) continue;

    if (Object.prototype.hasOwnProperty.call(row, key) && isMeaningfulValue(row[key])) {
      return row[key];
    }

    const normalized = normalizeKey(key);
    const actualKey = normalizedIndex.get(normalized);
    if (actualKey && isMeaningfulValue(row[actualKey])) {
      return row[actualKey];
    }
  }

  return undefined;
};

export function normalizeSnapshotItems(
  items: unknown,
  fields: SnapshotField[]
): Array<Record<string, unknown>> {
  if (!Array.isArray(items)) return [];
  if (!Array.isArray(fields) || !fields.length) {
    return items
      .filter((item): item is Record<string, unknown> => isPlainObject(item))
      .map((item) => ({ ...item }));
  }

  return items
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item) => {
      const row = { ...item };

      for (const field of fields) {
        const internalName = asString(field.internalName);
        if (!internalName) continue;

        const currentValue = row[internalName];
        if (isMeaningfulValue(currentValue)) continue;

        const resolved = getRowValueByCandidates(row, [
          field.internalName,
          field.title,
          field.internalName?.toString().replace(/\s+/g, ""),
          field.title?.toString().replace(/\s+/g, ""),
        ]);

        if (resolved !== undefined) {
          row[internalName] = resolved;
        }
      }

      return row;
    });
}

export function normalizeSnapshotColumns(columns: unknown): SnapshotColumn[] {
  if (!Array.isArray(columns)) return [];

  const out: SnapshotColumn[] = [];

  for (const col of columns) {
    if (!isPlainObject(col)) continue;

    const key = asString(col.key);
    const name = asString(col.name) ?? key;
    if (!key || !name) continue;

    const snapshotCol: SnapshotColumn = {
      key,
      name,
    };

    const fieldName = asString(col.fieldName);
    if (fieldName) snapshotCol.fieldName = fieldName;

    if (typeof col.minWidth === "number") snapshotCol.minWidth = col.minWidth;
    if (typeof col.isResizable === "boolean") snapshotCol.isResizable = col.isResizable;

    out.push(snapshotCol);
  }

  return out;
}

export function normalizeSnapshotFields(fields: unknown): SnapshotField[] {
  if (!Array.isArray(fields)) return [];

  const out: SnapshotField[] = [];

  for (const field of fields) {
    if (!isPlainObject(field)) continue;

    const internalName = asString(field.internalName);
    const title = asString(field.title) ?? internalName;
    const type = asString(field.type);
    if (!internalName || !title || !type) continue;

    const order =
      typeof field.order === "number" && Number.isFinite(field.order) ? field.order : out.length;

    out.push({
      internalName,
      title,
      type,
      required: Boolean(field.required),
      readOnly: Boolean(field.readOnly),
      allowMultiple: typeof field.allowMultiple === "boolean" ? field.allowMultiple : undefined,
      lookupListId: asString(field.lookupListId),
      choices: Array.isArray(field.choices)
        ? field.choices.map((x) => String(x)).filter((x) => x.length > 0)
        : undefined,
      order,
      inView: Boolean(field.inView),
    });
  }

  return out.sort((a, b) => a.order - b.order);
}

const columnsFromFields = (fields: SnapshotField[]): SnapshotColumn[] =>
  fields.map((f) => ({
    key: f.internalName,
    name: f.title,
    fieldName: f.internalName,
  }));

export function parseViewSnapshot(raw: string | undefined): ViewSnapshot | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as RawSnapshotV1 | RawSnapshotV2;
    const listId = asString(parsed.listId);
    const viewId = asString(parsed.viewId);
    const capturedAt = asString(parsed.capturedAt);
    if (!listId || !viewId || !capturedAt) return undefined;

    if (parsed.version === 2) {
      const viewObj = isPlainObject(parsed.view) ? parsed.view : {};
      const fieldNames = Array.isArray(viewObj.fieldNames)
        ? viewObj.fieldNames.map((x) => String(x)).filter((x) => x.length > 0)
        : [];
      const fields = normalizeSnapshotFields(parsed.fields);
      const columns = normalizeSnapshotColumns(parsed.columns);
      const items = normalizeSnapshotItems(parsed.items, fields);

      return {
        version: 2,
        listId,
        viewId,
        toggleField: asString(parsed.toggleField),
        capturedAt,
        view: {
          title: asString(viewObj.title),
          rowLimit: typeof viewObj.rowLimit === "number" ? viewObj.rowLimit : undefined,
          viewQuery: asString(viewObj.viewQuery),
          htmlSchemaXml: asString(viewObj.htmlSchemaXml),
          fieldNames,
        },
        columns: columns.length ? columns : columnsFromFields(fields),
        fields,
        items,
      };
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item): item is Record<string, unknown> => isPlainObject(item))
          .map((item) => ({ ...item }))
      : [];

    return {
      version: 2,
      listId,
      viewId,
      toggleField: asString(parsed.toggleField),
      capturedAt,
      view: {
        fieldNames: [],
      },
      columns: normalizeSnapshotColumns(parsed.columns),
      fields: [],
      items,
    };
  } catch {
    return undefined;
  }
}

export function buildViewSnapshot(input: {
  listId: string;
  viewId: string;
  toggleField?: string;
  view?: ViewSnapshot["view"];
  columns?: SnapshotColumn[];
  fields?: SnapshotField[];
  items: Array<Record<string, unknown>>;
  capturedAt?: string;
}): ViewSnapshot {
  const columns = normalizeSnapshotColumns(input.columns);
  const fields = normalizeSnapshotFields(input.fields);
  const derivedColumns = columns.length ? columns : columnsFromFields(fields);
  const items = normalizeSnapshotItems(input.items, fields);

  return {
    version: 2,
    listId: String(input.listId),
    viewId: String(input.viewId),
    toggleField: asString(input.toggleField),
    capturedAt: input.capturedAt || new Date().toISOString(),
    view: {
      title: asString(input.view?.title),
      rowLimit: typeof input.view?.rowLimit === "number" ? input.view.rowLimit : undefined,
      viewQuery: asString(input.view?.viewQuery),
      htmlSchemaXml: asString(input.view?.htmlSchemaXml),
      fieldNames: Array.isArray(input.view?.fieldNames)
        ? (input.view?.fieldNames || []).map((x) => String(x)).filter((x) => x.length > 0)
        : [],
    },
    columns: derivedColumns,
    fields,
    items,
  };
}

export function stringifyViewSnapshot(snapshot: ViewSnapshot): string {
  return JSON.stringify(snapshot);
}
