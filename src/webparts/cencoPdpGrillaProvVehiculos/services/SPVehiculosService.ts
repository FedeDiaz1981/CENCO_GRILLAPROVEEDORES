// services/SPVehiculosService.ts
import { SPFI } from "@pnp/sp";
import { body } from "@pnp/queryable";
import { spPost } from "@pnp/sp";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";
import "@pnp/sp/site-users/web";
import "@pnp/sp/site-groups";
import "@pnp/sp/views";
import "@pnp/sp/attachments";

import type { IList } from "@pnp/sp/lists";

import type {
  IVehiculosService,
  ApprovalStatus,
  EditField,
  ViewGridOptions,
  LookupHydrationResult,
  SemaforoConfig,
  GridColumn,
  SiteListRef,
  FieldRef,
  ParentValue,
} from "./IVehiculosService";

import type {
  ListMeta,
  Vehiculo,
  VehiculoDraft,
  RawVehiculo,
  FieldProveedorInfo,
} from "../models/types";

import { dtoToVehiculos } from "../utils/mappers";
import { normalizeBooleanValue } from "../utils/booleans";

/** =========================
 * Tipos internos
 * ========================= */
type GridRow = Record<string, unknown>;

interface ViewInfoLite {
  ViewQuery?: string;
  RowLimit?: number;
  HtmlSchemaXml?: string;
}

type RenderListDataQuery = Parameters<typeof spPost>[0];

type CacheEntry<T> = { value: Promise<T>; ts: number };

class SimplePromiseCache {
  private map: Map<string, CacheEntry<unknown>> = new Map();

  constructor(private ttlMs: number = 10 * 60 * 1000) {}

  public get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.map.get(key) as CacheEntry<T> | undefined;
    if (hit && now - hit.ts < this.ttlMs) return hit.value;

    const value = factory().catch((e: unknown) => {
      this.map.delete(key);
      throw e;
    });

    this.map.set(key, { value, ts: now });
    return value;
  }

  public clear(prefix?: string): void {
    if (!prefix) {
      this.map.clear();
      return;
    }
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }
}

const SHARED_CACHE = new SimplePromiseCache(10 * 60 * 1000);

const perfEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("cncoGridPerf") === "1";
  } catch {
    return false;
  }
};

const perfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/** =========================
 * RenderListDataAsStream paging token helpers
 * ========================= */
type PagedToken = {
  paging?: string; // NextHref
  viewId: string;
  listId: string;
  toggleField?: string;
  sortField?: string;
  /** Normalizado: siempre boolean */
  sortDesc: boolean;
};

// unicode-safe base64
const b64Encode = (s: string): string =>
  btoa(
    encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );

const b64Decode = (s: string): string =>
  decodeURIComponent(
    Array.prototype.map
      .call(
        atob(s),
        (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
      )
      .join("")
  );

const encodeToken = (t: PagedToken): string => b64Encode(JSON.stringify(t));
const decodeToken = (s: string): PagedToken =>
  JSON.parse(b64Decode(s)) as PagedToken;

type RenderListDataResult = { Row?: GridRow[]; NextHref?: string };

/**
 * Campos “de sistema” y “fantasma” típicos en vistas (no siempre resolubles via fields API)
 * Si aparecen en ViewFields / HtmlSchemaXml, rompen getByInternalNameOrTitle o CAML si no se filtran.
 */
const SYS_FIELDS: string[] = [
  "ID",
  "ContentType",
  "Attachments",
  "Modified",
  "Editor",
  "Created",
  "Author",
  "_UIVersionString",
  "FileSystemObjectType",
  "ContentTypeId",

  // Vistas/Document Library típicos
  "DocIcon",
  "LinkTitle",
  "LinkTitle2",
  "LinkTitleNoMenu",
  "LinkTitleNoMenu2",
  "Edit",
  "FileRef",
  "FileDirRef",
  "FileLeafRef",
  "File_x0020_Type",
  "FSObjType",
  "EncodedAbsUrl",
  "GUID",
  "UniqueId",
  "_ModerationStatus",
  "CheckoutUser",
  "CheckedOutTitle",
  "CheckedOutUserId",
  "AppAuthor",
  "AppEditor",
];

const normalizeViewName = (n: string): string =>
  /^LinkTitle/i.test(n) ? "Title" : n;

const extractStringArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const candidates: unknown[] = [o.Items, o.results, o.value];
    for (const c of candidates) {
      if (Array.isArray(c)) return c.map(String);
    }
  }
  return [];
};

export class SPVehiculosService implements IVehiculosService {
  constructor(private sp: SPFI, private listId?: string) {}

  /** Lista base */
  private l(): IList {
    if (!this.listId) throw new Error("No se configuró la lista.");
    return this.sp.web.lists.getById(this.listId);
  }

  // ============================================================
  // Anti-duplicados (sin Promise.finally para TS/lib viejos)
  // ============================================================
  private inflight = new Map<string, Promise<unknown>>();

  private once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const hit = this.inflight.get(key) as Promise<T> | undefined;
    if (hit) return hit;

    const p = run();
    const wrapped = p.then(
      (res) => {
        this.inflight.delete(key);
        return res;
      },
      (err) => {
        this.inflight.delete(key);
        throw err;
      }
    );

    this.inflight.set(key, wrapped as unknown as Promise<unknown>);
    return wrapped;
  }

  private sharedCacheKey(key: string): string {
    return key;
  }

  private trace(stage: string, startedAt: number, extra?: Record<string, unknown>): void {
    if (!perfEnabled()) return;
    const ms = Math.round((perfNow() - startedAt) * 10) / 10;
    const prefix = `[SPVehiculosService:${this.listId || "no-list"}]`;
    if (extra) {
      // eslint-disable-next-line no-console
      console.log(prefix, stage, `${ms}ms`, extra);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(prefix, stage, `${ms}ms`);
  }

  // ============================================================
  // ✅ Helpers de robustez para vistas/fields
  // ============================================================
  private isSysOrSkippableField(name: string): boolean {
    const n = String(name || "").trim();
    if (!n) return true;

    if (SYS_FIELDS.indexOf(n) !== -1) return true;
    if (/^LinkTitle/i.test(n)) return true;
    if (/^_/.test(n)) return true;
    if (/^OData__/.test(n)) return true;

    return false;
  }

  private async tryGetFieldMetaFromList(
    list: IList,
    name: string
  ): Promise<EditField | null> {
    const n = String(name || "").trim();
    if (!n) return null;
    if (this.isSysOrSkippableField(n)) return null;

    try {
      const f = (await list.fields
        .getByInternalNameOrTitle(n)
        .select(
          "InternalName",
          "Title",
          "TypeAsString",
          "Required",
          "ReadOnlyField",
          "LookupList",
          "AllowMultipleValues",
          "Choices"
        )()) as {
        InternalName: string;
        Title: string;
        TypeAsString: string;
        Required: boolean;
        ReadOnlyField: boolean;
        LookupList?: string;
        AllowMultipleValues?: boolean;
        Choices?: string[];
      };

      return {
        internalName: f.InternalName,
        title: f.Title,
        type: f.TypeAsString,
        required: Boolean(f.Required),
        readOnly: Boolean(f.ReadOnlyField),
        allowMultiple: Boolean(f.AllowMultipleValues),
        lookupListId: f.LookupList,
        choices: f.Choices,
      };
    } catch {
      return null;
    }
  }

  // ============================================================
  // ✅ RenderListDataAsStream (sin .clone)
  // ============================================================
  private async renderListDataAsStreamSafe(
    list: IList,
    parameters: Record<string, unknown>
  ): Promise<RenderListDataResult> {
    const anyList = list as unknown as {
      concat?: (suffix: string) => RenderListDataQuery;
      getParent?: () => {
        concat?: (suffix: string) => RenderListDataQuery;
      };
    };

    // armamos la llamada al endpoint /RenderListDataAsStream sin usar .clone
    const q: RenderListDataQuery | undefined =
      typeof anyList.concat === "function"
        ? anyList.concat("/RenderListDataAsStream")
        : anyList.getParent?.().concat?.("/RenderListDataAsStream");

    if (!q) {
      throw new Error(
        "No pude construir el endpoint RenderListDataAsStream (faltan clone/concat/getParent en esta versión de PnPjs)."
      );
    }

    // IMPORTANTE: SharePoint espera { parameters: {...} }
    return (await spPost(q, body({ parameters }))) as RenderListDataResult;
  }

  // ============================================================
  // Updates rápidos / aprobación
  // ============================================================
  public async updateItemFields(
    id: number,
    fields: Record<string, unknown>
  ): Promise<void> {
    await this.l().items.getById(id).update(fields);
  }

  /**
   * ✅ NUEVO: lectura rápida de campos puntuales (para polling wfstatus/wferror, etc.)
   */
  public async getItemFields(
    id: number,
    internalNames: string[]
  ): Promise<Record<string, unknown>> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    return this.getItemFieldsFromList(this.listId, id, internalNames);
  }

  public async setApprovalStatus(
    id: number,
    status: ApprovalStatus | string,
    reason?: string,
    fields?: { statusField?: string; reasonField?: string }
  ): Promise<void> {
    if (!this.listId) throw new Error("No se configuró la lista.");

    const statusField = String(fields?.statusField || "ApprovalStatus");
    const reasonField = String(fields?.reasonField || "ApprovalReason");

    const payload: Record<string, unknown> = { [statusField]: status };
    payload[reasonField] = reason ? String(reason) : "";

    await this.l().items.getById(id).update(payload);
  }

  public async setApprovalStatusOnList(
    listId: string,
    id: number,
    status: ApprovalStatus | string,
    reason?: string,
    fields?: { statusField?: string; reasonField?: string }
  ): Promise<void> {
    const statusField = String(fields?.statusField || "ApprovalStatus");
    const reasonField = String(fields?.reasonField || "ApprovalReason");

    const payload: Record<string, unknown> = { [statusField]: status };
    payload[reasonField] = reason ? String(reason) : "";

    await this.sp.web.lists.getById(listId).items.getById(id).update(payload);
  }

  // ============================================================
  // Base (vehículos)
  // ============================================================
  public async getMeta(): Promise<ListMeta> {
    if (!this.listId) throw new Error("No se configuró la lista.");

    const key = `meta:${this.listId}`;
    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const t0 = perfNow();
      const [info, field] = await Promise.all([
        this.l().select("Id")() as Promise<{ Id: string }>,
        this.l()
          .fields.getByInternalNameOrTitle("proveedor")
          .select("LookupList", "AllowMultipleValues")() as Promise<FieldProveedorInfo>,
      ]);

      let provOptions: Array<{ key: number; text: string }> = [];
      if (field.LookupList) {
        const provs = (await this.sp.web.lists
          .getById(field.LookupList)
          .items.select("Id", "Title")
          .top(500)()) as Array<{ Id: number; Title?: string }>;
        provOptions = provs.map((x) => ({ key: x.Id, text: x.Title || "" }));
      }

      const meta: ListMeta = {
        listId: info.Id,
        provMulti: Boolean(field.AllowMultipleValues),
        provOptions,
      };
      this.trace("getMeta", t0, { listId: this.listId, lookupOptions: provOptions.length });
      return meta;
    });
  }

  public async listRawByView(viewId: string, boolField?: string): Promise<GridRow[]> {
    const t0 = perfNow();
    const view = this.l().views.getById(viewId);
    const v = (await view.select("ViewQuery", "RowLimit")()) as ViewInfoLite;

    const fieldNames = (await this.getViewFieldNames(viewId, true)).map(normalizeViewName);

    const requested = Array.from(new Set<string>(["Title", ...fieldNames]));
    if (boolField && requested.indexOf(boolField) === -1) requested.push(boolField);

    const metas = await this.getFieldsMeta(requested);
    const validSet = new Set<string>(metas.map((m) => m.internalName));

    const validNames: string[] = ["ID"];
    if (validSet.has("Title")) validNames.push("Title");
    for (const n of requested) {
      if (n === "Title") continue;
      if (validSet.has(n)) validNames.push(n);
    }

    const viewFields = validNames
      .map((n) => `<FieldRef Name='${this.escapeXmlAttr(n)}'/>`)
      .join("");

    const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 100;

    const inner = String(v.ViewQuery || "").trim();
    const queryXml = inner ? `<Query>${inner}</Query>` : `<Query />`;

    const viewXml = `
      <View>
        ${queryXml}
        <ViewFields>${viewFields}</ViewFields>
        <RowLimit>${rowLimit}</RowLimit>
      </View>
    `.trim();

    const rowsUnknown = (await this.l().getItemsByCAMLQuery({
      ViewXml: viewXml,
    })) as unknown;

    const rows: GridRow[] = Array.isArray(rowsUnknown) ? (rowsUnknown as GridRow[]) : [];

    if (boolField) {
      for (const r of rows) r[boolField] = normalizeBooleanValue(r[boolField]);
    }

    const hydrated = await this.hydrateLookupTexts(rows, metas);
    this.trace("listRawByView", t0, {
      viewId,
      rows: hydrated.items.length,
      lookupFields: Object.keys(hydrated.lookupOpts).length,
    });
    return hydrated.items;
  }

  public async getViewGrid(
    viewId: string,
    boolField?: string,
    options?: ViewGridOptions
  ): Promise<{ columns: GridColumn[]; items: GridRow[]; listId: string }> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    const t0 = perfNow();

    const names = (await this.getViewFieldNames(viewId, true)).map(normalizeViewName);
    const metas = await this.getFieldsMeta(names);
    this.trace("getViewGrid.schema", t0, { viewId, fields: names.length, metas: metas.length });

    const columns: GridColumn[] = metas.map((m) => ({
      key: m.internalName,
      name: m.title,
      fieldName: m.internalName,
      minWidth: 120,
      isResizable: true,
    }));

    const items = await this.listRawByView(viewId, boolField);
    if (options?.resolveLookups === false) {
      this.trace("getViewGrid.itemsRaw", t0, { viewId, rows: items.length, resolveLookups: false });
      return { columns, items, listId: this.listId };
    }

    const hydrated = await this.hydrateLookupTexts(items, metas);
    this.trace("getViewGrid.hydrate", t0, {
      viewId,
      rows: hydrated.items.length,
      lookupFields: Object.keys(hydrated.lookupOpts).length,
    });
    return { columns, items: hydrated.items, listId: this.listId };
  }

  public async getAllViewGrid(
    viewId: string,
    boolField?: string,
    options?: ViewGridOptions
  ): Promise<{ columns: GridColumn[]; items: GridRow[]; listId: string }> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    if (!viewId) throw new Error("viewId requerido");

    const pageSize = 200;
    const allItems: GridRow[] = [];
    let columns: GridColumn[] = [];
    let pagingToken: string | undefined = undefined;
    let safety = 0;

    while (safety < 500) {
      safety += 1;

      const page = await this.getViewGridPaged(
        viewId,
        pageSize,
        pagingToken,
        boolField,
        undefined,
        undefined,
        options
      );

      if (!columns.length) columns = page.columns;
      if (Array.isArray(page.items) && page.items.length) {
        allItems.push(...page.items);
      }

      if (!page.nextToken) break;
      pagingToken = page.nextToken;
    }

    return { columns, items: allItems, listId: this.listId };
  }

  public async getListGridPaged(
    listId: string,
    pageSize: number,
    pagingToken?: string,
    options?: ViewGridOptions
  ): Promise<{
    columns: GridColumn[];
    items: GridRow[];
    listId: string;
    nextToken?: string;
  }> {
    if (!listId) throw new Error("listId requerido");
    const t0 = perfNow();

    const onceKey = ["getListGridPaged:v1", listId, String(pageSize || 0), pagingToken || ""].join("|");

    return this.once(onceKey, async () => {
      const list = this.sp.web.lists.getById(listId);

      const fieldRefs = await this.getListFields(listId);
      const requested = Array.from(
        new Set<string>(["ID", ...fieldRefs.map((f) => normalizeViewName(f.internalName))])
      );

      const detailedMetas = await this.getFieldsMetaFromList(listId, requested.filter((n) => n !== "ID"));
      const detailedMap = new Map<string, EditField>(
        detailedMetas.map((m) => [m.internalName.toLowerCase(), m])
      );

      const metas = requested
        .filter((n) => n !== "ID")
        .map((name) => {
          const raw = fieldRefs.find((f) => f.internalName.toLowerCase() === name.toLowerCase());
          const hit = detailedMap.get(name.toLowerCase());
          return (
            hit || {
              internalName: raw?.internalName ?? name,
              title: raw?.title ?? name,
              type: raw?.type ?? "Text",
              required: false,
              readOnly: false,
              allowMultiple: false,
            }
          ) as EditField;
        });

      const columns: GridColumn[] = metas.map((m) => ({
        key: m.internalName,
        name: m.title,
        fieldName: m.internalName,
        minWidth: 120,
        isResizable: true,
      }));

      const validNames = ["ID", ...metas.map((m) => m.internalName)];
      const viewFields = validNames
        .map((n) => `<FieldRef Name='${this.escapeXmlAttr(n)}'/>`)
        .join("");

      const rowLimit = Math.max(1, Number(pageSize) || 30);
      const viewXml = `
        <View>
          <ViewFields>${viewFields}</ViewFields>
          <RowLimit Paged="TRUE">${rowLimit}</RowLimit>
        </View>
      `.trim();

      const parameters: Record<string, unknown> = {
        ViewXml: viewXml,
        RenderOptions: 2,
        AddRequiredFields: true,
      };
      if (pagingToken) parameters.Paging = pagingToken;

      const data = await this.renderListDataAsStreamSafe(list, parameters);
      const rows: GridRow[] = Array.isArray(data?.Row) ? data.Row : [];

      const items =
        options?.resolveLookups === false ? rows : (await this.hydrateLookupTexts(rows, metas)).items;

      const nextHref = data?.NextHref || undefined;
      const nextToken = nextHref ? nextHref : undefined;

      this.trace("getListGridPaged", t0, {
        listId,
        rows: items.length,
        lookupFields: options?.resolveLookups === false ? 0 : metas.filter((m) => m.type === "Lookup" || m.type === "User").length,
      });

      return { columns, items, listId, nextToken };
    });
  }

  /**
   * Paginado server-side con RenderListDataAsStream.
   * Implementa sortField/sortDesc estable.
   */
  public async getViewGridPaged(
    viewId: string,
    pageSize: number,
    pagingToken?: string,
    boolField?: string,
    sortField?: string,
    sortDesc?: boolean,
    options?: ViewGridOptions
  ): Promise<{
    columns: GridColumn[];
    items: GridRow[];
    listId: string;
    nextToken?: string;
  }> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    if (!viewId) throw new Error("viewId requerido");
    const t0 = perfNow();

    const sortFieldNormRaw = String(sortField ?? "").trim();
    const sortFieldNorm =
      sortFieldNormRaw.length > 0 ? normalizeViewName(sortFieldNormRaw) : undefined;

    const sortDescNorm = sortDesc === true;

    const onceKey = [
      "getViewGridPaged:v1",
      this.listId,
      viewId,
      String(pageSize || 0),
      pagingToken || "",
      boolField || "",
      sortFieldNorm || "",
      sortDescNorm ? "1" : "0",
    ].join("|");

    return this.once(onceKey, async () => {
      let paging: string | undefined;

      if (pagingToken) {
        try {
          const t = decodeToken(pagingToken);

          const tokenSortField = String(t.sortField ?? "").trim().toLowerCase();
          const reqSortField = String(sortFieldNorm ?? "").trim().toLowerCase();

          const same =
            t.viewId === viewId &&
            t.listId === this.listId &&
            String(t.toggleField ?? "") === String(boolField ?? "") &&
            tokenSortField === reqSortField &&
            (t.sortDesc === true) === sortDescNorm;

          if (same) paging = t.paging;
        } catch {
          paging = undefined;
        }
      }

      const view = this.l().views.getById(viewId);
      const v = (await view.select("ViewQuery")()) as ViewInfoLite;

      const fieldNames = (await this.getViewFieldNames(viewId, true)).map(normalizeViewName);
      this.trace("getViewGridPaged.schemaNames", t0, { viewId, fields: fieldNames.length });

      const names = Array.from(new Set<string>(["ID", "Title", ...fieldNames]));
      if (boolField && names.indexOf(boolField) === -1) names.push(boolField);
      if (sortFieldNorm && names.indexOf(sortFieldNorm) === -1) names.push(sortFieldNorm);

      const metas = await this.getFieldsMeta(names.filter((n) => n !== "ID"));
      this.trace("getViewGridPaged.schemaMeta", t0, { viewId, metas: metas.length });

      const columns: GridColumn[] = metas.map((m) => ({
        key: m.internalName,
        name: m.title,
        fieldName: m.internalName,
        minWidth: 120,
        isResizable: true,
      }));

      const validSet = new Set<string>(metas.map((m) => m.internalName));
      const validNames: string[] = ["ID"].concat(names.filter((n) => n !== "ID" && validSet.has(n)));

      if (validNames.indexOf("Title") === -1 && validSet.has("Title")) {
        validNames.splice(1, 0, "Title");
      }

      const viewFields = validNames
        .map((n) => `<FieldRef Name='${this.escapeXmlAttr(n)}'/>`)
        .join("");

      const rowLimit = Math.max(1, Number(pageSize) || 30);

      const orderByXml =
        sortFieldNorm && validSet.has(sortFieldNorm)
          ? `<OrderBy>
              <FieldRef Name='${this.escapeXmlAttr(
                sortFieldNorm
              )}' Ascending='${sortDescNorm ? "FALSE" : "TRUE"}' />
              <FieldRef Name='ID' Ascending='TRUE' />
            </OrderBy>`
          : "";

      const queryInner = this.applyOrderByToViewQuery(v.ViewQuery || "", orderByXml);

      const queryXml =
        queryInner && queryInner.trim().length > 0 ? `<Query>${queryInner}</Query>` : `<Query />`;

      const viewXml = `
        <View>
          ${queryXml}
          <ViewFields>${viewFields}</ViewFields>
          <RowLimit Paged="TRUE">${rowLimit}</RowLimit>
        </View>
      `.trim();

      const parameters: Record<string, unknown> = {
        ViewXml: viewXml,
        RenderOptions: 2,
        AddRequiredFields: true,
      };
      if (paging) parameters.Paging = paging;

      // ✅ CAMBIO CLAVE: sin clone
      const data = await this.renderListDataAsStreamSafe(this.l(), parameters);
      this.trace("getViewGridPaged.renderData", t0, {
        viewId,
        rows: Array.isArray(data?.Row) ? data.Row.length : 0,
      });

      const rows: GridRow[] = Array.isArray(data?.Row) ? data.Row : [];

      if (boolField) {
        for (const r of rows) r[boolField] = normalizeBooleanValue(r[boolField]);
      }

      const items =
        options?.resolveLookups === false ? rows : (await this.hydrateLookupTexts(rows, metas)).items;
      if (options?.resolveLookups === false) {
        this.trace("getViewGridPaged.itemsRaw", t0, { viewId, rows: items.length, resolveLookups: false });
      } else {
        this.trace("getViewGridPaged.hydrate", t0, { viewId, rows: items.length });
      }

      const nextHref = data?.NextHref || undefined;
      const nextToken = nextHref
        ? encodeToken({
            paging: nextHref,
            viewId,
            listId: this.listId as string,
            toggleField: boolField,
            sortField: sortFieldNorm,
            sortDesc: sortDescNorm,
          })
        : undefined;

      return { columns, items, listId: this.listId as string, nextToken };
    });
  }

  public async list(viewId?: string, boolField?: string): Promise<Vehiculo[]> {
    if (viewId) {
      const view = this.l().views.getById(viewId);
      const v = (await view.select("ViewQuery", "RowLimit")()) as ViewInfoLite;

      const fieldNames = (await this.getViewFieldNames(viewId, true)).map(normalizeViewName);

      const requested = Array.from(new Set<string>(["Title", ...fieldNames]));
      if (boolField && requested.indexOf(boolField) === -1) requested.push(boolField);

      const metas = await this.getFieldsMeta(requested);
      const validSet = new Set<string>(metas.map((m) => m.internalName));

      const validNames: string[] = ["ID"];
      if (validSet.has("Title")) validNames.push("Title");
      for (const n of requested) {
        if (n === "Title") continue;
        if (validSet.has(n)) validNames.push(n);
      }

      const viewFields = validNames
        .map((n) => `<FieldRef Name='${this.escapeXmlAttr(n)}'/>`)
        .join("");

      const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 100;

      const inner = String(v.ViewQuery || "").trim();
      const queryXml = inner ? `<Query>${inner}</Query>` : `<Query />`;

      const viewXml = `
        <View>
          ${queryXml}
          <ViewFields>${viewFields}</ViewFields>
          <RowLimit Paged="TRUE">${rowLimit}</RowLimit>
        </View>
      `.trim();

      const rowsUnknown = (await this.l().getItemsByCAMLQuery({
        ViewXml: viewXml,
      })) as unknown;

      const rows: GridRow[] = Array.isArray(rowsUnknown) ? (rowsUnknown as GridRow[]) : [];

      return rows.map((r) => {
        const id = (r.ID ?? (r as Record<string, unknown>).Id) as number | undefined;

        const provId = (r as Record<string, unknown>).ProveedorId as unknown;
        const provIds = Array.isArray(provId)
          ? (provId as number[])
          : typeof provId === "number"
          ? [provId]
          : [];

        const toggle = boolField
          ? normalizeBooleanValue((r as Record<string, unknown>)[boolField])
          : undefined;

        return {
          id: typeof id === "number" ? id : 0,
          placa: String((r as Record<string, unknown>).Title || ""),
          marca: (r as Record<string, unknown>).marca as string | undefined,
          modelo: (r as Record<string, unknown>).modelo as string | undefined,
          proveedorIds: provIds,
          proveedorTitles: [],
          toggle,
        };
      });
    }

    const selects: string[] = ["Id", "Title", "marca", "modelo", "Proveedor/Id", "Proveedor/Title"];
    if (boolField) selects.push(boolField);

    const data = (await this.l()
      .items.select(...selects)
      .expand("Proveedor")
      .top(100)()) as unknown as RawVehiculo[];

    const mapped = dtoToVehiculos(data);
    if (boolField) {
      for (let i = 0; i < mapped.length; i++) {
        const row = data[i] as unknown as Record<string, unknown>;
        mapped[i].toggle = normalizeBooleanValue(row[boolField]);
      }
    }
    return mapped;
  }

  public async add(draft: VehiculoDraft): Promise<void> {
    const bodyObj: Record<string, unknown> = {
      Title: draft.placa,
      marca: draft.marca,
      modelo: draft.modelo,
    };

    bodyObj.ProveedorId = Array.isArray(draft.proveedorId)
      ? { results: draft.proveedorId }
      : draft.proveedorId ?? undefined;

    await this.l().items.add(bodyObj);
  }

  public async update(id: number, draft: VehiculoDraft): Promise<void> {
    const bodyObj: Record<string, unknown> = {
      Title: draft.placa,
      marca: draft.marca,
      modelo: draft.modelo,
    };

    bodyObj.ProveedorId = Array.isArray(draft.proveedorId)
      ? { results: draft.proveedorId }
      : draft.proveedorId ?? undefined;

    await this.l().items.getById(id).update(bodyObj);
  }

  public async recycle(id: number): Promise<void> {
    await this.l().items.getById(id).recycle();
  }

  public async setBoolean(id: number, fieldInternalName: string, value: boolean): Promise<void> {
    await this.l().items.getById(id).update({ [fieldInternalName]: value });
  }

  public async userInGroup(groupName: string): Promise<boolean> {
    const gps = await this.sp.web.currentUser.groups();
    const target = String(groupName).toLowerCase();
    return (
      gps?.some((g: { Title?: string }) => String(g?.Title).toLowerCase() === target) || false
    );
  }

  // ============================================================
  // Metadatos (lista base)
  // ============================================================
  public async getViewFieldNames(viewId: string, includeSystemFields = false): Promise<string[]> {
    if (!this.listId) throw new Error("No se configuró la lista.");

    const key = `viewFieldNames:${this.listId}:${viewId}:${includeSystemFields ? "1" : "0"}`;
    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const view = this.l().views.getById(viewId);

      try {
        const raw = (await (view as unknown as { fields: () => Promise<unknown> }).fields()) as unknown;
        const arr = extractStringArray(raw);
        if (arr.length) {
          return arr
            .map(normalizeViewName)
            .filter((n) => includeSystemFields || !this.isSysOrSkippableField(n));
        }
      } catch {
        // fallback a HtmlSchemaXml
      }

      const info = (await view.select("HtmlSchemaXml")()) as { HtmlSchemaXml?: string };
      const xml = String(info?.HtmlSchemaXml || "");
      const matches = xml.match(/FieldRef\s+Name="([^"]+)"/g) || [];
      const parsed = matches
        .map((m) => /FieldRef\s+Name="([^"]+)"/.exec(m)?.[1])
        .filter((s): s is string => Boolean(s));

      return parsed
        .map(normalizeViewName)
        .filter((n) => includeSystemFields || !this.isSysOrSkippableField(n));
    });
  }

  public async getFieldsMeta(fieldInternalNames: string[]): Promise<EditField[]> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    const t0 = perfNow();

    const cleaned = fieldInternalNames
      .map((x) => normalizeViewName(String(x || "").trim()))
      .filter((n) => n && !this.isSysOrSkippableField(n));

    const key = `fieldsMeta:${this.listId}:${cleaned
      .map((x) => x.toLowerCase())
      .sort()
      .join("|")}`;

    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const list = this.l();
      const metasMaybe = await Promise.all(cleaned.map(async (name) => this.tryGetFieldMetaFromList(list, name)));
      this.trace("getFieldsMeta", t0, {
        listId: this.listId,
        requested: cleaned.length,
        resolved: metasMaybe.filter((m): m is EditField => Boolean(m)).length,
      });
      return metasMaybe.filter((m): m is EditField => Boolean(m));
    });
  }

  public async getItemValues(id: number, schema: EditField[]): Promise<Record<string, unknown>> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    return this.getItemValuesFromList(this.listId, id, schema);
  }

  public async getLookupOptionsByListId(listId: string): Promise<Array<{ key: number; text: string }>> {
    const key = `lookupOpts:${listId}`;
    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const t0 = perfNow();
      const items = (await this.sp.web.lists
        .getById(listId)
        .items.select("Id", "Title")
        .top(500)()) as Array<{ Id: number; Title?: string }>;
      this.trace("getLookupOptionsByListId", t0, { listId, count: items.length });
      return items.map((x) => ({ key: x.Id, text: x.Title || "" }));
    });
  }

  public async updateFields(id: number, schema: EditField[], values: Record<string, unknown>): Promise<void> {
    if (!this.listId) throw new Error("No se configuró la lista.");
    await this.updateFieldsInList(this.listId, id, schema, values);
  }

  public async updateFieldsOnList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void> {
    await this.updateFieldsInList(listId, id, schema, values);
  }

  // ============================================================
  // Semáforo
  // ============================================================
  public async getTipoFormularioConfig(listTitle: string, keyField: string): Promise<SemaforoConfig> {
    const select = ["Id", "Title", "campo", "amarillo", keyField].join(",");
    const items = (await this.sp.web.lists
      .getByTitle(listTitle)
      .items.select(select)
      .top(5000)()) as Array<Record<string, unknown>>;

    const map: SemaforoConfig = {};
    for (const it of items) {
      const keyRaw = it[keyField] ?? it.Title;
      const key = String(keyRaw ?? "").trim().toLowerCase();
      const dateField = String(it.campo ?? "").trim();
      const warnDays = Number(it.amarillo) || 0;
      if (key && dateField) map[key] = { dateField, warnDays };
    }
    return map;
  }

  // ============================================================
  // Listas / campos
  // ============================================================
  public async listSiteLists(): Promise<SiteListRef[]> {
    const lists = (await this.sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")()) as Array<
      Record<string, unknown>
    >;

    return lists
      .filter((l) => !Boolean(l.Hidden))
      .map((l) => ({ id: String(l.Id), title: String(l.Title) }));
  }

  public async getListFields(listId: string): Promise<FieldRef[]> {
    const fields = (await this.sp.web.lists
      .getById(listId)
      .fields.select(
        "InternalName",
        "Title",
        "TypeAsString",
        "Hidden",
        "ReadOnlyField",
        "Sealed",
        "Choices",
        "LookupList",
        "AllowMultipleValues"
      )()) as Array<Record<string, unknown>>;

    return fields
      .filter((f) => !Boolean(f.Hidden) && !Boolean(f.Sealed))
      .map((f) => ({
        internalName: String(f.InternalName),
        title: String(f.Title || f.InternalName),
        type: String(f.TypeAsString),
      }));
  }

  // ============================================================
  // Relacionados
  // ============================================================
  public async getRelatedItems(params: {
    childListId: string;
    childField: string;
    parentValue: ParentValue;
  }): Promise<{ columns: GridColumn[]; items: GridRow[] }> {
    const { childListId, childField, parentValue } = params;

    const f = (await this.sp.web.lists
      .getById(childListId)
      .fields.getByInternalNameOrTitle(childField)
      .select("InternalName", "TypeAsString")()) as {
      InternalName: string;
      TypeAsString: string;
    };

    const { valueXml, fieldRefXml } = this.buildEqCaml(childField, f.TypeAsString, parentValue);

    const viewXml = `
      <View>
        <Query>
          <Where>
            <Eq>
              ${fieldRefXml}
              ${valueXml}
            </Eq>
          </Where>
        </Query>
        <RowLimit>200</RowLimit>
      </View>
    `.trim();

    const itemsUnknown = (await this.sp.web.lists
      .getById(childListId)
      .getItemsByCAMLQuery({ ViewXml: viewXml })) as unknown;

    const items = Array.isArray(itemsUnknown) ? (itemsUnknown as GridRow[]) : [];

    const columns: GridColumn[] = this.inferColumnsFromItems(items);
    return { columns, items };
  }

  public async getRelatedGridByView(
    childListId: string,
    childViewId: string,
    childField: string,
    parentValue: ParentValue
  ): Promise<{ columns: GridColumn[]; items: GridRow[] }> {
    const list = this.sp.web.lists.getById(childListId);

    const v = (await list.views
      .getById(childViewId)
      .select("ViewQuery", "RowLimit", "HtmlSchemaXml")()) as ViewInfoLite;

    const names = await this.getViewFieldNamesFromList(childListId, childViewId);
    const requested = Array.from(new Set<string>(["Title", ...names]));

    const metas = await this.getFieldsMetaFromList(childListId, requested);
    const validSet = new Set<string>(metas.map((m) => m.internalName));

    const validNames: string[] = ["ID"];
    if (validSet.has("Title")) validNames.push("Title");
    for (const n of requested) {
      if (n === "Title") continue;
      if (validSet.has(n)) validNames.push(n);
    }

    const viewFields = validNames
      .map((n) => `<FieldRef Name='${this.escapeXmlAttr(n)}'/>`)
      .join("");

    const fld = (await list.fields
      .getByInternalNameOrTitle(childField)
      .select("InternalName", "TypeAsString")()) as {
      InternalName: string;
      TypeAsString: string;
    };

    const { fieldRefXml, valueXml } = this.buildEqCaml(fld.InternalName, fld.TypeAsString, parentValue);

    const baseQuery = v.ViewQuery || "";
    const eqXml = `<Eq>${fieldRefXml}${valueXml}</Eq>`;

    const query = baseQuery.includes("<Where>")
      ? baseQuery.replace("<Where>", "<Where><And>").replace("</Where>", `${eqXml}</And></Where>`)
      : `<Where>${eqXml}</Where>${baseQuery}`;

    const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 200;

    const viewXml = `
      <View>
        <Query>${query}</Query>
        <ViewFields>${viewFields}</ViewFields>
        <RowLimit Paged="TRUE">${rowLimit}</RowLimit>
      </View>
    `.trim();

    const itemsUnknown = (await list.getItemsByCAMLQuery({
      ViewXml: viewXml,
    })) as unknown;

    const items = Array.isArray(itemsUnknown) ? (itemsUnknown as GridRow[]) : [];

    const columns: GridColumn[] = metas.map((m) => ({
      key: m.internalName,
      name: m.title,
      fieldName: m.internalName,
      minWidth: 120,
      isResizable: true,
    }));

    return { columns, items };
  }

  // ============================================================
  // Mini-form: vista/campos/valores/listas arbitrarias
  // ============================================================
  public async getViewFieldNamesFromList(listId: string, viewId: string): Promise<string[]> {
    const key = `viewFieldNames:${listId}:${viewId}`;
    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const list = this.sp.web.lists.getById(listId);
      return this.getViewFieldNamesFromListInternal(list as unknown as IList, viewId);
    });
  }

  public async getFieldsMetaFromList(listId: string, internalNames: string[]): Promise<EditField[]> {
    const cleaned = internalNames
      .map((x) => normalizeViewName(String(x || "").trim()))
      .filter((n) => n && !this.isSysOrSkippableField(n));

    const key = `fieldsMeta:${listId}:${cleaned
      .map((x) => x.toLowerCase())
      .sort()
      .join("|")}`;

    return SHARED_CACHE.get(this.sharedCacheKey(key), async () => {
      const list = this.sp.web.lists.getById(listId);

      const metasMaybe = await Promise.all(
        cleaned.map(async (name) => this.tryGetFieldMetaFromList(list as unknown as IList, name))
      );

      return metasMaybe.filter((m): m is EditField => Boolean(m));
    });
  }

  /**
   * ✅ NUEVO: lectura rápida de campos puntuales en una lista arbitraria
   */
  public async getItemFieldsFromList(
    listId: string,
    id: number,
    internalNames: string[]
  ): Promise<Record<string, unknown>> {
    const list = this.sp.web.lists.getById(listId);

    const fields = (internalNames || [])
      .map((n) => String(n || "").trim())
      .filter((n) => n.length > 0);

    // si no pidieron nada, devolvemos vacío (evita errores de .select() sin args)
    if (!fields.length) return {};

    const item = (await list.items.getById(id).select(...fields)()) as Record<string, unknown>;

    const out: Record<string, unknown> = {};
    for (const f of fields) out[f] = item[f];
    return out;
  }

  public async getItemValuesFromList(
    listId: string,
    id: number,
    schema: EditField[]
  ): Promise<Record<string, unknown>> {
    const list = this.sp.web.lists.getById(listId);

    const selects: string[] = [];
    const expands: string[] = [];

    for (const s of schema) {
      const n = s.internalName;
      if (s.type === "Lookup" || s.type === "User") {
        selects.push(`${n}/Id`, `${n}/Title`);
        expands.push(n);
      } else {
        selects.push(n);
      }
    }

    const item = (await list.items
      .getById(id)
      .select(...selects)
      .expand(...expands)()) as Record<string, unknown>;

    const values: Record<string, unknown> = {};
    for (const s of schema) {
      const n = s.internalName;
      const v = item[n];

      if (s.type === "Lookup" || s.type === "User") {
        if (s.allowMultiple) {
          const arr = Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
          values[n] = arr.map((x) => ({
            key: Number(x?.Id),
            text: String(x?.Title || ""),
          }));
        } else {
          const o = v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
          values[n] = o ? { key: Number(o.Id), text: String(o.Title || "") } : undefined;
        }
      } else {
        values[n] = v;
      }
    }

    return values;
  }

  public async updateFieldsInList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void> {
    const list = this.sp.web.lists.getById(listId);
    const bodyObj: Record<string, unknown> = {};

    for (const s of schema) {
      if (!(s.internalName in values) || s.readOnly) continue;

      const n = s.internalName;
      const val = values[n];

      if (s.type === "Lookup" || s.type === "User") {
        if (s.allowMultiple) {
          let ids: number[] = [];
          if (Array.isArray(val)) {
            ids = (val as unknown[]).map((x) => {
              if (typeof x === "number") return x;
              if (typeof x === "string") {
                const parsed = Number(x.trim());
                return Number.isNaN(parsed) ? NaN : parsed;
              }
              if (x && typeof x === "object" && "key" in (x as Record<string, unknown>)) {
                const k = (x as Record<string, unknown>).key;
                if (typeof k === "number") return k;
                if (typeof k === "string") {
                  const parsed = Number(k.trim());
                  return Number.isNaN(parsed) ? NaN : parsed;
                }
                return Number(k);
              }
              return NaN;
            });
            ids = ids.filter((num) => !Number.isNaN(num));
          }
          bodyObj[`${n}Id`] = { results: ids };
        } else {
          let idVal: number | undefined;
          if (typeof val === "number") idVal = val;
          else if (typeof val === "string") {
            const parsed = Number(val.trim());
            idVal = Number.isNaN(parsed) ? undefined : parsed;
          }
          else if (val && typeof val === "object" && "key" in (val as Record<string, unknown>)) {
            const k = (val as Record<string, unknown>).key;
            if (typeof k === "number") idVal = k;
            else if (typeof k === "string") {
              const parsed = Number(k.trim());
              idVal = Number.isNaN(parsed) ? undefined : parsed;
            } else {
              idVal = k !== undefined ? Number(k) : undefined;
            }
            if (idVal !== undefined && Number.isNaN(idVal)) idVal = undefined;
          }
          bodyObj[`${n}Id`] = idVal;
        }
      } else if (s.type === "MultiChoice") {
        bodyObj[n] = Array.isArray(val) ? (val as string[]).slice() : [];
      } else if (s.type === "Boolean") {
        bodyObj[n] = normalizeBooleanValue(val);
      } else if (s.type === "Number" || s.type === "Currency") {
        if (val === "" || val === undefined) bodyObj[n] = undefined;
        else {
          const num = Number(val);
          bodyObj[n] = Number.isNaN(num) ? undefined : num;
        }
      } else if (s.type === "DateTime") {
        bodyObj[n] = this.parseDateFlexible(val);
      } else {
        bodyObj[n] = val;
      }
    }

    await list.items.getById(id).update(bodyObj);
  }

  // ============================================================
  // Adjuntos
  // ============================================================
  public async listAttachments(
    listId: string,
    id: number
  ): Promise<Array<{ name: string; serverRelativeUrl: string }>> {
    const atts = (await this.sp.web.lists
      .getById(listId)
      .items.getById(id)
      .attachmentFiles()) as Array<Record<string, unknown>>;

    return (atts || []).map((a) => ({
      name: String(a.FileName),
      serverRelativeUrl: String(a.ServerRelativeUrl),
    }));
  }

  public async replaceAttachment(listId: string, id: number, file: File): Promise<void> {
    const item = this.sp.web.lists.getById(listId).items.getById(id);

    try {
      const current = (await item.attachmentFiles()) as Array<Record<string, unknown>>;
      if (current && current.length) {
        for (const c of current) {
          const fileName = String(c.FileName);
          try {
            await item.attachmentFiles.getByName(fileName).delete();
          } catch {
            // ignoro delete individual
          }
        }
      }
    } catch {
      // ignoro si no hay adjuntos
    }

    await item.attachmentFiles.add(file.name, file);
  }

  public clearCaches(): void {
    if (!this.listId) return;

    const prefixes = [
      `meta:${this.listId}`,
      `viewFieldNames:${this.listId}:`,
      `fieldsMeta:${this.listId}:`,
      `lookupOpts:${this.listId}`,
    ];

    for (const prefix of prefixes) {
      SHARED_CACHE.clear(prefix);
    }

  }

  // ============================================================
  // Helpers internos
  // ============================================================
  private inferColumnsFromItems(items: GridRow[]): GridColumn[] {
    const first = items && items[0] ? items[0] : {};
    const keys = Object.keys(first).filter((k) => !/^odata|^Id$|^GUID$/i.test(k));
    return keys.slice(0, 12).map((k) => ({
      key: k,
      name: k,
      fieldName: k,
      minWidth: 120,
      isResizable: true,
    }));
  }

  private parseDateFlexible(val: unknown): Date | undefined {
    if (!val) return undefined;

    if (val instanceof Date) {
      return Number.isNaN(val.getTime()) ? undefined : val;
    }

    const s = String(val).trim();
    if (!s) return undefined;

    const isoShort = /^(\d{4})-(\d{2})-(\d{2})$/;
    const m1 = isoShort.exec(s);
    if (m1) {
      const y = Number(m1[1]);
      const mo = Number(m1[2]);
      const d = Number(m1[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return Number.isNaN(dt.getTime()) ? undefined : dt;
    }

    const latam = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const m2 = latam.exec(s);
    if (m2) {
      const d = Number(m2[1]);
      const mo = Number(m2[2]);
      const y = Number(m2[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return Number.isNaN(dt.getTime()) ? undefined : dt;
    }

    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? undefined : dt;
  }

  private buildEqCaml(
    fieldInternal: string,
    typeAsString: string,
    value: ParentValue
  ): { fieldRefXml: string; valueXml: string } {
    const t = (s: string): string => s.toLowerCase();
    const xml = (s: unknown): string =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    if (t(typeAsString) === "lookup" || t(typeAsString) === "user") {
      const byId = typeof value === "number";
      const fieldRefXml = `<FieldRef Name='${fieldInternal}' ${byId ? "LookupId='TRUE'" : ""} />`;
      const valueXml = `<Value Type='Lookup'>${xml(value)}</Value>`;
      return { fieldRefXml, valueXml };
    }

    if (t(typeAsString) === "number" || t(typeAsString) === "currency") {
      return {
        fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
        valueXml: `<Value Type='Number'>${Number(value)}</Value>`,
      };
    }

    if (t(typeAsString) === "datetime") {
      const d = this.parseDateFlexible(value);
      const iso = d ? d.toISOString() : "";
      return {
        fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
        valueXml: `<Value IncludeTimeValue='TRUE' Type='DateTime'>${xml(iso)}</Value>`,
      };
    }

    if (t(typeAsString) === "boolean") {
      return {
        fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
        valueXml: `<Value Type='Boolean'>${normalizeBooleanValue(value) ? 1 : 0}</Value>`,
      };
    }

    return {
      fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
      valueXml: `<Value Type='Text'>${xml(String(value ?? ""))}</Value>`,
    };
  }

  public async hydrateLookupTexts(
    items: GridRow[],
    metas: EditField[]
  ): Promise<LookupHydrationResult> {
    const t0 = perfNow();
    const lookupMetas = metas.filter((m) => m.type === "Lookup" || m.type === "User");
    if (!lookupMetas.length || !items.length) {
      return { items, lookupOpts: {} };
    }

    const dicts: Record<string, Map<number, string>> = {};
    const lookupOpts: Record<string, Array<{ key: number; text: string }>> = {};

    await Promise.all(
      lookupMetas.map(async (m): Promise<void> => {
        if (!m.lookupListId) return;
        const opts = await this.getLookupOptionsByListId(m.lookupListId);
        lookupOpts[m.internalName] = opts;
        dicts[m.internalName] = new Map(opts.map((o) => [Number(o.key), String(o.text || "")]));
      })
    );

    const extractIds = (v: unknown): number[] => {
      // number
      if (typeof v === "number") return [v];

      // array
      if (Array.isArray(v)) {
        // array de numbers
        if (v.every((x) => typeof x === "number")) return (v as number[]).slice();

        // array de objetos {Id} o {key}
        const ids = (v as unknown[]).map((x) => {
          if (x && typeof x === "object") {
            const o = x as Record<string, unknown>;
            if (typeof o.Id === "number") return o.Id;
            if (typeof o.lookupId === "number") return o.lookupId;
            if ("key" in o) return Number(o.key);
          }
          return NaN;
        });
        return ids.filter((n) => !Number.isNaN(n));
      }

      // { results: [...] }
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const rr = o.results ?? o.value ?? o.Items;
        if (Array.isArray(rr)) return extractIds(rr);

        // Id puede venir number o string
        const idRaw = o.Id ?? o.id ?? o.LookupId ?? o.lookupId ?? o.ID ?? o.Id;

        if (typeof idRaw === "number") return [idRaw];
        if (typeof idRaw === "string") {
          const n = Number(idRaw);
          return Number.isNaN(n) ? [] : [n];
        }

        if ("key" in o) {
          const n = Number(o.key);
          return Number.isNaN(n) ? [] : [n];
        }
      }

      // "12;#ACME" o "12;#ACME;#35;#OTRO"
      if (typeof v === "string" && v.indexOf(";#") !== -1) {
        const parts = v.split(";#");
        const ids: number[] = [];
        for (let i = 0; i < parts.length; i += 2) {
          const n = Number(parts[i]);
          if (!Number.isNaN(n)) ids.push(n);
        }
        return ids;
      }

      // string numérica
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isNaN(n) ? [] : [n];
      }

      return [];
    };

    const hydrated = items.map((row) => {
      const r: GridRow = { ...row };

      for (const m of lookupMetas) {
        const mapIds = dicts[m.internalName];
        if (!mapIds) continue;

        // probamos varias formas comunes en respuestas SP
        const candidates = [
          this.getValueByNameInsensitive(r, `${m.internalName}Id`),
          this.getValueByNameInsensitive(r, `${m.internalName}_Id`),
          this.getValueByNameInsensitive(r, m.internalName), // a veces viene "12;#ACME..."
          this.getValueByNameInsensitive(r, `${m.internalName}.Id`),
        ];

        let ids: number[] = [];
        for (const c of candidates) {
          ids = extractIds(c);
          if (ids.length) break;
        }

        if (!ids.length) continue;

        if (m.allowMultiple) {
          r[m.internalName] = ids.map((id) => mapIds.get(id) ?? String(id));
        } else {
          const id = ids[0];
          r[m.internalName] = mapIds.get(id) ?? String(id);
        }
      }

      return r;
    });
    this.trace("hydrateLookupTexts", t0, {
      rows: hydrated.length,
      lookupFields: Object.keys(lookupOpts).length,
    });
    return { items: hydrated, lookupOpts };
  }

  private async getViewFieldNamesFromListInternal(list: IList, viewId: string): Promise<string[]> {
    try {
      const raw = (await (list.views.getById(viewId) as unknown as { fields: () => Promise<unknown> }).fields()) as unknown;
      const arr = extractStringArray(raw);
      if (arr.length) {
        return arr.map(normalizeViewName).filter((n) => !this.isSysOrSkippableField(n));
      }
    } catch {
      // fallback a HtmlSchemaXml
    }

    const info = (await list.views.getById(viewId).select("HtmlSchemaXml")()) as { HtmlSchemaXml?: string };

    const xml = String(info?.HtmlSchemaXml || "");
    const matches = xml.match(/FieldRef\s+Name="([^"]+)"/g) || [];
    const parsed = matches
      .map((m) => /FieldRef\s+Name="([^"]+)"/.exec(m)?.[1])
      .filter((s): s is string => Boolean(s));

    return parsed.map(normalizeViewName).filter((n) => !this.isSysOrSkippableField(n));
  }

  // ===== helpers para sort =====
  private applyOrderByToViewQuery(viewQuery: string, orderByXml: string): string {
    const q = String(viewQuery || "");

    if (!orderByXml) {
      return q.replace(/<OrderBy[\s\S]*?<\/OrderBy>/gi, "");
    }

    const withoutOrder = q.replace(/<OrderBy[\s\S]*?<\/OrderBy>/gi, "");

    const groupByMatch = /<GroupBy\b[\s\S]*?<\/GroupBy>/i.exec(withoutOrder);
    if (groupByMatch && groupByMatch.index !== undefined) {
      const idx = groupByMatch.index;
      return `${withoutOrder.slice(0, idx)}${orderByXml}${withoutOrder.slice(idx)}`;
    }

    return `${withoutOrder}${orderByXml}`;
  }

  private escapeXmlAttr(v: string): string {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private getValueByNameInsensitive(row: GridRow, name: string): unknown {
    const target = String(name || "").trim();
    if (!target) return undefined;

    if (Object.prototype.hasOwnProperty.call(row, target)) return row[target];

    const targetLower = target.toLowerCase();
    for (const key of Object.keys(row)) {
      if (String(key).toLowerCase() === targetLower) return row[key];
    }

    return undefined;
  }
}
