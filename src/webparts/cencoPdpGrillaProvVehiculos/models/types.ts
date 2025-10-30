// src/models/types.ts

export type Lookup = { Id: number; Title: string };

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
  [key: string]: any;
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
  proveedorId?: number | number[] | null;
};

export type FieldProveedorInfo = {
  LookupList?: string;
  AllowMultipleValues?: boolean;
};

export type RawVehiculo = {
  Id: number;
  Title?: string;
  marca?: string;
  modelo?: string;

  // Proveedor puede venir como objeto, array o {results:[]}
  Proveedor?:
    | { Id?: number; Title?: string }
    | Array<{ Id: number; Title?: string }>
    | { results: Array<{ Id: number; Title?: string }> };

  // Otros campos crudos que traiga la consulta
  [key: string]: any;
};

// ===== Semáforo =====
export type SemaforoRule = { dateField: string; warnDays: number };
export type SemaforoConfig = Record<string, SemaforoRule>;
