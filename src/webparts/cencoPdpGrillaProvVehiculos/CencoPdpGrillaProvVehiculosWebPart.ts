// CencoPdpGrillaProvVehiculosWebPart.ts
import * as React from "react";
import * as ReactDom from "react-dom";
import { Version } from "@microsoft/sp-core-library";
import {
  type IPropertyPaneConfiguration,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption,
  PropertyPaneCheckbox,
  PropertyPaneTextField,
  PropertyPaneSlider,
} from "@microsoft/sp-property-pane";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";

import VehiculosGrid from "./components/VehiculosGrid";
import { SPVehiculosService } from "./services/SPVehiculosService";
import { spfi, SPFI } from "@pnp/sp";
import { SPFx } from "@pnp/sp/behaviors/spfx";

export interface ICencoPdpGrillaProvVehiculosWebPartProps {
  // origen
  listId?: string;
  viewId?: string;
  toggleField?: string;

  // acciones
  showAdd?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showToggle?: boolean;

  // semáforo
  enableSemaforo?: boolean;
  tipoFieldName?: string;
  tipoConfigListTitle?: string;
  tipoConfigKeyField?: string;
  defaultWarnDays?: number;
  fallbackDateField?: string;

  // relacionados (lista hija)
  relatedListId?: string;
  relatedParentField?: string;
  relatedChildField?: string;
  relatedChildViewId?: string;
}

export default class CencoPdpGrillaProvVehiculosWebPart extends BaseClientSideWebPart<ICencoPdpGrillaProvVehiculosWebPartProps> {
  private _sp!: SPFI;

  private _listOptions: IPropertyPaneDropdownOption[] = [];
  private _viewOptions: IPropertyPaneDropdownOption[] = [];
  private _boolFieldOptions: IPropertyPaneDropdownOption[] = [];

  // lista hija
  private _childListOptions: IPropertyPaneDropdownOption[] = [];
  private _childFieldOptionsChild: IPropertyPaneDropdownOption[] = [];
  private _childViewOptions: IPropertyPaneDropdownOption[] = [];

  private _listsLoaded = false;
  private _viewsLoadedFor?: string;
  private _boolsLoadedFor?: string;

  private _childViewsLoadedFor?: string;
  private _childFieldsLoadedFor?: string;

  protected async onInit(): Promise<void> {
    this._sp = spfi().using(SPFx(this.context));

    // defaults semáforo
    this.properties.enableSemaforo ??= false;
    this.properties.tipoFieldName ??= "TipoFormularioKey";
    this.properties.tipoConfigListTitle ??= "Tipo formulario";
    this.properties.tipoConfigKeyField ??= "Title";
    this.properties.defaultWarnDays ??= 30;
    this.properties.fallbackDateField ??= "";

    // defaults relacionados
    this.properties.relatedListId ??= undefined;
    this.properties.relatedParentField ??= undefined;
    this.properties.relatedChildField ??= undefined;
    this.properties.relatedChildViewId ??= undefined;
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

      // semáforo
      enableSemaforo = false,
      tipoFieldName = "TipoFormularioKey",
      tipoConfigListTitle = "Tipo formulario",
      tipoConfigKeyField = "Title",
      defaultWarnDays = 30,
      fallbackDateField = "",

      // relacionados
      relatedListId,
      relatedParentField,
      relatedChildField,
      relatedChildViewId,
    } = this.properties;

    if (!listId) {
      ReactDom.render(
        React.createElement(
          "div",
          { style: { padding: 12 } },
          "Configura la lista (y opcionalmente la vista y el campo booleano) desde el panel de propiedades."
        ),
        this.domElement
      );
      return;
    }

    const service = new SPVehiculosService(this._sp, listId);

    const element = React.createElement(VehiculosGrid, {
      service,
      groupNameForEdit: "Distribucion",
      viewId,
      toggleField,

      showAdd,
      showEdit,
      showDelete,
      showToggle,

      // semáforo
      enableSemaforo,
      tipoFieldName,
      tipoConfigListTitle,
      tipoConfigKeyField,
      defaultWarnDays,
      fallbackDateField: fallbackDateField || undefined,

      // relacionados
      relatedListId,
      relatedParentField,
      relatedChildField,
      relatedChildViewId,
    });

    ReactDom.render(element, this.domElement);
  }

  protected onPropertyPaneConfigurationStart(): void {
    if (!this._listsLoaded) {
      void this._loadLists().then(() => this.context.propertyPane.refresh()).catch(() => {});
      void this._loadChildLists().then(() => this.context.propertyPane.refresh()).catch(() => {});
    }

    const listId = this.properties.listId;
    if (listId) {
      void this._loadViews(listId).then(() => this.context.propertyPane.refresh()).catch(() => {});
      void this._loadBooleanFields(listId).then(() => this.context.propertyPane.refresh()).catch(() => {});
    } else {
      this._viewOptions = [];
      this._boolFieldOptions = [];
      this._viewsLoadedFor = undefined;
      this._boolsLoadedFor = undefined;
    }

    const childListId = this.properties.relatedListId;
    if (childListId) {
      void this._loadChildViews(childListId).then(() => this.context.propertyPane.refresh()).catch(() => {});
      void this._loadChildFields(childListId).then(() => this.context.propertyPane.refresh()).catch(() => {});
    } else {
      this._childViewOptions = [];
      this._childFieldOptionsChild = [];
      this._childFieldsLoadedFor = undefined;
      this._childViewsLoadedFor = undefined;
    }
  }

  protected onPropertyPaneFieldChanged(prop: string, oldVal: unknown, newVal: unknown): void {
    if (prop === "listId" && newVal !== oldVal) {
      this.properties.viewId = undefined;
      this.properties.toggleField = undefined;

      this._viewOptions = [];
      this._boolFieldOptions = [];
      this._viewsLoadedFor = undefined;
      this._boolsLoadedFor = undefined;

      if (newVal) {
        const id = String(newVal);
        void this._loadViews(id).then(() => this.context.propertyPane.refresh()).catch(() => {});
        void this._loadBooleanFields(id).then(() => this.context.propertyPane.refresh()).catch(() => {});
      }
      this.render();
    }

    if (prop === "relatedListId" && newVal !== oldVal) {
      this.properties.relatedChildViewId = undefined;
      this.properties.relatedChildField = undefined;

      this._childViewOptions = [];
      this._childFieldOptionsChild = [];
      this._childViewsLoadedFor = undefined;
      this._childFieldsLoadedFor = undefined;

      if (newVal) {
        const id = String(newVal);
        void this._loadChildViews(id).then(() => this.context.propertyPane.refresh()).catch(() => {});
        void this._loadChildFields(id).then(() => this.context.propertyPane.refresh()).catch(() => {});
      }
      this.render();
    }

    const _trackedProps = [
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
    ];
    if (_trackedProps.indexOf(prop) !== -1) {
      if (newVal !== oldVal) this.render();
    }

    super.onPropertyPaneFieldChanged(prop, oldVal, newVal);
  }

  private async _loadLists(): Promise<void> {
    const rows = (await this._sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")()) as Array<{
      Id: string; Title: string; Hidden: boolean; BaseTemplate: number;
    }>;
    this._listOptions = rows.filter(l => !l.Hidden).map(l => ({ key: l.Id, text: l.Title }));
    this._listsLoaded = true;
  }

  private async _loadViews(listId: string): Promise<void> {
    const rows = (await this._sp.web.lists.getById(listId)
      .views.select("Id", "Title", "Hidden", "PersonalView")()) as Array<{
        Id: string; Title: string; Hidden: boolean; PersonalView: boolean;
      }>;
    this._viewOptions = rows.filter(v => !v.Hidden && !v.PersonalView).map(v => ({ key: v.Id, text: v.Title }));
    this._viewsLoadedFor = listId;
  }

  private async _loadBooleanFields(listId: string): Promise<void> {
    const fields = (await this._sp.web.lists.getById(listId).fields
      .select("InternalName", "Title", "Hidden", "TypeAsString")()) as Array<{
        InternalName: string; Title: string; Hidden: boolean; TypeAsString: string;
      }>;
    this._boolFieldOptions = fields
      .filter(f => !f.Hidden && f.TypeAsString === "Boolean")
      .map(f => ({ key: f.InternalName, text: `${f.Title} (${f.InternalName})` }));
    this._boolsLoadedFor = listId;
  }

  // ------- Relacionados (lista hija)
  private async _loadChildLists(): Promise<void> {
    const rows = (await this._sp.web.lists.select("Id", "Title", "Hidden", "BaseTemplate")()) as Array<{
      Id: string; Title: string; Hidden: boolean; BaseTemplate: number;
    }>;
    this._childListOptions = rows.filter(l => !l.Hidden).map(l => ({ key: l.Id, text: l.Title }));
  }

  private async _loadChildViews(listId: string): Promise<void> {
    const rows = (await this._sp.web.lists.getById(listId)
      .views.select("Id", "Title", "Hidden", "PersonalView")()) as Array<{
        Id: string; Title: string; Hidden: boolean; PersonalView: boolean;
      }>;
    this._childViewOptions = rows.filter(v => !v.Hidden && !v.PersonalView).map(v => ({ key: v.Id, text: v.Title }));
    this._childViewsLoadedFor = listId;
  }

  private async _loadChildFields(listId: string): Promise<void> {
    const fields = (await this._sp.web.lists.getById(listId).fields
      .select("InternalName", "Title", "Hidden", "ReadOnlyField", "Sealed", "TypeAsString")()) as Array<{
        InternalName: string; Title: string; Hidden: boolean; ReadOnlyField: boolean; Sealed: boolean; TypeAsString: string;
      }>;
    const usable = fields.filter(f => !f.Hidden && !f.Sealed);
    this._childFieldOptionsChild = usable.map(f => ({ key: f.InternalName, text: `${f.Title} (${f.InternalName})` }));
    this._childFieldsLoadedFor = listId;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: "Configuración" },
          groups: [
            {
              groupName: "Origen de datos",
              groupFields: [
                PropertyPaneDropdown("listId", {
                  label: "Lista",
                  options: this._listOptions,
                  selectedKey: this.properties.listId,
                  disabled: !this._listsLoaded,
                }),
                PropertyPaneDropdown("viewId", {
                  label: "Vista (opcional)",
                  options: this._viewOptions,
                  selectedKey: this.properties.viewId,
                  disabled: !this.properties.listId || this._viewsLoadedFor !== this.properties.listId,
                }),
                PropertyPaneDropdown("toggleField", {
                  label: "Campo booleano (Activar/Desactivar)",
                  options: this._boolFieldOptions,
                  selectedKey: this.properties.toggleField,
                  disabled: !this.properties.listId || this._boolsLoadedFor !== this.properties.listId,
                }),
              ],
            },
            {
              groupName: "Acciones",
              groupFields: [
                PropertyPaneCheckbox("showAdd", { text: "Mostrar botón 'Agregar'" }),
                PropertyPaneCheckbox("showEdit", { text: "Mostrar 'Editar en línea'" }),
                PropertyPaneCheckbox("showDelete", { text: "Mostrar botón 'Borrar'" }),
                PropertyPaneCheckbox("showToggle", { text: "Mostrar botón 'Activar/Desactivar'" }),
              ],
            },
            {
              groupName: "Semáforo",
              groupFields: [
                PropertyPaneCheckbox("enableSemaforo", { text: "Activar semáforo" }),
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
              groupName: "Documentos relacionados",
              groupFields: [
                PropertyPaneDropdown("relatedListId", {
                  label: "Lista hija",
                  options: this._childListOptions,
                  selectedKey: this.properties.relatedListId,
                }),
                PropertyPaneTextField("relatedParentField", {
                  label: "Campo en la lista madre (InternalName)",
                  placeholder: "Ej: Placa",
                }),
                PropertyPaneDropdown("relatedChildField", {
                  label: "Campo en la lista hija para igualar",
                  options: this._childFieldOptionsChild,
                  selectedKey: this.properties.relatedChildField,
                  disabled: !this.properties.relatedListId || this._childFieldsLoadedFor !== this.properties.relatedListId,
                }),
                PropertyPaneDropdown("relatedChildViewId", {
                  label: "Vista de la lista hija (para el modal)",
                  options: this._childViewOptions,
                  selectedKey: this.properties.relatedChildViewId,
                  disabled: !this.properties.relatedListId || this._childViewsLoadedFor !== this.properties.relatedListId,
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
