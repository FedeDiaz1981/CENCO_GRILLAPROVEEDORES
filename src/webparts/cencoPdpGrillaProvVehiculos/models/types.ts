// src/models/types.ts

export type Lookup = { Id: number; Title: string };

export type ExtraFields = Record<string, unknown>;

export type Vehiculo = {
  id: number;
  placa: string;

  // Estas pueden no existir según la lista/vista
  marca?: string;
  modelo?: string;

  proveedorIds: number[];
  proveedorTitles: string[];
  toggle?: boolean;

  // Permite acceder a cualquier otro campo devuelto por la vista
  [key: string]: unknown;
};

export type ListMeta = {
  listId: string;
  provMulti: boolean;
  provOptions: Array<{ key: number; text: string }>;
};

export type VehiculoDraft = {
  placa: string;
  marca?: string;
  modelo?: string;

  // null NO (regla rush). Si querés “vacío”, usá undefined.
  proveedorId?: number | number[];
};

export type FieldProveedorInfo = {
  LookupList?: string;
  AllowMultipleValues?: boolean;
};

export type LookupItem = { Id?: number; Title?: string };
export type LookupBag = { results: Array<LookupItem> };

export type RawVehiculo = {
  Id: number;
  Title?: string;
  marca?: string;
  modelo?: string;

  // Proveedor puede venir como objeto, array o {results:[]}
  Proveedor?: LookupItem | Array<LookupItem> | LookupBag;

  // Otros campos crudos que traiga la consulta
  [key: string]: unknown;
};

// ===== Semáforo =====
export type SemaforoRule = { dateField: string; warnDays: number };
export type SemaforoConfig = Record<string, SemaforoRule>;
