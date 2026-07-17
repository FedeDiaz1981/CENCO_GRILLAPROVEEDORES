// services/IVehiculosService.ts
import { ListMeta, Vehiculo, VehiculoDraft } from "../models/types";

/** Valores permitidos para filtrar/relacionar */
export type ParentValue = string | number | boolean | Date | undefined;

/** Campo editable usado por mini-form y edición dinámica */
export type EditField = {
  internalName: string;
  title: string;
  /** SharePoint TypeAsString, ej: Text, Number, DateTime, Lookup, User, Choice, MultiChoice, Boolean */
  type: string;
  required: boolean;
  readOnly: boolean;
  allowMultiple?: boolean;
  lookupListId?: string;
  choices?: string[];
};

export type SemaforoRule = { dateField: string; warnDays: number };
export type SemaforoConfig = Record<string, SemaforoRule>;

/** Columnas genéricas para grillas por vista */
export type GridColumn = {
  key: string;
  name: string;
  fieldName: string;
  minWidth?: number;
  isResizable?: boolean;
};

export type GridRow = Record<string, unknown>;

export type PagedGridResult = {
  columns: GridColumn[];
  items: GridRow[];
  nextToken?: string;
  listId?: string;
};

export type ViewGridOptions = {
  resolveLookups?: boolean;
};

export type LookupHydrationResult = {
  items: GridRow[];
  lookupOpts: Record<string, Array<{ key: number; text: string }>>;
};

export type SiteListRef = { id: string; title: string };
export type FieldRef = { internalName: string; title: string; type: string };

/** Estados típicos de aprobación (si tu lista usa otros, mandá string directo). */
export type ApprovalStatus = "Pendiente" | "Aprobado" | "Rechazado";

/** Estados típicos de workflow (si tu lista usa otros, mandá string directo). */
export type WorkflowStatus = "Pendiente" | "Ok" | "Error" | string;

export interface IVehiculosService {
  // ============================================================
  // Lista base (Vehículos)
  // ============================================================
  getMeta(): Promise<ListMeta>;

  /**
   * Listado "clásico" (mapeado a Vehiculo). Si se pasa viewId, usa CAML de la vista.
   * boolField (opcional) permite mapear un campo booleano extra (toggle).
   */
  list(viewId?: string, boolField?: string): Promise<Vehiculo[]>;

  /** Listado raw por vista (CAML). Se usa para grillas genéricas. */
  listRawByView(viewId: string, boolField?: string): Promise<GridRow[]>;

  /**
   * Obtiene columnas + items siguiendo la definición de una vista.
   * Puede devolver listId extra (SPVehiculosService lo hace).
   */
  getViewGrid(
    viewId: string,
    boolField?: string,
    options?: ViewGridOptions
  ): Promise<{ columns: GridColumn[]; items: GridRow[]; listId?: string }>;

  /**
   * Obtiene todos los registros visibles de una vista usando el mismo motor paginado
   * que la grilla. Se usa para snapshots fieles de vistas complejas.
   */
  getAllViewGrid(
    viewId: string,
    boolField?: string,
    options?: ViewGridOptions
  ): Promise<{ columns: GridColumn[]; items: GridRow[]; listId: string }>;

  /**
   * Paginado server-side sobre toda la lista, sin depender de una vista.
   * Se usa para vistas 100% personalizadas definidas por la webpart.
   */
  getListGridPaged?(
    listId: string,
    pageSize: number,
    pagingToken?: string,
    options?: ViewGridOptions
  ): Promise<{
    columns: GridColumn[];
    items: GridRow[];
    listId: string;
    nextToken?: string;
  }>;

  add(draft: VehiculoDraft): Promise<void>;
  update(id: number, draft: VehiculoDraft): Promise<void>;
  recycle(id: number): Promise<void>;

  setBoolean(id: number, fieldInternalName: string, value: boolean): Promise<void>;

  /** Se usa para habilitar botones por grupo (aprobación u otros permisos) */
  userInGroup(groupName: string): Promise<boolean>;

  /**
   * Update directo de campos sin schema (rápido y útil para aprobación / motivo / updates pequeños)
   * El componente lo usa como primer fallback.
   */
  updateItemFields(id: number, fields: Record<string, unknown>): Promise<void>;

  /**
   * ✅ NUEVO: Lectura rápida de campos puntuales (para polling de wfstatus/wferror, etc.)
   * Debe devolver un mapa internalName->valor.
   */
  getItemFields(id: number, internalNames: string[]): Promise<Record<string, unknown>>;

  // ============================================================
  // Metadatos (lista base)
  // ============================================================
  /** Nombres internos de campos definidos en una vista de la lista base */
  getViewFieldNames(viewId: string, includeSystemFields?: boolean): Promise<string[]>;

  /** Metadatos de campos por internalName (lista base) */
  getFieldsMeta(internalNames: string[]): Promise<EditField[]>;

  /** Valores tipados del ítem (lista base) según schema provisto */
  getItemValues(id: number, schema: EditField[]): Promise<Record<string, unknown>>;

  /** Opciones de lookup por listId (para Lookup/User). */
  getLookupOptionsByListId(listId: string): Promise<Array<{ key: number; text: string }>>;

  /** Update usando schema (convierte lookups, fechas, números, etc.) */
  updateFields(id: number, schema: EditField[], values: Record<string, unknown>): Promise<void>;

  // ============================================================
  // Aprobación (opcional)
  // ============================================================
  /**
   * Si no lo implementás, la UI usa updateItemFields directamente.
   * "fields" permite setear nombres reales del campo (ej: EstadoAprobacion, Motivo).
   */
  setApprovalStatus?(
    id: number,
    status: ApprovalStatus | string,
    reason?: string,
    fields?: { statusField?: string; reasonField?: string }
  ): Promise<void>;

  // ============================================================
  // Semáforo (opcional)
  // ============================================================
  getTipoFormularioConfig?(listTitle: string, keyField: string): Promise<SemaforoConfig>;

  // ============================================================
  // Listas arbitrarias (relacionados / mini-form)
  // ============================================================
  listSiteLists(): Promise<SiteListRef[]>;
  getListFields(listId: string): Promise<FieldRef[]>;

  getRelatedItems(params: {
    childListId: string;
    childField: string;
    parentValue: ParentValue;
  }): Promise<{ columns: GridColumn[]; items: GridRow[] }>;

  getRelatedGridByView(
    childListId: string,
    viewId: string,
    childField: string,
    parentValue: ParentValue
  ): Promise<{ columns: GridColumn[]; items: GridRow[] }>;

  // ============================================================
  // Paginado por vista (opcional según implementación)
  // ============================================================
  /**
   * Paginado server-side para una vista. nextToken es opaco y lo emite el service.
   * sortField/sortDesc se usan en server-side (si el service lo soporta).
   */
  getViewGridPaged?(
    viewId: string,
    pageSize: number,
    pagingToken?: string,
    boolField?: string,
    sortField?: string,
    sortDesc?: boolean,
    options?: ViewGridOptions
  ): Promise<{
    columns: GridColumn[];
    items: GridRow[];
    listId: string;
    nextToken?: string;
  }>;

  // ============================================================
  // Mini-form sobre lista arbitraria
  // ============================================================
  getViewFieldNamesFromList(listId: string, viewId: string): Promise<string[]>;
  getFieldsMetaFromList(listId: string, internalNames: string[]): Promise<EditField[]>;
  getItemValuesFromList(
    listId: string,
    id: number,
    schema: EditField[]
  ): Promise<Record<string, unknown>>;

  hydrateLookupTexts?(
    items: GridRow[],
    metas: EditField[]
  ): Promise<LookupHydrationResult>;

  /**
   * ✅ NUEVO: Lectura rápida de campos puntuales en lista arbitraria
   * Útil para esperar estados de WF en relacionados si alguna vez lo necesitás.
   */
  getItemFieldsFromList(
    listId: string,
    id: number,
    internalNames: string[]
  ): Promise<Record<string, unknown>>;

  /** Nombre "canónico" para update en lista arbitraria */
  updateFieldsInList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void>;

  /** Alias (el componente lo usa) */
  updateFieldsOnList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void>;

  /**
   * Aprobación en lista arbitraria (opcional)
   * Útil si aplicás workflow también a “relacionados”.
   */
  setApprovalStatusOnList?(
    listId: string,
    id: number,
    status: ApprovalStatus | string,
    reason?: string,
    fields?: { statusField?: string; reasonField?: string }
  ): Promise<void>;

  // ============================================================
  // Adjuntos (lista arbitraria)
  // ============================================================
  listAttachments(
    listId: string,
    id: number
  ): Promise<Array<{ name: string; serverRelativeUrl: string }>>;
  replaceAttachment(listId: string, id: number, file: File): Promise<void>;
}
