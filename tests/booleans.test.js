const { normalizeBooleanValue } = require("../lib/webparts/cencoPdpGrillaProvVehiculos/utils/booleans");

describe("normalizeBooleanValue", () => {
  test("normaliza valores verdaderos comunes", () => {
    expect(normalizeBooleanValue(true)).toBe(true);
    expect(normalizeBooleanValue(1)).toBe(true);
    expect(normalizeBooleanValue("si")).toBe(true);
    expect(normalizeBooleanValue("  YES ")).toBe(true);
    expect(normalizeBooleanValue("on")).toBe(true);
  });

  test("normaliza valores falsos comunes", () => {
    expect(normalizeBooleanValue(false)).toBe(false);
    expect(normalizeBooleanValue(0)).toBe(false);
    expect(normalizeBooleanValue("no")).toBe(false);
    expect(normalizeBooleanValue("")).toBe(false);
    expect(normalizeBooleanValue("off")).toBe(false);
  });

  test("trata objetos envoltorio y valores no vacíos", () => {
    expect(normalizeBooleanValue({ value: "true" })).toBe(true);
    expect(normalizeBooleanValue({ Value: "0" })).toBe(false);
    expect(normalizeBooleanValue({ results: ["yes"] })).toBe(true);
  });
});
