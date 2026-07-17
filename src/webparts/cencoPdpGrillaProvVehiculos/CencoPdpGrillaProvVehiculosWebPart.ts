// CencoPdpGrillaProvVehiculosWebPart.ts
import * as React from "react";
import * as ReactDom from "react-dom";
import { Version } from "@microsoft/sp-core-library";
import {
  IPropertyPaneConfiguration,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption,
  PropertyPaneCheckbox,
  PropertyPaneTextField,
  PropertyPaneSlider,
  PropertyPaneButton,
  PropertyPaneButtonType,
} from "@microsoft/sp-property-pane";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { SPFI } from "@pnp/sp";
import { spfi } from "@pnp/sp";
import { SPFx } from "@pnp/sp/behaviors/spfx";

import VehiculosGrid from "./components/VehiculosGrid";
import { SPVehiculosService } from "./services/SPVehiculosService";
import type { EditField } from "./services/IVehiculosService";
import { buildViewSnapshot, stringifyViewSnapshot } from "./utils/viewSnapshot";

export type ApprovalMode = "traditional" | "automate" | "both";
export type MotivoMode = "none" | "approve" | "reject" | "both";

export interface ICencoPdpGrillaProvVehiculosWebPartProps {
  listId?: string;
  viewId?: string;
  toggleField?: string;

  showAdd?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showToggle?: boolean;
  showDownloadAttachments?: boolean;

  enableSemaforo?: boolean;
  tipoFieldName?: string;
  tipoConfigListTitle?: string;
  tipoConfigKeyField?: string;
  defaultWarnDays?: number;
  fallbackDateField?: string;

  relatedListId?: string;
  relatedParentField?: string;
  relatedChildField?: string;
  relatedChildViewId?: string;
  relatedEditViewId?: string;

  allowRelatedEdit?: boolean;
  allowRelatedDownloadAttachments?: boolean;

  // ===== Modal de aprobación (PropertyPane) =====
  enableApproveModal?: boolean;
  approveGroupName?: string;
  approveStatusField?: string;
  approveReasonField?: string;
  approveApprovedValue?: string;
  approveRejectedValue?: string;
  approveModalTitle?: string;

  // ===== NUEVO: Aprobación por Automate =====
  approvalMode?: ApprovalMode; // "traditional" | "automate" | "both"
  automateApproveUrl?: string;
  automateRejectUrl?: string;

  // ===== NUEVO: Finalizado + Motivo + WF =====
  approveFinalizadoField?: string; // internalName
  approveMotivoModalMode?: MotivoMode; // none | approve | reject | both
  approveMotivoRequiredMode?: MotivoMode; // none | approve | reject | both
  wfStatusField?: string; // internalName (choice: Pendiente|Ok|Error)
  wfErrorField?: string; // internalName (multiline text)

  // ===== UI =====
  gridTitle?: string;
  gridCollapsible?: boolean;
  gridDefaultCollapsed?: boolean;
  gridLazyLoad?: boolean;

  // ===== NUEVO: Estilo del título =====
  gridTitleFontSize?: number; // px
  gridTitleColor?: string; // hex o css color
  gridTitleFontWeight?: string; // "400" | "600" | ...
  gridTitleFontFamily?: string; // "Segoe UI" | ...

  viewSnapshotJson?: string;
  viewSnapshotCapturedAt?: string;
  viewColumnConfigJson?: string;
  columnEditorOpenNonce?: number;
}

const createNotConfiguredElement = (): React.ReactElement =>
  React.createElement(
    "div",
    { style: { padding: 12 } },
    "Configura la lista y el campo booleano desde el panel de propiedades."
  );

export default class CencoPdpGrillaProvVehiculosWebPart extends BaseClientSideWebPart<ICencoPdpGrillaProvVehiculosWebPartProps> {
  private _sp!: SPFI;
  private readonly _instanceKey: string = `grilla-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  private _listOptions: IPropertyPaneDropdownOption[] = [];
  private _boolFieldOptions: IPropertyPaneDropdownOption[] = [];

  private _childListOptions: IPropertyPaneDropdownOption[] = [];
  private _childFieldOptionsChild: IPropertyPaneDropdownOption[] = [];
  private _childViewOptions: IPropertyPaneDropdownOption[] = [];

  private _listsLoaded = false;
  private _boolsLoadedFor?: string;

  private _childViewsLoadedFor?: string;
  private _childFieldsLoadedFor?: string;

  // ===== Opciones UI (título) =====
  private _titleWeightOptions: IPropertyPaneDropdownOption[] = [
    { key: "300", text: "300 (Light)" },
    { key: "400", text: "400 (Normal)" },
    { key: "500", text: "500 (Medium)" },
    { key: "600", text: "600 (Semibold)" },
    { key: "700", text: "700 (Bold)" },
    { key: "800", text: "800 (ExtraBold)" },
    { key: "900", text: "900 (Black)" },
  ];

  private _titleFamilyOptions: IPropertyPaneDropdownOption[] = [
    { key: "Segoe UI", text: "Segoe UI (default)" },
    { key: "Arial", text: "Arial" },
    { key: "Calibri", text: "Calibri" },
    { key: "Tahoma", text: "Tahoma" },
    { key: "Verdana", text: "Verdana" },
    { key: "Roboto", text: "Roboto" },
    { key: "Inter", text: "Inter" },
    { key: "Georgia", text: "Georgia" },
    { key: "\"Times New Roman\"", text: "Times New Roman" },
    { key: "monospace", text: "monospace" },
  ];

  // ===== Opciones aprobación =====
  private _approvalModeOptions: IPropertyPaneDropdownOption[] = [
    { key: "traditional", text: "Tradicional (campos estado/motivo)" },
    { key: "automate", text: "Power Automate (URLs)" },
    { key: "both", text: "Ambos" },
  ];

  // ✅ NUEVO: opciones MotivoMode
  private _motivoModeOptions: IPropertyPaneDropdownOption[] = [
    { key: "none", text: "No mostrar modal" },
    { key: "approve", text: "Solo al aprobar" },
    { key: "reject", text: "Solo al rechazar" },
    { key: "both", text: "Aprobar y rechazar" },
  ];

  // ============================================================
  // Normalización (evita IDs inválidos que rompen getById)
  // ============================================================
  private _normGuid(id?: unknown): string | undefined {
    const s = String(id ?? "").trim();
    if (!s) return undefined;
    // saca llaves si vinieran
    return s.replace(/^{|}$/g, "");
  }

  private _normAndStoreProp(prop: keyof ICencoPdpGrillaProvVehiculosWebPartProps): void {
    const v = this.properties[prop];
    this.properties[prop] = this._normGuid(v) as never;
  }

  protected async onInit(): Promise<void> {
    await super.onInit();

    this._sp = spfi().using(SPFx(this.context));

    // normaliza IDs existentes (si quedaron “sucios” por algún cambio previo)
    this._normAndStoreProp("listId");
    this._normAndStoreProp("viewId");
    this._normAndStoreProp("relatedListId");
    this._normAndStoreProp("relatedChildViewId");
    this._normAndStoreProp("relatedEditViewId");

    this.properties.enableSemaforo ??= false;
    this.properties.tipoFieldName ??= "TipoFormularioKey";
    this.properties.tipoConfigListTitle ??= "Tipo formulario";
    this.properties.tipoConfigKeyField ??= "Title";
    this.properties.defaultWarnDays ??= 30;
    this.properties.fallbackDateField ??= "";

    this.properties.relatedListId ??= undefined;
    this.properties.relatedParentField ??= undefined;
    this.properties.relatedChildField ??= undefined;
    this.properties.relatedChildViewId ??= undefined;
    this.properties.relatedEditViewId ??= undefined;

    this.properties.allowRelatedEdit ??= true;
    this.properties.allowRelatedDownloadAttachments ??= false;
    this.properties.showDownloadAttachments ??= true;

    // ===== Defaults Aprobación =====
    this.properties.enableApproveModal ??= false;
    this.properties.approveGroupName ??= "Distribucion";
    this.properties.approveStatusField ??= "EstadoAprobacion";
    this.properties.approveReasonField ??= "Motivo";
    this.properties.approveApprovedValue ??= "Aprobado";
    this.properties.approveRejectedValue ??= "Rechazado";
    this.properties.approveModalTitle ??= "Aprobar";

    // ✅ defaults Automate
    this.properties.approvalMode ??= "traditional";
    this.properties.automateApproveUrl ??= "";
    this.properties.automateRejectUrl ??= "";

    // ✅ NUEVO: defaults Finalizado + Motivo + WF
    this.properties.approveFinalizadoField ??= "";
    this.properties.approveMotivoModalMode ??= "reject";
    this.properties.approveMotivoRequiredMode ??= "reject";
    this.properties.wfStatusField ??= "wfstatus";
    this.properties.wfErrorField ??= "wferror";

    // ===== Defaults UI =====
    this.properties.gridTitle ??= "";
    this.properties.gridCollapsible ??= false;
    this.properties.gridDefaultCollapsed ??= false;
    this.properties.gridLazyLoad ??= true;

    // ===== Defaults Estilo título =====
    this.properties.gridTitleFontSize ??= 16;
    this.properties.gridTitleColor ??= "#323130";
    this.properties.gridTitleFontWeight ??= "700";
    this.properties.gridTitleFontFamily ??= "Segoe UI";
    this.properties.viewSnapshotJson ??= "";
    this.properties.viewSnapshotCapturedAt ??= "";
    this.properties.viewColumnConfigJson ??= "";
    this.properties.columnEditorOpenNonce ??= 0;

    // Pre-carga básica (ayuda a que el panel ya arranque con opciones cuando hay props guardadas)
    try {
      await this._loadLists();
      await this._loadChildLists();

      const listId = this.properties.listId;
      if (listId) {
        await Promise.all([this._loadViews(listId), this._loadBooleanFields(listId)]);
      }

      const childListId = this.properties.relatedListId;
      if (childListId) {
        await Promise.all([this._loadChildViews(childListId), this._loadChildFields(childListId)]);
      }
    } catch {
      // no rompas onInit por un fallo de lectura
    }
  }

  public render(): void {
    const {
      listId,
      viewId,
      toggleField,
      showAdd = true,
      showEdit = true,
      showDelete = true,
      showToggle = true,
      enableSemaforo = false,
      tipoFieldName = "TipoFormularioKey",
      tipoConfigListTitle = "Tipo formulario",
      tipoConfigKeyField = "Title",
      defaultWarnDays = 30,
      fallbackDateField = "",
      relatedListId,
      relatedParentField,
      relatedChildField,
      relatedChildViewId,
      relatedEditViewId,
      allowRelatedEdit = true,
      allowRelatedDownloadAttachments = false,
      showDownloadAttachments = true,

      // ===== PropertyPane Aprobación =====
      enableApproveModal = false,
      approveGroupName = "Distribucion",
      approveStatusField = "EstadoAprobacion",
      approveReasonField = "Motivo",
      approveApprovedValue = "Aprobado",
      approveRejectedValue = "Rechazado",
      approveModalTitle = "Aprobar",

      // ✅ Automate
      approvalMode = "traditional",
      automateApproveUrl = "",
      automateRejectUrl = "",

      // ✅ NUEVO: Finalizado + Motivo + WF
      approveFinalizadoField = "",
      approveMotivoModalMode = "reject",
      approveMotivoRequiredMode = "reject",
      wfStatusField = "wfstatus",
      wfErrorField = "wferror",

      // ===== UI =====
      gridTitle = "",
      gridCollapsible = false,
      gridDefaultCollapsed = false,
      gridLazyLoad = true,

      // ===== UI: estilo título =====
      gridTitleFontSize = 16,
      gridTitleColor = "#323130",
      gridTitleFontWeight = "700",
      gridTitleFontFamily = "Segoe UI",
    } = this.properties;

    // normaliza justo antes de usar (evita que llegue undefined/ruido al service)
    const listIdNorm = this._normGuid(listId);
    const viewIdNorm = this._normGuid(viewId);
    const relatedListIdNorm = this._normGuid(relatedListId);
    const relatedChildViewIdNorm = this._normGuid(relatedChildViewId);
    const relatedEditViewIdNorm = this._normGuid(relatedEditViewId);

    const element: React.ReactElement = !listIdNorm
      ? createNotConfiguredElement()
      : React.createElement(VehiculosGrid, {
          service: new SPVehiculosService(this._sp, listIdNorm),
          groupNameForEdit: String(approveGroupName ?? "Distribucion").trim() || "Distribucion",
          viewId: viewIdNorm,
          toggleField,
          showAdd,
          showEdit,
          showDelete,
          showToggle,
          enableSemaforo,
          tipoFieldName,
          tipoConfigListTitle,
          tipoConfigKeyField,
          defaultWarnDays,
          fallbackDateField: fallbackDateField || undefined,
          relatedListId: relatedListIdNorm,
          relatedParentField,
          relatedChildField,
          relatedChildViewId: relatedChildViewIdNorm,
          relatedEditViewId: relatedEditViewIdNorm,
          allowRelatedEdit,
          allowRelatedDownloadAttachments,
          listId: listIdNorm,
          showDownloadAttachments,
          gridLazyLoad,
          instanceKey: this._instanceKey,

          // ✅ UI (título + colapsable)
          gridTitle,
          gridCollapsible,
          gridDefaultCollapsed,

          // ✅ UI (estilo del título)
          gridTitleFontSize,
          gridTitleColor,
          gridTitleFontWeight,
          gridTitleFontFamily,
          viewSnapshotJson: this.properties.viewSnapshotJson,
          viewColumnConfigJson: this.properties.viewColumnConfigJson,
          columnEditorOpenNonce: this.properties.columnEditorOpenNonce,
          onCaptureViewSnapshot: this._captureViewSnapshot.bind(this),
          onSaveViewColumnConfig: this._saveViewColumnConfig.bind(this),

          // ✅ Aprobación (legacy + nuevo)
          enableApproval: enableApproveModal,
          approvalGroupName: approveGroupName,
          approvalStatusField: approveStatusField,
          approvalReasonField: approveReasonField,

          enableApproveModal,
          approveGroupName,
          approveStatusField,
          approveReasonField,
          approveApprovedValue,
          approveRejectedValue,
          approveModalTitle,

          // ✅ NUEVO: Automate + modo (se mantiene compat)
          approvalMode,
          automateApproveUrl,
          automateRejectUrl,

          // ✅ NUEVO: Finalizado + Motivo + WF
          approveFinalizadoField: approveFinalizadoField || "",
          approveMotivoModalMode,
          approveMotivoRequiredMode,
          wfStatusField,
          wfErrorField,
        });

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  private async _captureViewSnapshot(): Promise<void> {
    const listId = this._normGuid(this.properties.listId);
    const viewId = this._normGuid(this.properties.viewId);
    if (!listId || !viewId) return;

    const toggleField = String(this.properties.toggleField || "").trim() || undefined;

    const extractViewFieldsExact = (htmlSchemaXml?: string): string[] => {
      const xml = String(htmlSchemaXml || "");
      const matches = xml.match(/FieldRef\s+Name="([^"]+)"/g) || [];
      const names = matches
        .map((m) => /FieldRef\s+Name="([^"]+)"/.exec(m)?.[1])
        .filter((s): s is string => Boolean(s));
      return names;
    };

    try {
      const list = this._sp.web.lists.getById(listId);
      const service = new SPVehiculosService(this._sp, listId);
      const viewInfo = (await list.views
        .getById(viewId)
        .select("Title", "ViewQuery", "RowLimit", "HtmlSchemaXml")()) as {
        Title?: string;
        ViewQuery?: string;
        RowLimit?: number;
        HtmlSchemaXml?: string;
      };

      const fieldNames = extractViewFieldsExact(viewInfo.HtmlSchemaXml);
      const fieldMetas = await Promise.all(
        fieldNames.map(async (name, order) => {
          try {
            const meta = (await list.fields
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
              internalName: meta.InternalName,
              title: meta.Title,
              type: meta.TypeAsString,
              required: Boolean(meta.Required),
              readOnly: Boolean(meta.ReadOnlyField),
              allowMultiple: Boolean(meta.AllowMultipleValues),
              lookupListId: meta.LookupList,
              choices: meta.Choices,
              order,
              inView: true,
            } as EditField & { order: number; inView: boolean };
          } catch {
            return {
              internalName: name,
              title: name,
              type: "Text",
              required: false,
              readOnly: true,
              order,
              inView: true,
            } as EditField & { order: number; inView: boolean };
          }
        })
      );

      const rowLimit = typeof viewInfo.RowLimit === "number" && viewInfo.RowLimit > 0 ? viewInfo.RowLimit : 200;
      const grid = await service.getAllViewGrid(viewId, toggleField, { resolveLookups: true });
      const items = grid.items as Array<Record<string, unknown>>;
      const columns = grid.columns.map((column) => ({
        key: column.key,
        name: column.name,
        fieldName: column.fieldName,
      }));

      const snapshot = buildViewSnapshot({
        listId,
        viewId,
        toggleField,
        view: {
          title: viewInfo.Title,
          rowLimit,
          viewQuery: viewInfo.ViewQuery,
          htmlSchemaXml: viewInfo.HtmlSchemaXml,
          fieldNames,
        },
        columns,
        fields: fieldMetas,
        items,
        capturedAt: new Date().toISOString(),
      });

      this.properties.viewSnapshotJson = stringifyViewSnapshot(snapshot);
      this.properties.viewSnapshotCapturedAt = snapshot.capturedAt;
      this.context.propertyPane.refresh();
      this.render();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("No se pudo capturar el snapshot de la vista", error);
    }
  }

  private async _saveViewColumnConfig(json: string): Promise<void> {
    this.properties.viewColumnConfigJson = json;
    this.context.propertyPane.refresh();
    this.render();
  }

  private _requestColumnEditor(): void {
    this.properties.columnEditorOpenNonce = (this.properties.columnEditorOpenNonce ?? 0) + 1;
    this.context.propertyPane.refresh();
    this.render();
  }

  protected onPropertyPaneConfigurationStart(): void {
    if (!this._listsLoaded) {
      this._loadLists()
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);

      this._loadChildLists()
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);
    }

    const listId = this._normGuid(this.properties.listId);
    if (listId) {
      this._loadViews(listId)
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);

      this._loadBooleanFields(listId)
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);
    } else {
      this._boolFieldOptions = [];
      this._boolsLoadedFor = undefined;
    }

    const childListId = this._normGuid(this.properties.relatedListId);
    if (childListId) {
      this._loadChildViews(childListId)
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);

      this._loadChildFields(childListId)
        .then(() => this.context.propertyPane.refresh())
        .catch(() => undefined);
    } else {
      this._childViewOptions = [];
      this._childFieldOptionsChild = [];
      this._childFieldsLoadedFor = undefined;
      this._childViewsLoadedFor = undefined;
    }
  }

  protected onPropertyPaneFieldChanged(prop: string, oldVal: unknown, newVal: unknown): void {
    // normaliza GUIDs que vienen del dropdown (y evita que se guarde basura)
    if (
      prop === "listId" ||
      prop === "viewId" ||
      prop === "relatedListId" ||
      prop === "relatedChildViewId" ||
      prop === "relatedEditViewId"
    ) {
      const norm = this._normGuid(newVal);
      this.properties[prop] = norm as never;
      newVal = norm;
    }

    if (prop === "listId" && newVal !== oldVal) {
      this.properties.viewId = undefined;
      this.properties.toggleField = undefined;
      this.properties.viewSnapshotJson = "";
      this.properties.viewSnapshotCapturedAt = "";
      this.properties.viewColumnConfigJson = "";

      this._boolFieldOptions = [];
      this._boolsLoadedFor = undefined;

      if (newVal) {
        const id = String(newVal);
        this._loadViews(id)
          .then(() => this.context.propertyPane.refresh())
          .catch(() => undefined);

        this._loadBooleanFields(id)
          .then(() => this.context.propertyPane.refresh())
          .catch(() => undefined);
      }

      this.context.propertyPane.refresh();
      this.render();
    }

    if (prop === "relatedListId" && newVal !== oldVal) {
      this.properties.relatedChildViewId = undefined;
      this.properties.relatedChildField = undefined;
      this.properties.relatedEditViewId = undefined;

      this._childViewOptions = [];
      this._childFieldOptionsChild = [];
      this._childViewsLoadedFor = undefined;
      this._childFieldsLoadedFor = undefined;

      if (newVal) {
        const id = String(newVal);
        this._loadChildViews(id)
          .then(() => this.context.propertyPane.refresh())
          .catch(() => undefined);

        this._loadChildFields(id)
          .then(() => this.context.propertyPane.refresh())
          .catch(() => undefined);
      }

      this.context.propertyPane.refresh();
      this.render();
    }

    const trackedProps = [
      "viewId",
      "toggleField",
      "showAdd",
      "showEdit",
      "showDelete",
      "showToggle",
      "enableSemaforo",
      "tipoFieldName",
      "tipoConfigListTitle",
      "tipoConfigKeyField",
      "defaultWarnDays",
      "fallbackDateField",
      "relatedListId",
      "relatedParentField",
      "relatedChildField",
      "relatedChildViewId",
      "relatedEditViewId",
      "allowRelatedEdit",
      "allowRelatedDownloadAttachments",
      "showDownloadAttachments",

      // Aprobación
      "enableApproveModal",
      "approveGroupName",
      "approveStatusField",
      "approveReasonField",
      "approveApprovedValue",
      "approveRejectedValue",
      "approveModalTitle",

      // Automate
      "approvalMode",
      "automateApproveUrl",
      "automateRejectUrl",

      // ✅ NUEVO: Finalizado + Motivo + WF
      "approveFinalizadoField",
      "approveMotivoModalMode",
      "approveMotivoRequiredMode",
      "wfStatusField",
      "wfErrorField",

      // UI
      "gridTitle",
      "gridCollapsible",
      "gridDefaultCollapsed",

      // UI estilo título
      "gridTitleFontSize",
      "gridTitleColor",
      "gridTitleFontWeight",
      "gridTitleFontFamily",
      "viewColumnConfigJson",
    ];

    if (trackedProps.indexOf(prop) !== -1 && newVal !== oldVal) {
      this.render();
    }

    super.onPropertyPaneFieldChanged(prop, oldVal, newVal);
  }

  private async _loadLists(): Promise<void> {
    const rows = (await this._sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")()) as Array<{
      Id: string;
      Title: string;
      Hidden: boolean;
      BaseTemplate: number;
    }>;

    this._listOptions = rows
      .filter((l) => !l.Hidden)
      .map((l) => ({ key: this._normGuid(l.Id) as string, text: l.Title }));

    this._listsLoaded = true;
  }

  private async _loadViews(listId: string): Promise<void> {
    const id = this._normGuid(listId);
    if (!id) {
      return;
    }

    const rows = (await this._sp.web.lists
      .getById(id)
      .views.select("Id", "Title", "Hidden", "PersonalView")()) as Array<{
      Id: string;
      Title: string;
      Hidden: boolean;
      PersonalView: boolean;
    }>;

    const activeViews = rows.filter((v) => !v.Hidden && !v.PersonalView);
    const currentViewId = this._normGuid(this.properties.viewId);
    const defaultView =
      activeViews.find((v) => Boolean((v as { DefaultView?: boolean }).DefaultView)) ??
      activeViews[0];
    const defaultViewId = this._normGuid(defaultView?.Id);
    if (defaultViewId && currentViewId !== defaultViewId) {
      this.properties.viewId = defaultViewId;
    }
  }

  private async _loadBooleanFields(listId: string): Promise<void> {
    const id = this._normGuid(listId);
    if (!id) {
      this._boolFieldOptions = [];
      this._boolsLoadedFor = undefined;
      return;
    }

    const fields = (await this._sp.web.lists
      .getById(id)
      .fields.select("InternalName", "Title", "Hidden", "TypeAsString")()) as Array<{
      InternalName: string;
      Title: string;
      Hidden: boolean;
      TypeAsString: string;
    }>;

    this._boolFieldOptions = fields
      .filter((f) => !f.Hidden && f.TypeAsString === "Boolean")
      .map((f) => ({
        key: f.InternalName,
        text: `${f.Title} (${f.InternalName})`,
      }));

    this._boolsLoadedFor = id;
  }

  private async _loadChildLists(): Promise<void> {
    const rows = (await this._sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")()) as Array<{
      Id: string;
      Title: string;
      Hidden: boolean;
      BaseTemplate: number;
    }>;

    this._childListOptions = rows
      .filter((l) => !l.Hidden)
      .map((l) => ({ key: this._normGuid(l.Id) as string, text: l.Title }));
  }

  private async _loadChildViews(listId: string): Promise<void> {
    const id = this._normGuid(listId);
    if (!id) {
      this._childViewOptions = [];
      this._childViewsLoadedFor = undefined;
      return;
    }

    const rows = (await this._sp.web.lists
      .getById(id)
      .views.select("Id", "Title", "Hidden", "PersonalView")()) as Array<{
      Id: string;
      Title: string;
      Hidden: boolean;
      PersonalView: boolean;
    }>;

    this._childViewOptions = rows
      .filter((v) => !v.Hidden && !v.PersonalView)
      .map((v) => ({ key: this._normGuid(v.Id) as string, text: v.Title }));

    this._childViewsLoadedFor = id;
  }

  private async _loadChildFields(listId: string): Promise<void> {
    const id = this._normGuid(listId);
    if (!id) {
      this._childFieldOptionsChild = [];
      this._childFieldsLoadedFor = undefined;
      return;
    }

    const fields = (await this._sp.web.lists
      .getById(id)
      .fields.select("InternalName", "Title", "Hidden", "ReadOnlyField", "Sealed", "TypeAsString")()) as Array<{
      InternalName: string;
      Title: string;
      Hidden: boolean;
      ReadOnlyField: boolean;
      Sealed: boolean;
      TypeAsString: string;
    }>;

    const usable = fields.filter((f) => !f.Hidden && !f.Sealed);
    this._childFieldOptionsChild = usable.map((f) => ({
      key: f.InternalName,
      text: `${f.Title} (${f.InternalName})`,
    }));
    this._childFieldsLoadedFor = id;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const collapsible = Boolean(this.properties.gridCollapsible);

    const listIdNorm = this._normGuid(this.properties.listId);
    const relatedListIdNorm = this._normGuid(this.properties.relatedListId);

    const enableApproveModal = Boolean(this.properties.enableApproveModal);
    const approvalMode = (this.properties.approvalMode ?? "traditional") as ApprovalMode;

    // ✅ Importante: ahora SIEMPRE se actualiza estado/motivo (independiente del modo)
    const showAutomate = enableApproveModal && (approvalMode === "automate" || approvalMode === "both");

    return {
      pages: [
        {
          header: { description: "Configuración" },
          groups: [
            {
              groupName: "UI",
              groupFields: [
                PropertyPaneTextField("gridTitle", {
                  label: "Título de la grilla",
                  placeholder: "Ej: Vehículos",
                }),

                // ===== Estilo título =====
                PropertyPaneSlider("gridTitleFontSize", {
                  label: "Tamaño de fuente (px)",
                  min: 10,
                  max: 40,
                  step: 1,
                  value: this.properties.gridTitleFontSize ?? 16,
                }),
                PropertyPaneTextField("gridTitleColor", {
                  label: "Color del título",
                  placeholder: "#323130 o red",
                }),
                PropertyPaneDropdown("gridTitleFontWeight", {
                  label: "Peso (weight)",
                  options: this._titleWeightOptions,
                  selectedKey: this.properties.gridTitleFontWeight ?? "700",
                }),
                PropertyPaneDropdown("gridTitleFontFamily", {
                  label: "Fuente (family)",
                  options: this._titleFamilyOptions,
                  selectedKey: this.properties.gridTitleFontFamily ?? "Segoe UI",
                }),

                PropertyPaneCheckbox("gridCollapsible", {
                  text: "Permitir colapsar/expandir",
                }),
                PropertyPaneCheckbox("gridDefaultCollapsed", {
                  text: "Iniciar colapsada",
                  disabled: !collapsible,
                }),
              ],
            },

            {
              groupName: "Origen de datos",
              groupFields: [
                PropertyPaneDropdown("listId", {
                  label: "Lista",
                  options: this._listOptions,
                  selectedKey: listIdNorm,
                  disabled: !this._listsLoaded,
                }),
                PropertyPaneDropdown("toggleField", {
                  label: "Campo booleano (Activar/Desactivar)",
                  options: this._boolFieldOptions,
                  selectedKey: this.properties.toggleField,
                  disabled: !listIdNorm || this._boolsLoadedFor !== listIdNorm,
                }),
                PropertyPaneButton("openColumnEditor", {
                  text: "Configurar campos de la lista",
                  buttonType: PropertyPaneButtonType.Primary,
                  onClick: () => {
                    this._requestColumnEditor();
                  },
                  disabled: !listIdNorm,
                }),
              ],
            },
            {
              groupName: "Acciones",
              groupFields: [
                PropertyPaneCheckbox("showAdd", {
                  text: "Mostrar botón 'Agregar'",
                }),
                PropertyPaneCheckbox("showEdit", {
                  text: "Mostrar 'Editar en línea'",
                }),
                PropertyPaneCheckbox("showDelete", {
                  text: "Mostrar botón 'Borrar'",
                }),
                PropertyPaneCheckbox("showToggle", {
                  text: "Mostrar botón 'Activar/Desactivar'",
                }),
                PropertyPaneCheckbox("showDownloadAttachments", {
                  text: "Mostrar acción 'Descargar adjuntos'",
                }),
              ],
            },
            {
              groupName: "Semáforo",
              groupFields: [
                PropertyPaneCheckbox("enableSemaforo", {
                  text: "Activar semáforo",
                }),
                PropertyPaneTextField("tipoFieldName", {
                  label: "Campo de TIPO en documentos (texto)",
                  placeholder: "TipoFormularioKey",
                }),
                PropertyPaneTextField("tipoConfigListTitle", {
                  label: "Lista de configuración",
                  placeholder: "Tipo formulario",
                }),
                PropertyPaneTextField("tipoConfigKeyField", {
                  label: "Campo clave en la config",
                  description: "Ej: Title o Clave",
                  placeholder: "Title",
                }),
                PropertyPaneSlider("defaultWarnDays", {
                  label: "Días para aviso (por defecto)",
                  min: 1,
                  max: 90,
                  step: 1,
                }),
                PropertyPaneTextField("fallbackDateField", {
                  label: "Campo fecha fallback (opcional)",
                  placeholder: "Nombre interno",
                }),
              ],
            },

            {
              groupName: "Aprobación",
              groupFields: [
                PropertyPaneCheckbox("enableApproveModal", {
                  text: "Activar aprobación (botones + modal)",
                }),

                PropertyPaneDropdown("approvalMode", {
                  label: "Modo de aprobación",
                  options: this._approvalModeOptions,
                  selectedKey: this.properties.approvalMode ?? "traditional",
                  disabled: !enableApproveModal,
                }),

                PropertyPaneTextField("approveModalTitle", {
                  label: "Título del modal",
                  placeholder: "Aprobar",
                  disabled: !enableApproveModal,
                }),

                PropertyPaneTextField("approveGroupName", {
                  label: "Grupo con permiso para aprobar",
                  placeholder: "Distribucion",
                  disabled: !enableApproveModal,
                }),

                // ✅ Siempre se usan (aunque el modo sea automate)
                PropertyPaneTextField("approveStatusField", {
                  label: "Campo estado (InternalName)",
                  placeholder: "EstadoAprobacion",
                  disabled: !enableApproveModal,
                }),
                PropertyPaneTextField("approveReasonField", {
                  label: "Campo motivo/observación (InternalName)",
                  placeholder: "Motivo",
                  disabled: !enableApproveModal,
                }),
                PropertyPaneTextField("approveApprovedValue", {
                  label: "Valor 'Aprobado'",
                  placeholder: "Aprobado",
                  disabled: !enableApproveModal,
                }),
                PropertyPaneTextField("approveRejectedValue", {
                  label: "Valor 'Rechazado'",
                  placeholder: "Rechazado",
                  disabled: !enableApproveModal,
                }),

                // ✅ NUEVO: finalizado
                PropertyPaneTextField("approveFinalizadoField", {
                  label: "Campo 'Finalizado' (InternalName) (opcional)",
                  placeholder: "finalizado",
                  disabled: !enableApproveModal,
                }),

                // ✅ NUEVO: modal de motivo / obligatoriedad
                PropertyPaneDropdown("approveMotivoModalMode", {
                  label: "Mostrar modal de motivo",
                  options: this._motivoModeOptions,
                  selectedKey: this.properties.approveMotivoModalMode ?? "reject",
                  disabled: !enableApproveModal,
                }),
                PropertyPaneDropdown("approveMotivoRequiredMode", {
                  label: "Motivo obligatorio",
                  options: this._motivoModeOptions,
                  selectedKey: this.properties.approveMotivoRequiredMode ?? "reject",
                  disabled: !enableApproveModal,
                }),

                // Automate
                PropertyPaneTextField("automateApproveUrl", {
                  label: "URL Automate - Aprobar",
                  placeholder: "https://prod-..../triggers/manual/...",
                  multiline: true,
                  disabled: !showAutomate,
                }),
                PropertyPaneTextField("automateRejectUrl", {
                  label: "URL Automate - Rechazar",
                  placeholder: "https://prod-..../triggers/manual/...",
                  multiline: true,
                  disabled: !showAutomate,
                }),

                // ✅ NUEVO: WF fields (se usan si hay URL)
                PropertyPaneTextField("wfStatusField", {
                  label: "Campo WF status (InternalName)",
                  placeholder: "wfstatus",
                  disabled: !enableApproveModal,
                }),
                PropertyPaneTextField("wfErrorField", {
                  label: "Campo WF error (InternalName)",
                  placeholder: "wferror",
                  disabled: !enableApproveModal,
                }),
              ],
            },

            {
              groupName: "Documentos relacionados",
              groupFields: [
                PropertyPaneDropdown("relatedListId", {
                  label: "Lista hija",
                  options: this._childListOptions,
                  selectedKey: relatedListIdNorm,
                }),
                PropertyPaneTextField("relatedParentField", {
                  label: "Campo en la lista madre (InternalName)",
                  placeholder: "Ej: Placa",
                }),
                PropertyPaneDropdown("relatedChildField", {
                  label: "Campo en la lista hija para igualar",
                  options: this._childFieldOptionsChild,
                  selectedKey: this.properties.relatedChildField,
                  disabled: !relatedListIdNorm || this._childFieldsLoadedFor !== relatedListIdNorm,
                }),
                PropertyPaneDropdown("relatedChildViewId", {
                  label: "Vista de la lista hija (para el modal)",
                  options: this._childViewOptions,
                  selectedKey: this._normGuid(this.properties.relatedChildViewId),
                  disabled: !relatedListIdNorm || this._childViewsLoadedFor !== relatedListIdNorm,
                }),
                PropertyPaneDropdown("relatedEditViewId", {
                  label: "Vista de edición de la lista hija",
                  options: this._childViewOptions,
                  selectedKey: this._normGuid(this.properties.relatedEditViewId),
                  disabled: !relatedListIdNorm || this._childViewsLoadedFor !== relatedListIdNorm,
                }),
                PropertyPaneCheckbox("allowRelatedEdit", {
                  text: "Edición documentos",
                  checked: this.properties.allowRelatedEdit,
                }),
                PropertyPaneCheckbox("allowRelatedDownloadAttachments", {
                  text: "Descargar adjuntos",
                  checked: this.properties.allowRelatedDownloadAttachments,
                }),
              ],
            },
          ],
        },
      ],
    };
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }
}
