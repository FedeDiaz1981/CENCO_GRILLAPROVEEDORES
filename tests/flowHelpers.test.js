const {
  buildAutomateUrl,
  csvEscape,
  filterOutIdColumns,
  getRowId,
  isMotivoRequired,
  shouldShowMotivoModal,
} = require("../lib/webparts/cencoPdpGrillaProvVehiculos/utils/flowHelpers");

describe("flowHelpers", () => {
  test("buildAutomateUrl reemplaza placeholders y agrega query si corresponde", () => {
    const withPlaceholders = buildAutomateUrl("https://x.test/hook/{action}/{itemId}", {
      action: "approve",
      itemId: 10,
      reason: "hola mundo",
    });

    expect(withPlaceholders).toBe("https://x.test/hook/approve/10");

    const withQuery = buildAutomateUrl("https://x.test/hook", {
      action: "reject",
      itemId: 7,
      reason: "a b",
    });

    expect(withQuery).toBe("https://x.test/hook?action=reject&itemId=7&reason=a%20b");
  });

  test("approval helpers resuelven el modo de motivo", () => {
    expect(shouldShowMotivoModal("both", "approve")).toBe(true);
    expect(shouldShowMotivoModal("approve", "reject")).toBe(false);
    expect(isMotivoRequired("reject", "reject")).toBe(true);
    expect(isMotivoRequired("reject", "approve")).toBe(false);
  });

  test("csvEscape protege separadores y comillas", () => {
    expect(csvEscape("hola, mundo")).toBe('"hola, mundo"');
    expect(csvEscape('a "b" c')).toBe('"a ""b"" c"');
    expect(csvEscape("simple")).toBe("simple");
  });

  test("getRowId acepta alias comunes y filterOutIdColumns excluye id", () => {
    expect(getRowId({ ID: 9 })).toBe(9);

    const cols = filterOutIdColumns([
      { key: "ID", name: "ID" },
      { key: "Title", name: "Título" },
      { key: "Id", name: "Id" },
    ]);

    expect(cols).toEqual([{ key: "Title", name: "Título" }]);
  });
});
