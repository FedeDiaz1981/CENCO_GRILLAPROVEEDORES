import { IColumn } from "@fluentui/react";

export type MotivoMode = "none" | "approve" | "reject" | "both";
export type ApprovalAction = "approve" | "reject";

export function buildAutomateUrl(
  baseUrl: string,
  args: Record<string, string | number | boolean | undefined>
): string {
  let url = String(baseUrl || "").trim();
  if (!url) return url;

  Object.keys(args).forEach((k) => {
    const val = args[k];
    const safe = val === undefined || val === null ? "" : encodeURIComponent(String(val));
    url = url.split(`{${k}}`).join(safe);
  });

  const hasPlaceholders = /\{[a-zA-Z0-9_]+\}/.test(String(baseUrl));
  if (hasPlaceholders) return url;

  const qp: string[] = [];
  Object.keys(args).forEach((k) => {
    const v = args[k];
    if (v === undefined || v === null || String(v).trim() === "") return;
    qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  });

  if (!qp.length) return url;
  return url + (url.includes("?") ? "&" : "?") + qp.join("&");
}

export function shouldShowMotivoModal(mode: MotivoMode | undefined, action: ApprovalAction): boolean {
  const normalized = mode || "none";
  if (normalized === "both") return true;
  if (normalized === "approve") return action === "approve";
  if (normalized === "reject") return action === "reject";
  return false;
}

export function isMotivoRequired(mode: MotivoMode | undefined, action: ApprovalAction): boolean {
  const normalized = mode || "none";
  if (normalized === "both") return true;
  if (normalized === "approve") return action === "approve";
  if (normalized === "reject") return action === "reject";
  return false;
}

export function csvEscape(value: unknown): string {
  const sVal = value === undefined || value === null ? "" : String(value);
  const needQuotes = /[;"\n\r,]/.test(sVal);
  const esc = sVal.replace(/"/g, '""');
  return needQuotes ? `"${esc}"` : esc;
}

export function getRowId<T extends Record<string, unknown>>(row: T | undefined): number | undefined {
  if (!row) return undefined;

  const candidates = ["id", "Id", "ID", "ItemId", "ID_x0020_", "Id_x0020_"];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

export function filterOutIdColumns(cols: IColumn[]): IColumn[] {
  return cols.filter((c) => {
    const n = (c.fieldName || c.key || c.name || "").toString();
    return !/^(ID|Id)$/i.test(n);
  });
}
