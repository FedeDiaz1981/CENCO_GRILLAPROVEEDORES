export type ViewFilterSnapshot = {
  version: 1;
  listId: string;
  viewId: string;
  capturedAt: string;
  view: {
    title?: string;
    rowLimit?: number;
    viewQuery?: string;
  };
};

type RawSnapshot = {
  version?: unknown;
  listId?: unknown;
  viewId?: unknown;
  capturedAt?: unknown;
  view?: unknown;
};

const asString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function parseViewFilterSnapshot(raw: string | undefined): ViewFilterSnapshot | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as RawSnapshot;
    const version = Number(parsed.version);
    if (version !== 1) return undefined;

    const listId = asString(parsed.listId);
    const viewId = asString(parsed.viewId);
    const capturedAt = asString(parsed.capturedAt);
    if (!listId || !viewId || !capturedAt) return undefined;

    const viewObj = isPlainObject(parsed.view) ? parsed.view : {};

    return {
      version: 1,
      listId,
      viewId,
      capturedAt,
      view: {
        title: asString(viewObj.title),
        rowLimit: typeof viewObj.rowLimit === "number" ? viewObj.rowLimit : undefined,
        viewQuery: asString(viewObj.viewQuery),
      },
    };
  } catch {
    return undefined;
  }
}

export function buildViewFilterSnapshot(input: {
  listId: string;
  viewId: string;
  view?: ViewFilterSnapshot["view"];
  capturedAt?: string;
}): ViewFilterSnapshot {
  return {
    version: 1,
    listId: String(input.listId),
    viewId: String(input.viewId),
    capturedAt: input.capturedAt || new Date().toISOString(),
    view: {
      title: asString(input.view?.title),
      rowLimit: typeof input.view?.rowLimit === "number" ? input.view.rowLimit : undefined,
      viewQuery: asString(input.view?.viewQuery),
    },
  };
}

export function stringifyViewFilterSnapshot(snapshot: ViewFilterSnapshot): string {
  return JSON.stringify(snapshot);
}
