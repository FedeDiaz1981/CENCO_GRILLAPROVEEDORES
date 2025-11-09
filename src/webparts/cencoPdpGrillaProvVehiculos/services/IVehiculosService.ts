import { ListMeta, Vehiculo, VehiculoDraft } from "../models/types";

export type EditField = {
  internalName: string;
  title: string;
  type: string;
  required: boolean;
  readOnly: boolean;
  allowMultiple?: boolean;
  lookupListId?: string;
  choices?: string[];
};

export type SemaforoRule = {
  dateField: string;
  warnDays: number;
};

export type SemaforoConfig = Record<string, SemaforoRule>;

export type GridColumn = {
  key: string;
  name: string;
  fieldName: string;
  minWidth?: number;
  isResizable?: boolean;
};

export type SiteListRef = { id: string; title: string };
export type FieldRef = { internalName: string; title: string; type: string };

export interface IVehiculosService {
  // ===== Lista base (vehículos)
  getMeta(): Promise<ListMeta>;
  list(viewId?: string, boolField?: string): Promise<Vehiculo[]>;
  listRawByView(viewId: string, boolField?: string): Promise<any[]>;
  /** En la impl. concreta devuelve también listId (campo extra). */
  getViewGrid(viewId: string, boolField?: string): Promise<{ columns: GridColumn[]; items: any[] }>;

  add(draft: VehiculoDraft): Promise<void>;
  update(id: number, draft: VehiculoDraft): Promise<void>;
  recycle(id: number): Promise<void>;

  setBoolean(id: number, fieldInternalName: string, value: boolean): Promise<void>;
  userInGroup(groupName: string): Promise<boolean>;

  // ===== Metadatos (lista base)
  getViewFieldNames(viewId: string): Promise<string[]>;
  getFieldsMeta(internalNames: string[]): Promise<EditField[]>;
  getItemValues(id: number, schema: EditField[]): Promise<Record<string, unknown>>;
  getLookupOptionsByListId(listId: string): Promise<Array<{ key: number; text: string }>>;
  updateFields(id: number, schema: EditField[], values: Record<string, unknown>): Promise<void>;

  // ===== Semáforo (opcional)
  getTipoFormularioConfig?(listTitle: string, keyField: string): Promise<SemaforoConfig>;

  // ===== Listas arbitrarias (para relacionados / mini-form)
  listSiteLists(): Promise<SiteListRef[]>;
  getListFields(listId: string): Promise<FieldRef[]>;

  getRelatedItems(params: {
    childListId: string;
    childField: string;
    parentValue: string | number | Date | boolean;
  }): Promise<{ columns: GridColumn[]; items: any[] }>;

  getRelatedGridByView(
    childListId: string,
    viewId: string,
    childField: string,
    parentValue: any
  ): Promise<{ columns: GridColumn[]; items: any[] }>;

  /** NOMBRES de campos definidos en una vista de una lista arbitraria (para armar schema del mini-form). */
  getViewFieldNamesFromList(listId: string, viewId: string): Promise<string[]>;

  /** Metadatos de campos pero contra una lista arbitraria. */
  getFieldsMetaFromList(listId: string, internalNames: string[]): Promise<EditField[]>;

  /** Valores tipados de un ítem (lista arbitraria) según schema provisto. */
  getItemValuesFromList(
    listId: string,
    id: number,
    schema: EditField[]
  ): Promise<Record<string, unknown>>;

  /** Actualización de campos (lista arbitraria). */
  updateFieldsInList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void>;

  updateFieldsOnList(
  listId: string,
  id: number,
  schema: EditField[],
  values: Record<string, unknown>
): Promise<void>;

  /** Adjuntos (lista arbitraria). */
  listAttachments(listId: string, id: number): Promise<Array<{ name: string; serverRelativeUrl: string }>>;
  replaceAttachment(listId: string, id: number, file: File): Promise<void>;
}
