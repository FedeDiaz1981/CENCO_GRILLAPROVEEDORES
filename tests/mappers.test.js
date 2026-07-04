const { dtoToVehiculos } = require("../lib/webparts/cencoPdpGrillaProvVehiculos/utils/mappers");

describe("dtoToVehiculos", () => {
  test("convierte lookup simple", () => {
    const rows = [
      {
        Id: 10,
        Title: "ABC123",
        marca: "Ford",
        modelo: "Ranger",
        Proveedor: { Id: 7, Title: "Proveedor Uno" },
      },
    ];

    const result = dtoToVehiculos(rows);

    expect(result).toEqual([
      {
        id: 10,
        placa: "ABC123",
        marca: "Ford",
        modelo: "Ranger",
        proveedorIds: [7],
        proveedorTitles: ["Proveedor Uno"],
      },
    ]);
  });

  test("convierte lookup multiple con results", () => {
    const rows = [
      {
        Id: 11,
        Title: "DEF456",
        Proveedor: { results: [{ Id: 1, Title: "A" }, { Id: 2, Title: "B" }] },
      },
    ];

    const result = dtoToVehiculos(rows);

    expect(result[0].proveedorIds).toEqual([1, 2]);
    expect(result[0].proveedorTitles).toEqual(["A", "B"]);
  });
});
