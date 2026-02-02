import { Vehiculo, RawVehiculo } from "../models/types";

type LookupItem = {
  Id?: number;
  Title?: string;
};

type LookupResults = { results: LookupItem[] };

type LookupValue = LookupItem | LookupItem[] | LookupResults | undefined;

const isLookupResults = (v: unknown): v is LookupResults => {
  if (!v || typeof v !== "object") return false;
  if (!("results" in v)) return false;
  const res = (v as { results?: unknown }).results;
  return Array.isArray(res);
};

export function dtoToVehiculos(rows: RawVehiculo[]): Vehiculo[] {
  return (rows || []).map((r) => {
    const p = r.Proveedor as unknown as LookupValue;

    let ids: number[] = [];
    let titles: string[] = [];

    if (Array.isArray(p)) {
      ids = p.map((x) => x.Id).filter((x): x is number => typeof x === "number");
      titles = p.map((x) => x.Title).filter((x): x is string => typeof x === "string" && x.length > 0);
    } else if (isLookupResults(p)) {
      ids = p.results.map((x) => x.Id).filter((x): x is number => typeof x === "number");
      titles = p.results
        .map((x) => x.Title)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
    } else if (p && typeof p === "object") {
      // LookupItem single
      if (typeof p.Id === "number") ids = [p.Id];
      if (typeof p.Title === "string" && p.Title.length > 0) titles = [p.Title];
    }

    return {
      id: r.Id,
      placa: r.Title || "",
      marca: r.marca,
      modelo: r.modelo,
      proveedorIds: ids,
      proveedorTitles: titles,
    };
  });
}
