import * as React from "react";
import { IVehiculosService } from "../services/IVehiculosService";
import { Vehiculo, VehiculoDraft, ListMeta } from "../models/types";

type State = {
  items: Array<Vehiculo & Record<string, unknown>>;
  meta?: ListMeta;
  loading: boolean;
  canEdit: boolean;
  editingId: number | undefined;
  draft?: VehiculoDraft;
  saving: boolean;
};

type HookReturn = {
  s: State;
  setS: React.Dispatch<React.SetStateAction<State>>;
  refresh: () => Promise<void>;
  enterEdit: (v: Vehiculo | any) => void;
  addNew: () => void;
  cancel: () => void;
  confirm: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggleProv: (idNum: number, selected: boolean) => void;
  updateDraft: (patch: Partial<VehiculoDraft>) => void;
  toggleActive: (v: Vehiculo) => Promise<void>;
};

export function useVehiculosGrid(
  svc: IVehiculosService,
  editGroupName: string,
  viewId?: string,
  toggleField?: string
): HookReturn {
  const [s, setS] = React.useState<State>({
    items: [],
    loading: true,
    canEdit: false,
    editingId: undefined,
    saving: false,
  });

  const refresh = React.useCallback(async (): Promise<void> => {
    setS((x) => ({ ...x, loading: true }));
    const [meta, items, canEdit] = await Promise.all([
      svc.getMeta(),
      svc.list(viewId, toggleField),
      svc.userInGroup(editGroupName),
    ]);
    setS((x) => ({ ...x, meta, items, canEdit, loading: false }));
  }, [svc, editGroupName, viewId, toggleField]);

  React.useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const updateDraft = (patch: Partial<VehiculoDraft>): void => {
    setS((x) => ({ ...x, draft: { ...(x.draft || { placa: "" }), ...patch } }));
  };

  /** Helper para normalizar ID */
  const getRowId = (v: any): number | undefined => {
    return v?.id ?? v?.Id ?? v?.ID;
  };

  /** ✅ versión corregida y simplificada */
  const enterEdit = (v: Vehiculo | any): void => {
    console.log("Edit");
    const id = getRowId(v);
    if (id == null) return;

    // ya estás editando la misma fila → no hagas nada
    if (s.editingId === id) return;

    // buscar el item real en memoria
    const base = s.items.find((it) => getRowId(it) === id) as Vehiculo | undefined;
    const multi = !!s.meta?.provMulti;
    const provIds = base?.proveedorIds ? base.proveedorIds.slice() : [];

    setS((x) => ({
      ...x,
      editingId: id,
      draft: {
        placa: base?.placa || v?.placa || v?.Title || "",
        marca: base?.marca || v?.marca,
        modelo: base?.modelo || v?.modelo,
        proveedorId: multi ? provIds : provIds[0],
      },
    }));
  };

  const addNew = (): void => {
    if (!s.canEdit || s.editingId !== undefined) return;
    setS((x) => ({
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
    }));
  };

  const cancel = (): void => {
    setS((x) => ({
      ...x,
      items: x.editingId === -1 ? x.items.filter((i) => i.id !== -1) : x.items,
      editingId: undefined,
      draft: undefined,
    }));
  };

  const confirm = async (): Promise<void> => {
    if (s.editingId === undefined || !s.draft) return;
    setS((x) => ({ ...x, saving: true }));
    try {
      if (s.editingId === -1) await svc.add(s.draft);
      else await svc.update(s.editingId, s.draft);
      await refresh();
      setS((x) => ({ ...x, editingId: undefined, draft: undefined }));
    } catch {
      // podrías loguear el error si querés
    }
    setS((x) => ({ ...x, saving: false }));
  };

  const remove = async (id: number): Promise<void> => {
    if (!s.canEdit) return;
    await svc.recycle(id);
    await refresh();
  };

  const toggleProv = (idNum: number, selected: boolean): void => {
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
  };

  const toggleActive = async (v: Vehiculo): Promise<void> => {
    if (!toggleField || !s.canEdit) return;
    await svc.setBoolean(v.id, toggleField, !Boolean(v.toggle));
    await refresh();
  };

  return {
    s,
    setS,
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
