import { Vehiculo, RawVehiculo } from "../models/types";

export function dtoToVehiculos(rows: RawVehiculo[]): Vehiculo[] {
  return (rows || []).map(r => {
    const p = r.Proveedor as any;
    const titles: string[] = Array.isArray(p)
      ? p.map((x: any) => x?.Title).filter(Boolean)
      : Array.isArray(p?.results)
      ? p.results.map((x: any) => x?.Title).filter(Boolean)
      : (p?.Title ? [p.Title] : []);

    const ids: number[] = Array.isArray(p)
      ? p.map((x: any) => x.Id)
      : Array.isArray(p?.results)
      ? p.results.map((x: any) => x.Id)
      : (p?.Id ? [p.Id] : []);

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
