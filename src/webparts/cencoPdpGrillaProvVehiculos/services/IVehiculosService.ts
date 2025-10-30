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
  getMeta(): Promise<ListMeta>;
  list(viewId?: string, boolField?: string): Promise<Vehiculo[]>;
  listRawByView(viewId: string, boolField?: string): Promise<any[]>;
  getViewGrid(viewId: string, boolField?: string): Promise<{ columns: GridColumn[]; items: any[] }>;

  add(draft: VehiculoDraft): Promise<void>;
  update(id: number, draft: VehiculoDraft): Promise<void>;
  recycle(id: number): Promise<void>;

  setBoolean(id: number, fieldInternalName: string, value: boolean): Promise<void>;
  userInGroup(groupName: string): Promise<boolean>;

  getViewFieldNames(viewId: string): Promise<string[]>;
  getFieldsMeta(internalNames: string[]): Promise<EditField[]>;
  getItemValues(id: number, schema: EditField[]): Promise<Record<string, unknown>>;
  getLookupOptionsByListId(listId: string): Promise<Array<{ key: number; text: string }>>;
  updateFields(id: number, schema: EditField[], values: Record<string, unknown>): Promise<void>;

  getTipoFormularioConfig?(listTitle: string, keyField: string): Promise<SemaforoConfig>;

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
}
