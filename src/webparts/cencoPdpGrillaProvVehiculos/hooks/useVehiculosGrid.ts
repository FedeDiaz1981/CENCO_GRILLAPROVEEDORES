// hooks/useVehiculosGrid.ts
import * as React from "react";
import { IColumn } from "@fluentui/react";
import type { IVehiculosService } from "../services/IVehiculosService";
import type { Vehiculo, VehiculoDraft, ListMeta } from "../models/types";
import { usePagedViewGrid } from "../hooks/usePagedViewGrid";

type RowLike = Partial<Vehiculo> & {
  id?: number;
  Id?: number;
  ID?: number;
  Title?: string;
};

type State = {
  items: Array<Vehiculo & Record<string, unknown>>;
  meta?: ListMeta;
  loading: boolean;
  loadingMore: boolean;
  canEdit: boolean;
  editingId: number | undefined;
  draft?: VehiculoDraft;
  saving: boolean;
};

type HookReturn = {
  s: State;
  setS: React.Dispatch<React.SetStateAction<State>>;

  // paginado (solo aplica cuando viewId está seteado y usePagedViewGrid trae data)
  pageIndex: number;
  uiPageSize: number;
  totalLoaded: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => Promise<void>;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;

  refresh: () => Promise<void>;
  enterEdit: (v: Vehiculo | RowLike) => void;
  addNew: () => void;
  cancel: () => void;
  confirm: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggleProv: (idNum: number, selected: boolean) => void;
  updateDraft: (patch: Partial<VehiculoDraft>) => void;
  toggleActive: (v: Vehiculo) => Promise<void>;
};

const UI_PAGE_SIZE = 10;
const FETCH_BATCH = 30;
const PREFETCH_THRESHOLD = 10;

export function useVehiculosGrid(
  svc: IVehiculosService,
  editGroupName: string,
  viewId?: string,
  toggleField?: string,
  sortField?: string,
  sortDesc?: boolean
): HookReturn {
  // -------------------------
  // Helpers
  // -------------------------
  const getRowId = React.useCallback(
    (v: RowLike | undefined): number | undefined => {
      if (!v) return undefined;
      return v.id ?? v.Id ?? v.ID;
    },
    []
  );

  const hasPaged = React.useMemo(() => {
    const anySvc = svc as any;
    return typeof anySvc.getViewGridPaged === "function";
  }, [svc]);

  const getPaged = React.useCallback(
    async (
      vId: string,
      pageSize: number,
      token?: string,
      boolField?: string,
      sField?: string,
      sDesc?: boolean
    ) => {
      // Fallback: sin paginado server, traigo la vista entera (como antes)
      if (!hasPaged) {
        const grid = await svc.getViewGrid(vId, boolField);
        return {
          columns: grid.columns as unknown as IColumn[],
          items: grid.items as any[],
          nextToken: undefined as string | undefined,
        };
      }

      const res = await (svc as any).getViewGridPaged(
        vId,
        pageSize,
        token,
        boolField,
        sField,
        sDesc
      );

      return {
        columns: res.columns as unknown as IColumn[],
        items: res.items as any[],
        nextToken: res.nextToken as string | undefined,
      };
    },
    [svc, hasPaged]
  );

  const getPagedWithSort = React.useCallback(
    async (
      vId: string,
      pageSize: number,
      token?: string,
      boolField?: string
    ) => {
      return getPaged(vId, pageSize, token, boolField, sortField, sortDesc);
    },
    [getPaged, sortField, sortDesc]
  );

  // -------------------------
  // Paged view grid (modo viewId)
  // -------------------------
  const paged = usePagedViewGrid(getPagedWithSort, {
    viewId,
    toggleField,
    fetchBatch: FETCH_BATCH,
    uiPageSize: UI_PAGE_SIZE,
    prefetchThreshold: PREFETCH_THRESHOLD,
  });

  // -------------------------
  // State
  // -------------------------
  const [s, setS] = React.useState<State>({
    items: [],
    loading: true,
    loadingMore: false,
    canEdit: false,
    editingId: undefined,
    saving: false,
  });

  // -------------------------
  // Refresh meta/permisos
  // -------------------------
  const refresh = React.useCallback(async (): Promise<void> => {
    setS((x) => ({ ...x, loading: true }));

    const [meta, canEdit] = await Promise.all([
      svc.getMeta(),
      svc.userInGroup(editGroupName),
    ]);

    setS((x) => ({ ...x, meta, canEdit, loading: false }));
  }, [svc, editGroupName]);

  React.useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  // -------------------------
  // Cuando cambia viewId/toggle/sort => reseteo paged
  // -------------------------
  React.useEffect(() => {
    if (!viewId) return;

    paged.reset();
    paged.refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, toggleField, sortField, sortDesc]);

  // -------------------------
  // Sync de items desde paged (solo si viewId está)
  // -------------------------
  React.useEffect(() => {
    setS((x) => ({
      ...x,
      loading: viewId ? paged.loading : x.loading,
      loadingMore: viewId ? paged.loadingMore : false,
      items: (viewId ? paged.pageItems || [] : x.items) as Array<
        Vehiculo & Record<string, unknown>
      >,
    }));
  }, [viewId, paged.loading, paged.loadingMore, paged.pageItems]);

  // -------------------------
  // Draft helpers
  // -------------------------
  const updateDraft = React.useCallback((patch: Partial<VehiculoDraft>): void => {
    setS((x) => ({
      ...x,
      draft: { ...(x.draft || { placa: "" }), ...patch },
    }));
  }, []);

  const findInLoadedBuffer = React.useCallback(
    (id: number): Vehiculo | undefined => {
      const all = (paged.buffer || []) as Array<Vehiculo & Record<string, unknown>>;
      const hit = all.find((it) => getRowId(it as unknown as RowLike) === id);
      return hit as Vehiculo | undefined;
    },
    [paged.buffer, getRowId]
  );

  const enterEdit = React.useCallback(
    (v: Vehiculo | RowLike): void => {
      const id = getRowId(v as RowLike);
      if (id === undefined) return;

      setS((x) => {
        if (x.editingId === id) return x;

        const base = findInLoadedBuffer(id);
        const multi = Boolean(x.meta?.provMulti);
        const provIds = base?.proveedorIds ? base.proveedorIds.slice() : [];

        return {
          ...x,
          editingId: id,
          draft: {
            placa: base?.placa || (v as RowLike).placa || (v as RowLike).Title || "",
            marca: base?.marca || (v as RowLike).marca,
            modelo: base?.modelo || (v as RowLike).modelo,
            proveedorId: multi ? provIds : provIds[0],
          },
        };
      });
    },
    [getRowId, findInLoadedBuffer]
  );

  const addNew = React.useCallback((): void => {
    setS((x) => {
      if (viewId) return x;
      if (!x.canEdit || x.editingId !== undefined) return x;

      return {
        ...x,
        items: [
          {
            id: -1,
            placa: "",
            marca: "",
            modelo: "",
            proveedorIds: [],
            proveedorTitles: [],
            toggle: undefined,
          },
          ...x.items,
        ],
        editingId: -1,
        draft: {
          placa: "",
          marca: "",
          modelo: "",
          proveedorId: x.meta?.provMulti ? [] : undefined,
        },
      };
    });
  }, [viewId]);

  const cancel = React.useCallback((): void => {
    setS((x) => ({
      ...x,
      items: x.editingId === -1 ? x.items.filter((i) => i.id !== -1) : x.items,
      editingId: undefined,
      draft: undefined,
    }));
  }, []);

  // ✅ FIX: cerrar edición SI el update/add sale bien, aunque falle el refresh/paged.refresh
  // ✅ confirm usando updateFields en modo viewId
  const confirm = React.useCallback(async (): Promise<void> => {
    const editingId = s.editingId;
    const draft = s.draft;
    if (editingId === undefined || !draft) return;

    setS((x) => ({ ...x, saving: true }));

    try {
      if (editingId === -1) {
        // alta solo en modo base (tu UI ya lo bloquea cuando viewId existe)
        await svc.add(draft);
      } else {
        // ✅ MODO DINÁMICO (viewId): usar updateFields con metas
        if (viewId) {
          const draftAny = draft as unknown as Record<string, unknown>;

          const keysRaw = Object.keys(draftAny).filter((k) => draftAny[k] !== undefined);

          // UI -> SP “obvio”
          const requested = keysRaw.map((k) => (k === "placa" ? "Title" : k));

          // metas: resuelve internalName real aunque pases Title/DisplayName
          const metas = await svc.getFieldsMeta(Array.from(new Set(requested)));

          // map requestedName -> internalName real (por internalName o por title)
          const keyToInternal: Record<string, string> = {};
          for (const req of requested) {
            const reqLc = String(req).toLowerCase();
            const hit = metas.find(
              (m) =>
                String(m.internalName).toLowerCase() === reqLc ||
                String(m.title).toLowerCase() === reqLc
            );
            if (hit) keyToInternal[reqLc] = hit.internalName;
          }

          const values: Record<string, unknown> = {};

          for (const k of keysRaw) {
            const reqKey = k === "placa" ? "Title" : k;
            const internal = keyToInternal[String(reqKey).toLowerCase()];
            if (!internal) continue;

            values[internal] = draftAny[k];
          }

          if (Object.keys(values).length) {
            await svc.updateFields(editingId, metas, values);
          }
        } else {
          await svc.update(editingId, draft);
        }
      }

      // ✅ importante: liberá la UI primero
      setS((x) => ({ ...x, editingId: undefined, draft: undefined }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error guardando", e);
      // Dejo al usuario en edición para que no pierda lo que escribió
      return;
    } finally {
      setS((x) => ({ ...x, saving: false }));
    }

    // Best-effort refresh (si falla, NO rompe la UI)
    try {
      await refresh();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error refresh meta", e);
    }

    if (viewId) {
      try {
        paged.reset();
        await paged.refresh();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error refresh vista (paged)", e);
      }
    }
  }, [s.editingId, s.draft, svc, refresh, paged, viewId]);

  const remove = React.useCallback(
    async (id: number): Promise<void> => {
      if (!s.canEdit) return;

      await svc.recycle(id);

      try {
        await refresh();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error refresh meta", e);
      }

      if (viewId) {
        try {
          paged.reset();
          await paged.refresh();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Error refresh vista (paged)", e);
        }
      }
    },
    [s.canEdit, svc, refresh, paged, viewId]
  );

  const toggleProv = React.useCallback((idNum: number, selected: boolean): void => {
    setS((x) => {
      const d: VehiculoDraft = { ...(x.draft || { placa: "" }) };

      if (x.meta?.provMulti) {
        const arr = Array.isArray(d.proveedorId)
          ? (d.proveedorId as number[]).slice()
          : [];
        const idx = arr.indexOf(idNum);

        if (selected && idx === -1) arr.push(idNum);
        if (!selected && idx !== -1) arr.splice(idx, 1);

        d.proveedorId = arr;
      } else {
        d.proveedorId = selected ? idNum : undefined;
      }

      return { ...x, draft: d };
    });
  }, []);

  const toggleActive = React.useCallback(
    async (v: Vehiculo): Promise<void> => {
      if (!toggleField || !s.canEdit) return;

      await svc.setBoolean(v.id, toggleField, !Boolean(v.toggle));

      try {
        await refresh();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error refresh meta", e);
      }

      if (viewId) {
        try {
          paged.reset();
          await paged.refresh();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Error refresh vista (paged)", e);
        }
      }
    },
    [toggleField, s.canEdit, svc, refresh, paged, viewId]
  );

  return {
    s,
    setS,

    pageIndex: paged.pageIndex,
    uiPageSize: paged.uiPageSize,
    totalLoaded: paged.totalLoaded,
    canGoPrev: paged.canGoPrev,
    canGoNext: paged.canGoNext,
    goPrev: paged.goPrev,
    goNext: paged.goNext,
    setPageIndex: paged.setPageIndex,

    refresh,
    enterEdit,
    addNew,
    cancel,
    confirm,
    remove,
    toggleProv,
    updateDraft,
    toggleActive,
  };
}
