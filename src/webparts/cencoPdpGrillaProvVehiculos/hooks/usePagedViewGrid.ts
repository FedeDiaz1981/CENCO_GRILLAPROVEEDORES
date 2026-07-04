import * as React from "react";
import { IColumn } from "@fluentui/react";

export type PagedResult<TItem> = {
  columns: IColumn[];
  items: TItem[];
  nextToken?: string;
};

export type GetViewGridPaged<TItem> = (
  viewId: string,
  pageSize: number,
  pagingToken?: string,
  toggleField?: string
) => Promise<PagedResult<TItem>>;

export type Options = {
  viewId?: string;
  toggleField?: string;
  fetchBatch?: number;        // default 30
  uiPageSize?: number;        // default 10
  prefetchThreshold?: number; // default 10
  timeoutMs?: number;         // default 25000
  debug?: boolean;            // default false
  enabled?: boolean;          // default true
};

type DebugState = {
  lastOp?: "init" | "more";
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastMs?: number;
  lastToken?: string;
  lastNextToken?: string;
  lastReceived?: number;
  lastBuffer?: number;
  lastError?: string;
};

function nowMs(): number {
  return Date.now();
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function usePagedViewGrid<TItem = Record<string, unknown>>(
  getPaged: GetViewGridPaged<TItem>,
  opts: Options
): {
  columns: IColumn[] | undefined;
  buffer: TItem[];
  pageItems: TItem[];
  nextToken: string | undefined;
  loading: boolean;
  loadingMore: boolean;
  pageIndex: number;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  uiPageSize: number;
  totalLoaded: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  ensureForPage: (targetPageIndex: number) => Promise<void>;
  goPrev: () => void;
  goNext: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  debug: DebugState;
  error: string | undefined;
} {
  const {
    viewId,
    toggleField,
    fetchBatch = 30,
    uiPageSize = 10,
    prefetchThreshold = 10,
    timeoutMs = 25000,
    debug: debugOn = false,
    enabled = true,
  } = opts;

  const [columns, setColumns] = React.useState<IColumn[] | undefined>(undefined);
  const [buffer, setBuffer] = React.useState<TItem[]>([]);
  const [nextToken, setNextToken] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const [pageIndex, setPageIndex] = React.useState<number>(0);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [debug, setDebug] = React.useState<DebugState>({});

  const bufferRef = React.useRef<TItem[]>([]);
  const nextTokenRef = React.useRef<string | undefined>(undefined);
  const inflightRef = React.useRef<Promise<void> | null>(null);
  const reqSeq = React.useRef<number>(0);

  // ✅ mantener getPaged sin gatillar effects por identidad
  const getPagedRef = React.useRef(getPaged);
  React.useEffect(() => {
    getPagedRef.current = getPaged;
  }, [getPaged]);

  React.useEffect(() => { bufferRef.current = buffer; }, [buffer]);
  React.useEffect(() => { nextTokenRef.current = nextToken; }, [nextToken]);

  const dlog = React.useCallback((...args: unknown[]) => {
    if (debugOn) console.log("[usePagedViewGrid]", ...args);
  }, [debugOn]);

  const reset = React.useCallback((): void => {
    reqSeq.current += 1;
    inflightRef.current = null;

    setColumns(undefined);
    setBuffer([]);
    setNextToken(undefined);
    setLoading(false);
    setLoadingMore(false);
    setPageIndex(0);
    setError(undefined);

    bufferRef.current = [];
    nextTokenRef.current = undefined;

    setDebug({});
    dlog("RESET");
  }, [dlog]);

  const guardDisabled = React.useCallback((): boolean => !enabled, [enabled]);

  const fetchBatchFn = React.useCallback(
    (initial: boolean): Promise<void> => {
      if (guardDisabled()) {
        dlog("FETCH skipped: disabled");
        return Promise.resolve();
      }

      if (!viewId) {
        dlog("FETCH skipped: no viewId");
        return Promise.resolve();
      }

      if (inflightRef.current) {
        dlog("FETCH dedupe: waiting inflight");
        return inflightRef.current;
      }

      setError(undefined);

      const seq = ++reqSeq.current;
      const op: "init" | "more" = initial ? "init" : "more";
      const token = initial ? undefined : nextTokenRef.current;

      setDebug((x) => ({
        ...x,
        lastOp: op,
        lastStartedAt: nowMs(),
        lastToken: token,
        lastError: undefined,
      }));

      dlog("FETCH start", { op, viewId, fetchBatch, token, toggleField });

      if (initial) setLoading(true);
      else setLoadingMore(true);

      const p: Promise<void> = withTimeout(
        getPagedRef.current(viewId, fetchBatch, token, toggleField),
        timeoutMs,
        `getPaged(${op})`
      )
        .then((res) => {
          if (seq !== reqSeq.current) {
            dlog("FETCH ignore late response", { op });
            return;
          }

          dlog("FETCH ok", { op, received: res.items?.length, nextToken: res.nextToken });

          setColumns((prev) => prev ?? res.columns);
          setBuffer((prev) => (initial ? res.items : prev.concat(res.items)));
          setNextToken(res.nextToken);

          setDebug((x) => ({
            ...x,
            lastFinishedAt: nowMs(),
            lastMs: x.lastStartedAt ? nowMs() - x.lastStartedAt : undefined,
            lastNextToken: res.nextToken,
            lastReceived: res.items ? res.items.length : 0,
            lastBuffer: (initial
              ? (res.items?.length || 0)
              : bufferRef.current.length + (res.items?.length || 0)),
          }));
        })
        .catch((e: unknown) => {
          if (seq !== reqSeq.current) return;

          const msg = e instanceof Error ? e.message : String(e);
          dlog("FETCH error", { op, msg });

          setError(msg);
          setDebug((x) => ({
            ...x,
            lastFinishedAt: nowMs(),
            lastMs: x.lastStartedAt ? nowMs() - x.lastStartedAt : undefined,
            lastError: msg,
          }));
        })
        .then(() => {
          if (initial) setLoading(false);
          else setLoadingMore(false);

          if (inflightRef.current === p) inflightRef.current = null;
          dlog("FETCH end", { op });
        });

      inflightRef.current = p;
      return p;
    },
    [viewId, toggleField, fetchBatch, timeoutMs, dlog, guardDisabled]
  );

  // ✅ init SOLO por viewId/toggleField (no por cambio de getPaged/sort)
  React.useEffect((): void => {
    if (!enabled) {
      reset();
      return;
    }

    if (!viewId) {
      reset();
      return;
    }
    reset();
    fetchBatchFn(true).catch(() => {});
  }, [enabled, viewId, toggleField, reset, fetchBatchFn]);

  const ensureForPage = React.useCallback(
    async (targetPageIndex: number): Promise<void> => {
      if (guardDisabled()) return;
      if (!viewId) return;

      if (inflightRef.current) await inflightRef.current;

      const needCount = (targetPageIndex + 1) * uiPageSize;

      for (let i = 0; i < 20; i++) {
        const currentLen = bufferRef.current.length;
        const missing = needCount - currentLen;
        if (missing <= 0) break;

        if (!nextTokenRef.current) break;

        await fetchBatchFn(false);
        if (inflightRef.current) await inflightRef.current;
      }

      const remaining = bufferRef.current.length - needCount;
      if (nextTokenRef.current && remaining <= prefetchThreshold && !inflightRef.current) {
        fetchBatchFn(false).catch(() => {});
      }
    },
    [viewId, uiPageSize, prefetchThreshold, fetchBatchFn, guardDisabled]
  );

  const totalLoaded = buffer.length;

  const pageItems = React.useMemo((): TItem[] => {
    const start = pageIndex * uiPageSize;
    return buffer.slice(start, start + uiPageSize);
  }, [buffer, pageIndex, uiPageSize]);

  const canGoPrev = pageIndex > 0;
  const canGoNext = nextToken !== undefined || (pageIndex + 1) * uiPageSize < buffer.length;

  const goPrev = React.useCallback((): void => {
    if (guardDisabled()) return;
    setPageIndex((p) => Math.max(0, p - 1));
  }, [guardDisabled]);

  const goNext = React.useCallback(async (): Promise<void> => {
    if (guardDisabled()) return;
    if (!canGoNext) return;

    const next = pageIndex + 1;
    await ensureForPage(next);

    const start = next * uiPageSize;
    const hasData = start < bufferRef.current.length || nextTokenRef.current !== undefined;
    if (hasData) setPageIndex(next);
  }, [canGoNext, pageIndex, uiPageSize, ensureForPage, guardDisabled]);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (guardDisabled()) {
      reset();
      return;
    }

    if (!viewId) return;

    setPageIndex(0);
    setBuffer([]);
    setNextToken(undefined);
    setError(undefined);

    bufferRef.current = [];
    nextTokenRef.current = undefined;

    await fetchBatchFn(true);
  }, [viewId, fetchBatchFn, guardDisabled, reset]);

  return {
    columns,
    buffer,
    pageItems,
    nextToken,
    loading,
    loadingMore,
    pageIndex,
    setPageIndex,
    uiPageSize,
    totalLoaded,
    canGoPrev,
    canGoNext,
    ensureForPage,
    goPrev,
    goNext,
    refresh,
    reset,
    debug,
    error,
  };
}
