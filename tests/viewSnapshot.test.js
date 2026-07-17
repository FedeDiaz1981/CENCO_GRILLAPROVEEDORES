const {
  buildViewSnapshot,
  parseViewSnapshot,
  normalizeSnapshotItems,
} = require("../lib/webparts/cencoPdpGrillaProvVehiculos/utils/viewSnapshot");

describe("viewSnapshot", () => {
  test("normaliza valores usando el titulo visible del campo cuando falta el internalName", () => {
    const fields = [
      { internalName: "Title", title: "Documento", type: "Text", required: false, readOnly: false, order: 0, inView: true },
      { internalName: "proveedor", title: "Proveedor", type: "Lookup", required: false, readOnly: false, order: 1, inView: true },
    ];

    const items = normalizeSnapshotItems(
      [
        {
          Documento: "12312345",
          Proveedor: "ACME",
        },
      ],
      fields
    );

    expect(items[0].Title).toBe("12312345");
    expect(items[0].proveedor).toBe("ACME");
  });

  test("buildViewSnapshot preserva el valor canonico al serializar", () => {
    const snapshot = buildViewSnapshot({
      listId: "list-1",
      viewId: "view-1",
      fields: [
        { internalName: "Title", title: "Documento", type: "Text", required: false, readOnly: false, order: 0, inView: true },
      ],
      items: [
        {
          Documento: "4545456",
        },
      ],
    });

    expect(snapshot.items[0].Title).toBe("4545456");
    expect(snapshot.items[0].Documento).toBe("4545456");
  });

  test("parseViewSnapshot mantiene la normalizacion en snapshots viejos v2", () => {
    const raw = JSON.stringify({
      version: 2,
      listId: "list-1",
      viewId: "view-1",
      capturedAt: "2026-07-16T00:00:00.000Z",
      view: { fieldNames: ["Title"] },
      columns: [{ key: "Title", name: "Documento", fieldName: "Title" }],
      fields: [
        { internalName: "Title", title: "Documento", type: "Text", required: false, readOnly: false, order: 0, inView: true },
      ],
      items: [
        {
          Documento: "70526589",
        },
      ],
    });

    const snapshot = parseViewSnapshot(raw);

    expect(snapshot).toBeTruthy();
    expect(snapshot.items[0].Title).toBe("70526589");
  });
});
