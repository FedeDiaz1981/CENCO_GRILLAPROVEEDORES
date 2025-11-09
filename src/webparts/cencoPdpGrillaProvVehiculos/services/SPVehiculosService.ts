// services/SPVehiculosService.ts
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";
import "@pnp/sp/site-users/web";
import "@pnp/sp/site-groups";
import "@pnp/sp/views";
import "@pnp/sp/attachments";

import {
  IVehiculosService,
  EditField,
  SemaforoConfig,
  GridColumn,
  SiteListRef,
  FieldRef,
} from "./IVehiculosService";
import {
  ListMeta,
  Vehiculo,
  VehiculoDraft,
  RawVehiculo,
  FieldProveedorInfo,
} from "../models/types";
import { dtoToVehiculos } from "../utils/mappers";

interface ViewInfoLite {
  ViewQuery?: string;
  RowLimit?: number;
}

const SYS_FIELDS = [
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
];
const normalizeViewName = (n: string) => (/^LinkTitle/i.test(n) ? "Title" : n);

export class SPVehiculosService implements IVehiculosService {
  constructor(private sp: SPFI, private listId?: string) {}

  private l() {
    if (!this.listId) throw new Error("No se configuró la lista.");
    return this.sp.web.lists.getById(this.listId);
  }

  // ===== Base (vehículos)
  public async getMeta(): Promise<ListMeta> {
    const [info, field] = await Promise.all([
      this.l().select("Id")() as Promise<{ Id: string }>,
      this.l()
        .fields.getByInternalNameOrTitle("Proveedor")
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
    return { listId: info.Id, provMulti: !!field.AllowMultipleValues, provOptions };
  }

  public async listRawByView(viewId: string, boolField?: string): Promise<any[]> {
    const view = this.l().views.getById(viewId);
    const v = (await view.select("ViewQuery", "RowLimit")()) as ViewInfoLite;
    const fieldNames = (await this.getViewFieldNames(viewId)).map(normalizeViewName);
    const names = Array.from(new Set<string>(["ID", "Title", ...fieldNames]));
    if (boolField && names.indexOf(boolField) === -1) names.push(boolField);

    const viewFields = names.map((n) => `<FieldRef Name='${n}'/>`).join("");
    const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 100;
    const viewXml = `
      <View>
        <Query>${v.ViewQuery || ""}</Query>
        <ViewFields>${viewFields}</ViewFields>
        <RowLimit>${rowLimit}</RowLimit>
      </View>
    `.trim();

    const rows = (await this.l().getItemsByCAMLQuery({ ViewXml: viewXml })) as Array<any>;
    return rows || [];
  }

  // 👉 ahora devuelve también listId (prop extra; compatible con la interfaz)
  public async getViewGrid(
    viewId: string,
    boolField?: string
  ): Promise<{ columns: GridColumn[]; items: any[]; listId: string }> {
    const names = (await this.getViewFieldNames(viewId)).map(normalizeViewName);
    const metas = await this.getFieldsMeta(names);

    const columns: GridColumn[] = metas.map((m) => ({
      key: m.internalName,
      name: m.title,
      fieldName: m.internalName,
      minWidth: 120,
      isResizable: true,
    }));

    let items = await this.listRawByView(viewId, boolField);
    items = await this.resolveLookupTexts(items, metas);

    return { columns, items, listId: this.listId! };
  }

  public async list(viewId?: string, boolField?: string): Promise<Vehiculo[]> {
    if (viewId) {
      const view = this.l().views.getById(viewId);
      const v = (await view.select("ViewQuery", "RowLimit")()) as ViewInfoLite;

      const fieldNames = (await this.getViewFieldNames(viewId)).map(normalizeViewName);
      const names = Array.from(new Set<string>(["ID", "Title", ...fieldNames]));
      if (boolField && names.indexOf(boolField) === -1) names.push(boolField);

      const viewFields = names.map((n) => `<FieldRef Name='${n}'/>`).join("");
      const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 100;

      const viewXml = `
        <View>
          <Query>${v.ViewQuery || ""}</Query>
          <ViewFields>${viewFields}</ViewFields>
          <RowLimit>${rowLimit}</RowLimit>
        </View>
      `.trim();

      const rows = (await this.l().getItemsByCAMLQuery({ ViewXml: viewXml })) as Array<any>;
      return (rows || []).map(
        (r) =>
          ({
            id: r.ID ?? r.Id ?? 0,
            placa: r.Title || "",
            marca: (r.marca as string) || undefined,
            modelo: (r.modelo as string) || undefined,
            proveedorIds: Array.isArray(r.ProveedorId)
              ? r.ProveedorId
              : r.ProveedorId
              ? [r.ProveedorId]
              : [],
            proveedorTitles: [],
            toggle: boolField ? !!r[boolField] : undefined,
          } as Vehiculo)
      );
    }

    const selects: string[] = ["Id", "Title", "marca", "modelo", "Proveedor/Id", "Proveedor/Title"];
    if (boolField) selects.push(boolField);

    const data = (await this.l()
      .items.select(...selects)
      .expand("Proveedor")
      .top(100)()) as RawVehiculo[] & any[];

    const mapped = dtoToVehiculos(data as RawVehiculo[]);
    if (boolField) {
      for (let i = 0; i < mapped.length; i++) mapped[i].toggle = !!(data[i] as any)[boolField];
    }
    return mapped;
  }

  public async add(draft: VehiculoDraft): Promise<void> {
    const body: any = { Title: draft.placa, marca: draft.marca, modelo: draft.modelo };
    body.ProveedorId = Array.isArray(draft.proveedorId)
      ? { results: draft.proveedorId }
      : draft.proveedorId ?? null;
    await this.l().items.add(body);
  }

  public async update(id: number, draft: VehiculoDraft): Promise<void> {
    const body: any = { Title: draft.placa, marca: draft.marca, modelo: draft.modelo };
    body.ProveedorId = Array.isArray(draft.proveedorId)
      ? { results: draft.proveedorId }
      : draft.proveedorId ?? null;
    await this.l().items.getById(id).update(body);
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
    return gps?.some((g: { Title?: string }) => String(g?.Title).toLowerCase() === target) || false;
  }

  // ===== Metadatos (lista base)
  public async getViewFieldNames(viewId: string): Promise<string[]> {
    const view = this.l().views.getById(viewId);
    try {
      const raw: any = await (view as any).fields();
      const arr: string[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
        ? raw.Items
        : Array.isArray(raw?.results)
        ? raw.results
        : Array.isArray(raw?.value)
        ? raw.value
        : [];
      if (arr.length) {
        return arr
          .map(String)
          .filter((n) => SYS_FIELDS.indexOf(n) === -1)
          .map(normalizeViewName);
      }
    } catch {}
    const info = (await view.select("HtmlSchemaXml")()) as { HtmlSchemaXml?: string };
    const xml = String(info?.HtmlSchemaXml || "");
    const matches = xml.match(/FieldRef\s+Name="([^"]+)"/g) || [];
    const parsed = matches
      .map((m) => /FieldRef\s+Name="([^"]+)"/.exec(m)?.[1])
      .filter((s): s is string => !!s);
    return parsed.filter((n) => SYS_FIELDS.indexOf(n) === -1).map(normalizeViewName);
  }

  public async getFieldsMeta(fieldInternalNames: string[]): Promise<EditField[]> {
    const metas = await Promise.all(
      fieldInternalNames.map(async (name) => {
        const f = (await this.l()
          .fields.getByInternalNameOrTitle(name)
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
        const ef: EditField = {
          internalName: f.InternalName,
          title: f.Title,
          type: f.TypeAsString,
          required: !!f.Required,
          readOnly: !!f.ReadOnlyField,
          allowMultiple: !!f.AllowMultipleValues,
          lookupListId: f.LookupList,
          choices: f.Choices,
        };
        return ef;
      })
    );
    return metas;
  }

  public async getItemValues(
    id: number,
    schema: EditField[]
  ): Promise<Record<string, unknown>> {
    return this.getItemValuesFromList(this.listId!, id, schema);
  }

  public async getLookupOptionsByListId(
    listId: string
  ): Promise<Array<{ key: number; text: string }>> {
    const items = (await this.sp.web.lists
      .getById(listId)
      .items.select("Id", "Title")
      .top(500)()) as Array<{ Id: number; Title?: string }>;
    return items.map((x) => ({ key: x.Id, text: x.Title || "" }));
  }

  public async updateFields(
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void> {
    await this.updateFieldsInList(this.listId!, id, schema, values);
  }

  // 👇 NUEVO: lo usa el falso formulario para listas hijas
  public async updateFieldsOnList(
    listId: string,
    id: number,
    schema: EditField[],
    values: Record<string, unknown>
  ): Promise<void> {
    await this.updateFieldsInList(listId, id, schema, values);
  }

  public async getTipoFormularioConfig(
    listTitle: string,
    keyField: string
  ): Promise<SemaforoConfig> {
    const select = ["Id", "Title", "campo", "amarillo", keyField].join(",");
    const items = await this.sp.web.lists
      .getByTitle(listTitle)
      .items.select(select)
      .top(5000)();

    const map: SemaforoConfig = {};
    for (const it of items as any[]) {
      const keyRaw = it[keyField] ?? it.Title;
      const key = String(keyRaw ?? "").trim().toLowerCase();
      const dateField = String(it.campo ?? "").trim();
      const warnDays = Number(it.amarillo) || 0;
      if (key && dateField) map[key] = { dateField, warnDays };
    }
    return map;
  }

  public async listSiteLists(): Promise<SiteListRef[]> {
    const lists = await this.sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")();
    return (lists as any[]).filter((l) => !l.Hidden).map((l) => ({ id: String(l.Id), title: String(l.Title) }));
  }

  public async getListFields(listId: string): Promise<FieldRef[]> {
    const fields = await this.sp.web.lists
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
      )();
    return (fields as any[])
      .filter((f: any) => !f.Hidden && !f.Sealed)
      .map((f: any) => ({
        internalName: f.InternalName,
        title: f.Title,
        type: f.TypeAsString,
        choices: f.Choices,
        lookupListId: f.LookupList,
        allowMultiple: f.AllowMultipleValues,
        readOnly: f.ReadOnlyField,
      }));
  }

  // ===== Relacionados
  public async getRelatedItems(params: {
    childListId: string;
    childField: string;
    parentValue: string | number | Date | boolean;
  }): Promise<{ columns: GridColumn[]; items: any[] }> {
    const { childListId, childField, parentValue } = params;

    const f = (await this.sp.web.lists
      .getById(childListId)
      .fields.getByInternalNameOrTitle(childField)
      .select("InternalName", "TypeAsString")()) as { InternalName: string; TypeAsString: string };

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

    const items = await this.sp.web.lists.getById(childListId).getItemsByCAMLQuery({ ViewXml: viewXml });
    const columns: GridColumn[] = this.inferColumnsFromItems(items as any[]);
    return { columns, items: items as any[] };
  }

  public async getRelatedGridByView(
    childListId: string,
    childViewId: string,
    childField: string,
    parentValue: string | number | Date | boolean
  ): Promise<{ columns: GridColumn[]; items: any[] }> {
    const list = this.sp.web.lists.getById(childListId);

    const v = (await list.views
      .getById(childViewId)
      .select("ViewQuery", "RowLimit", "HtmlSchemaXml")()) as {
      ViewQuery?: string;
      RowLimit?: number;
      HtmlSchemaXml?: string;
    };

    // campos de la vista hija
    const names = await this.getViewFieldNamesFromList(childListId, childViewId);
    const allNames = Array.from(new Set<string>(["ID", "Title", ...names]));
    const viewFields = allNames.map((n) => `<FieldRef Name='${n}'/>`).join("");

    const fld = (await list.fields
      .getByInternalNameOrTitle(childField)
      .select("InternalName", "TypeAsString")()) as { InternalName: string; TypeAsString: string };
    const { fieldRefXml, valueXml } = this.buildEqCaml(fld.InternalName, fld.TypeAsString, parentValue);

    const baseQuery = v.ViewQuery || "";
    const eqXml = `<Eq>${fieldRefXml}${valueXml}</Eq>`;
    const query = baseQuery.includes("<Where>")
      ? baseQuery.replace("<Where>", "<Where><And>").replace("</Where>", `</And>${eqXml}</Where>`)
      : `<Where>${eqXml}</Where>${baseQuery}`;

    const rowLimit = typeof v.RowLimit === "number" && v.RowLimit > 0 ? v.RowLimit : 200;

    const viewXml = `
      <View>
        <Query>${query}</Query>
        <ViewFields>${viewFields}</ViewFields>
        <RowLimit>${rowLimit}</RowLimit>
      </View>
    `.trim();

    const items = await list.getItemsByCAMLQuery({ ViewXml: viewXml });

    const metas = await Promise.all(
      allNames.map(async (n) => {
        const f = await list.fields.getByInternalNameOrTitle(n).select("InternalName", "Title")();
        return {
          internal: String((f as any)["InternalName"]),
          title: String((f as any)["Title"] || (f as any)["InternalName"]),
        };
      })
    );

    const columns: GridColumn[] = metas.map((m) => ({
      key: m.internal,
      name: m.title,
      fieldName: m.internal,
      minWidth: 120,
      isResizable: true,
    }));

    return { columns, items: items as any[] };
  }

  // ===== NUEVO: helpers públicos para mini-form en listas arbitrarias
  public async getViewFieldNamesFromList(listId: string, viewId: string): Promise<string[]> {
    const list = this.sp.web.lists.getById(listId);
    return this.getViewFieldNamesFromListInternal(list, viewId);
  }

  public async getFieldsMetaFromList(listId: string, internalNames: string[]): Promise<EditField[]> {
    const list = this.sp.web.lists.getById(listId);
    const metas = await Promise.all(
      internalNames.map(async (name) => {
        const f = (await list.fields
          .getByInternalNameOrTitle(name)
          .select(
            "InternalName",
            "Title",
            "TypeAsString",
            "Required",
            "ReadOnlyField",
            "LookupList",
            "AllowMultipleValues",
            "Choices"
          )()) as any;
        const ef: EditField = {
          internalName: f.InternalName,
          title: f.Title,
          type: f.TypeAsString,
          required: !!f.Required,
          readOnly: !!f.ReadOnlyField,
          allowMultiple: !!f.AllowMultipleValues,
          lookupListId: f.LookupList,
          choices: f.Choices,
        };
        return ef;
      })
    );
    return metas;
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
    const item = (await list.items.getById(id).select(...selects).expand(...expands)()) as Record<string, any>;
    const values: Record<string, unknown> = {};
    for (const s of schema) {
      const n = s.internalName;
      const v = item[n];
      if (s.type === "Lookup" || s.type === "User") {
        if (s.allowMultiple) {
          const arr = Array.isArray(v) ? v : [];
          values[n] = arr.map((x: any) => ({ key: Number(x?.Id), text: String(x?.Title || "") }));
        } else {
          values[n] = v ? { key: Number(v.Id), text: String(v.Title || "") } : undefined;
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
    const body: Record<string, unknown> = {};
    for (const s of schema) {
      if (!(s.internalName in values) || s.readOnly) continue;
      const n = s.internalName;
      const val = values[n];

      // LOOKUP / USER
      if (s.type === "Lookup" || s.type === "User") {
        // multivalor
        if (s.allowMultiple) {
          // puede venir [{key:1},{key:2}] o [1,2]
          let ids: number[] = [];
          if (Array.isArray(val)) {
            ids = (val as any[]).map((x) =>
              typeof x === "number" ? x : x && typeof x === "object" && "key" in x ? Number((x as any).key) : NaN
            );
            ids = ids.filter((n) => !isNaN(n));
          }
          body[`${n}Id`] = { results: ids };
        } else {
          // simple: acepto número o {key: n}
          let idVal: number | null = null;
          if (typeof val === "number") {
            idVal = val;
          } else if (val && typeof val === "object" && "key" in (val as any)) {
            idVal = (val as any).key != null ? Number((val as any).key) : null;
          }
          body[`${n}Id`] = idVal;
        }
      } else if (s.type === "MultiChoice") {
        body[n] = Array.isArray(val) ? (val as string[]).slice() : [];
      } else if (s.type === "Boolean") {
        body[n] = !!val;
      } else if (s.type === "Number" || s.type === "Currency") {
        body[n] = val === "" || val == null ? null : Number(val as number);
      } else if (s.type === "DateTime") {
        body[n] = val ? new Date(String(val)) : null;
      } else {
        body[n] = val as any;
      }
    }
    await list.items.getById(id).update(body);
  }

  public async listAttachments(
    listId: string,
    id: number
  ): Promise<Array<{ name: string; serverRelativeUrl: string }>> {
    const atts = await this.sp.web.lists.getById(listId).items.getById(id).attachmentFiles();
    return (atts || []).map((a: any) => ({ name: a.FileName, serverRelativeUrl: a.ServerRelativeUrl }));
  }

  public async replaceAttachment(listId: string, id: number, file: File): Promise<void> {
    const item = this.sp.web.lists.getById(listId).items.getById(id);
    try {
      const current = await item.attachmentFiles();
      if (current && current.length) {
        for (const c of current) {
          try {
            await item.attachmentFiles.getByName(c.FileName).delete();
          } catch {}
        }
      }
    } catch {}
    await item.attachmentFiles.add(file.name, file);
  }

  // ===== Helpers internos
  private inferColumnsFromItems(items: any[]): GridColumn[] {
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

  private buildEqCaml(
    fieldInternal: string,
    typeAsString: string,
    value: any
  ): { fieldRefXml: string; valueXml: string } {
    const t = (s: string) => s.toLowerCase();
    const xml = (s: any) =>
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
      return {
        fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
        valueXml: `<Value IncludeTimeValue='TRUE' Type='DateTime'>${new Date(value).toISOString()}</Value>`,
      };
    }
    if (t(typeAsString) === "boolean") {
      return {
        fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
        valueXml: `<Value Type='Boolean'>${value ? 1 : 0}</Value>`,
      };
    }
    return {
      fieldRefXml: `<FieldRef Name='${fieldInternal}' />`,
      valueXml: `<Value Type='Text'>${xml(String(value ?? ""))}</Value>`,
    };
  }

  private async resolveLookupTexts(items: any[], metas: EditField[]): Promise<any[]> {
    const lookupMetas = metas.filter((m) => m.type === "Lookup" || m.type === "User");
    if (!lookupMetas.length || !items.length) return items;

    const dicts: Record<string, Map<number, string>> = {};
    await Promise.all(
      lookupMetas.map(async (m) => {
        if (!m.lookupListId) return;
        const opts = await this.getLookupOptionsByListId(m.lookupListId);
        dicts[m.internalName] = new Map(opts.map((o) => [Number(o.key), String(o.text || "")]));
      })
    );

    return items.map((row) => {
      const r = { ...row };
      for (const m of lookupMetas) {
        const mapIds = dicts[m.internalName];
        if (!mapIds) continue;
        const idProps = [`${m.internalName}Id`, `${m.internalName}_Id`, m.internalName];
        let ids: number[] = [];
        for (const p of idProps) {
          const v = (r as any)[p];
          if (Array.isArray(v)) {
            ids = v.map(Number).filter((n) => !isNaN(n));
            if (ids.length) break;
          } else if (typeof v === "number") {
            ids = [v];
            break;
          }
        }
        if (m.allowMultiple) (r as any)[m.internalName] = ids.map((id) => mapIds.get(id) ?? String(id));
        else {
          const id = ids[0];
          (r as any)[m.internalName] = id != null ? mapIds.get(id) ?? String(id) : undefined;
        }
      }
      return r;
    });
  }

  private async getViewFieldNamesFromListInternal(list: any, viewId: string): Promise<string[]> {
    try {
      const raw: any = await (list.views.getById(viewId) as any).fields();
      const arr: string[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
        ? raw.Items
        : Array.isArray(raw?.results)
        ? raw.results
        : Array.isArray(raw?.value)
        ? raw.value
        : [];
      if (arr.length) {
        return arr
          .map(String)
          .filter((n) => SYS_FIELDS.indexOf(n) === -1)
          .map(normalizeViewName);
      }
    } catch {}
    const info = (await list.views.getById(viewId).select("HtmlSchemaXml")()) as { HtmlSchemaXml?: string };
    const xml = String(info?.HtmlSchemaXml || "");
    const matches = xml.match(/FieldRef\s+Name="([^"]+)"/g) || [];
    const parsed = matches
      .map((m) => /FieldRef\s+Name="([^"]+)"/.exec(m)?.[1])
      .filter((s): s is string => !!s);
    return parsed.filter((n) => SYS_FIELDS.indexOf(n) === -1).map(normalizeViewName);
  }
}
