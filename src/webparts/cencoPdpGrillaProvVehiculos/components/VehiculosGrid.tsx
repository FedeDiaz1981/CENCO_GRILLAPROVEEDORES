// VehiculosGrid.tsx
import * as React from "react";
import {
  ThemeProvider,
  createTheme,
  Stack,
  CommandBar,
  ICommandBarItemProps,
  SearchBox,
  DetailsList,
  ShimmeredDetailsList,
  IColumn,
  DetailsRow,
  IDetailsRowStyles,
  IDetailsHeaderStyles,
  IDetailsHeaderProps,
  IRenderFunction,
  ConstrainMode,
  SelectionMode,
  IconButton,
  PrimaryButton,
  DefaultButton,
  TextField,
  Dropdown,
  IDropdownOption,
  Spinner,
  Modal,
} from "@fluentui/react";
import { mergeStyles, mergeStyleSets } from "@fluentui/react/lib/Styling";
import { IVehiculosService } from "../services/IVehiculosService";
import { Vehiculo } from "../models/types";
import { useVehiculosGrid } from "../hooks/useVehiculosGrid";

const appTheme = createTheme({
  palette: {
    themePrimary: "#1e88e5",
    themeLighterAlt: "#060a0d",
    themeLighter: "#112b3d",
    themeLight: "#1f4f73",
    themeTertiary: "#3b8fd1",
    themeSecondary: "#2a73b6",
    themeDarkAlt: "#1876cb",
    themeDark: "#1361a8",
    themeDarker: "#0b3f70",
    neutralLighterAlt: "#f7f7f7",
    neutralLighter: "#f3f3f3",
    neutralLight: "#e5e5e5",
    neutralQuaternaryAlt: "#d6d6d6",
    neutralQuaternary: "#cccccc",
    neutralTertiaryAlt: "#c4c4c4",
    neutralTertiary: "#8a8886",
    neutralSecondary: "#605e5c",
    neutralPrimaryAlt: "#3b3a39",
    neutralPrimary: "#323130",
    neutralDark: "#201f1e",
    black: "#000000",
    white: "#ffffff",
  },
  fonts: { medium: { fontSize: "14px" }, large: { fontSize: "16px", fontWeight: 600 } },
});

const useStyles = () => {
  const headerClass = mergeStyles({ position: "sticky", top: 0, zIndex: 2 });
  const listWrapper = mergeStyles({
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 4px 14px rgba(0,0,0,.06)",
    background: "#fff",
  });
  const classes = mergeStyleSets({
    toolbar: { gap: 8, width: "100%" },
    responsiveRow: { width: "100%" },
    zebraRow: {
      selectors: {
        "&:nth-of-type(odd)": { background: "#fafafa" },
        "&:hover": { background: "#f0f7ff" },
      },
    },
  });
  const headerStyles: Partial<IDetailsHeaderStyles> = {
    root: {
      background: "linear-gradient(90deg, #1e88e5 0%, #3b8fd1 100%)",
      color: "#fff",
      selectors: {
        ".ms-DetailsHeader-cellTitle": { color: "#fff", fontWeight: 600 },
        ".ms-DetailsHeader-cellName": { color: "#fff", fontWeight: 600 },
      },
    },
  };
  const modalHeader = mergeStyles({
    background: "linear-gradient(90deg, #1e88e5 0%, #3b8fd1 100%)",
    color: "#fff",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  });
  const modalBody = mergeStyles({
    padding: 12,
    background: "#fff",
    maxHeight: "70vh",
    overflow: "auto",
  });
  return { headerClass, listWrapper, classes, headerStyles, modalHeader, modalBody };
};

const useWindowW = () => {
  const [w, setW] = React.useState<number>(typeof window === "undefined" ? 1200 : window.innerWidth);
  React.useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return w;
};

type Semaforo = "Vigente" | "Por vencer" | "Vencido";

const calcSemaforo = (fechaStr?: string, warnDays = 30, now = new Date()): Semaforo => {
  if (!fechaStr) return "Vencido";
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return "Vencido";
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tf = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  if (tf < t0) return "Vencido";
  const diff = Math.ceil((tf - t0) / 86400000);
  return diff <= warnDays ? "Por vencer" : "Vigente";
};
const semaforoColor = (s: Semaforo) => (s === "Vigente" ? "#14ae5c" : s === "Por vencer" ? "#f5a524" : "#f31260");

type Props = {
  service: IVehiculosService;
  groupNameForEdit: string;
  viewId?: string;
  toggleField?: string;
  showAdd?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showToggle?: boolean;
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
};

const VehiculosGrid: React.FC<Props> = ({
  service,
  groupNameForEdit,
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
  fallbackDateField,
  relatedListId,
  relatedParentField,
  relatedChildField,
  relatedChildViewId,
}) => {
  const [dynCols, setDynCols] = React.useState<IColumn[] | null>(null);
  const [dynItems, setDynItems] = React.useState<any[] | null>(null);

  const loadDynamic = React.useCallback(async () => {
    if (!viewId) {
      setDynCols(null);
      setDynItems(null);
      return;
    }
    const res = await service.getViewGrid(viewId, toggleField);
    const cols: IColumn[] = res.columns.map((c) => ({
      key: c.key,
      name: c.name,
      fieldName: c.fieldName,
      minWidth: c.minWidth ?? 100,
      isResizable: c.isResizable ?? true,
    }));
    setDynCols(cols);
    setDynItems(res.items);
  }, [service, viewId, toggleField]);

  React.useEffect(() => {
    void loadDynamic();
  }, [loadDynamic]);

  const {
    s,
    enterEdit,
    addNew,
    cancel,
    confirm,
    remove,
    toggleProv,
    updateDraft,
    toggleActive,
    refresh,
  } = useVehiculosGrid(service, groupNameForEdit, viewId, toggleField);

  const { headerClass, listWrapper, classes, headerStyles, modalHeader, modalBody } = useStyles();
  const width = useWindowW();
  const isMobile = width < 640;

  const [query, setQuery] = React.useState("");

  const stringify = (v: unknown): string => {
    if (v == null) return "";
    if (Array.isArray(v)) return (v as unknown[]).map(stringify).join(", ");
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("Title" in o) return String((o as any).Title ?? "");
      return Object.keys(o)
        .map((k) => stringify(o[k]))
        .join(" ");
    }
    return String(v);
  };

  const itemsFiltered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (dynItems) {
      if (!q) return dynItems;
      return dynItems.filter((it) => {
        const obj = it as Record<string, unknown>;
        return Object.keys(obj).some((k) => stringify(obj[k]).toLowerCase().includes(q));
      });
    }
    if (!q) return s.items as Vehiculo[];
    return (s.items as Vehiculo[]).filter((v) => {
      const proveedorText = (v.proveedorTitles || []).join(", ");
      return (
        String(v.placa || "").toLowerCase().includes(q) ||
        String(v.marca || "").toLowerCase().includes(q) ||
        String(v.modelo || "").toLowerCase().includes(q) ||
        proveedorText.toLowerCase().includes(q)
      );
    });
  }, [dynItems, s.items, query]);

  const [cfg, setCfg] = React.useState<Record<string, { dateField: string; warnDays: number }>>({});

  React.useEffect(() => {
    if (!enableSemaforo || !service.getTipoFormularioConfig) return;
    let alive = true;
    service
      .getTipoFormularioConfig(tipoConfigListTitle, tipoConfigKeyField)
      .then((m) => {
        if (alive) setCfg(m || {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enableSemaforo, service, tipoConfigListTitle, tipoConfigKeyField]);

  // Helpers para ocultar ID en el modal
  const filterOutIdCols = React.useCallback(
    (cols: IColumn[]) =>
      cols.filter((c) => {
        const n = (c.fieldName || c.key || c.name || "").toString();
        return !/^(ID|Id)$/i.test(n);
      }),
    []
  );

  // Modal de relacionados
  const [relOpen, setRelOpen] = React.useState(false);
  const [relBusy, setRelBusy] = React.useState(false);
  const [relCols, setRelCols] = React.useState<IColumn[]>([]);
  const [relItems, setRelItems] = React.useState<any[]>([]);

  const openRelated = React.useCallback(
    async (row: any) => {
      if (!relatedListId || !relatedParentField || !relatedChildField) return;
      const parentValue = row?.[relatedParentField];
      setRelOpen(true);
      setRelBusy(true);
      try {
        if (relatedChildViewId) {
          const { columns, items } = await service.getRelatedGridByView(
            relatedListId,
            relatedChildViewId,
            relatedChildField,
            parentValue
          );
          const cols: IColumn[] = filterOutIdCols(
            columns.map((c) => ({
              key: c.key,
              name: c.name,
              fieldName: c.fieldName,
              minWidth: c.minWidth ?? 100,
              isResizable: c.isResizable ?? true,
            }))
          );
          setRelCols(cols);
          setRelItems(items);
        } else {
          const { columns, items } = await service.getRelatedItems({
            childListId: relatedListId,
            childField: relatedChildField,
            parentValue,
          });
          const cols: IColumn[] = filterOutIdCols(
            columns.map((c) => ({
              key: c.key,
              name: c.name,
              fieldName: c.fieldName,
              minWidth: c.minWidth ?? 100,
              isResizable: c.isResizable ?? true,
            }))
          );
          setRelCols(cols);
          setRelItems(items);
        }
      } finally {
        setRelBusy(false);
      }
    },
    [service, relatedListId, relatedParentField, relatedChildField, relatedChildViewId, filterOutIdCols]
  );

  const proveedorText = (v: Vehiculo): string => {
    if (v.proveedorTitles && v.proveedorTitles.length) return v.proveedorTitles.join(", ");
    const opts = (s.meta?.provOptions || []) as IDropdownOption[];
    const hit = opts.filter((o) => v.proveedorIds.indexOf(Number(o.key)) !== -1);
    return hit.map((o) => String(o.text || "")).join(", ");
  };

  const csvEscape = (v: unknown): string => {
    const sVal = v == null ? "" : String(v);
    const needQuotes = /[;"\n\r,]/.test(sVal);
    const esc = sVal.replace(/"/g, '""');
    return needQuotes ? `"${esc}"` : esc;
  };

  const buildExportRows = () => {
    if (dynCols && dynItems) {
      const headers = dynCols.map((c) => c.name);
      const rows = dynItems.map((it: any) => dynCols.map((c) => stringify((it as any)[c.fieldName!])));
      return { headers, rows };
    }
    const headers = ["Placa", "Proveedor", "Marca", "Modelo", ...(toggleField ? ["Activo"] : [])];
    const rows = s.items.map((v: Vehiculo) => {
      const fila: (string | number | boolean)[] = [v.placa || "", proveedorText(v), v.marca || "", v.modelo || ""];
      if (toggleField) fila.push(!!v.toggle ? "Sí" : "No");
      return fila;
    });
    return { headers, rows };
  };

  const exportToCsv = () => {
    const { headers, rows } = buildExportRows();
    const sep = ";";
    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(sep));
    rows.forEach((r: (string | number | boolean)[]) => lines.push(r.map(csvEscape).join(sep)));
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vehiculos.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const renderSemaforo = (it: any) => {
    const keyText = String(it?.[tipoFieldName] ?? "").trim().toLowerCase();
    const rule = keyText ? cfg[keyText] : undefined;
    const dateField = rule?.dateField || fallbackDateField;
    const warnDays = rule?.warnDays ?? defaultWarnDays;
    const rawDate = dateField ? (it?.[dateField] as string | undefined) : undefined;
    const estado = calcSemaforo(rawDate, warnDays);
    const color = semaforoColor(estado);
    const dot: React.CSSProperties = {
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: color,
      marginRight: 8,
      boxShadow: "0 0 0 2px rgba(0,0,0,.06)",
    };
    const tooltip = rawDate ? `${estado} — vence: ${new Date(rawDate).toLocaleDateString()}` : estado;
    return (
      <span title={tooltip}>
        <span style={dot} aria-label={estado} />
        <span>{estado}</span>
      </span>
    );
  };

  const baseColsOnly: IColumn[] = [
    {
      key: "placa",
      name: "Placa",
      minWidth: 100,
      maxWidth: isMobile ? 120 : 160,
      isResizable: true,
      onRender: (it?: Vehiculo) =>
        !it ? null : s.editingId === it.id ? (
          <TextField value={s.draft?.placa || ""} onChange={(_, v) => updateDraft({ placa: v || "" })} />
        ) : (
          <span>{it.placa}</span>
        ),
    },
    {
      key: "proveedor",
      name: "Proveedor",
      minWidth: 160,
      maxWidth: isMobile ? 220 : 300,
      isResizable: true,
      onRender: (it?: Vehiculo) =>
        !it ? null : s.editingId === it.id ? (
          <Dropdown
            placeholder="Seleccione…"
            options={(s.meta?.provOptions || []) as IDropdownOption[]}
            multiSelect={!!s.meta?.provMulti}
            selectedKey={!s.meta?.provMulti ? (s.draft?.proveedorId as number | undefined) : undefined}
            selectedKeys={s.meta?.provMulti ? (s.draft?.proveedorId as number[] | undefined) : undefined}
            onChange={(_, opt) => toggleProv(Number(opt!.key), !!opt?.selected)}
          />
        ) : (
          <span title={proveedorText(it)}>{proveedorText(it)}</span>
        ),
    },
    {
      key: "marca",
      name: "Marca",
      minWidth: 90,
      maxWidth: 140,
      isResizable: true,
      onRender: (it?: Vehiculo) =>
        !it ? null : s.editingId === it.id ? (
          <TextField value={s.draft?.marca || ""} onChange={(_, v) => updateDraft({ marca: v || "" })} />
        ) : (
          <span>{it.marca}</span>
        ),
    },
    {
      key: "modelo",
      name: "Modelo",
      minWidth: 90,
      maxWidth: 160,
      isResizable: true,
      onRender: (it?: Vehiculo) =>
        !it ? null : s.editingId === it.id ? (
          <TextField value={s.draft?.modelo || ""} onChange={(_, v) => updateDraft({ modelo: v || "" })} />
        ) : (
          <span>{it.modelo}</span>
        ),
    },
  ];

  if (toggleField) {
    baseColsOnly.push({
      key: "activo",
      name: "Activo",
      minWidth: 70,
      maxWidth: 90,
      onRender: (it?: Vehiculo) => (!it ? null : <span>{it.toggle ? "Sí" : "No"}</span>),
    });
  }

  const colActions: IColumn = {
    key: "acciones",
    name: "Acciones",
    minWidth: isMobile ? 220 : 320,
    onRender: (it?: any) =>
      !it ? null : s.canEdit ? (
        dynItems ? (
          <Stack horizontal tokens={{ childrenGap: 4 }}>
            {relatedListId && relatedParentField && relatedChildField && (
              <IconButton
                iconProps={{ iconName: "FileTemplate" }}
                title="Documentos relacionados"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openRelated(it).catch(() => {});
                }}
              />
            )}
          </Stack>
        ) : s.editingId === (it as Vehiculo).id ? (
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <PrimaryButton
              text="Confirmar"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                confirm().catch(() => {});
              }}
              disabled={s.saving}
            />
            <DefaultButton
              text="Cancelar"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                cancel();
              }}
              disabled={s.saving}
            />
          </Stack>
        ) : (
          <Stack horizontal tokens={{ childrenGap: 4 }}>
            {toggleField && showToggle && (
              <IconButton
                iconProps={{ iconName: (it as Vehiculo).toggle ? "CircleStop" : "Play" }}
                title={(it as Vehiculo).toggle ? "Desactivar" : "Activar"}
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  toggleActive(it as Vehiculo).catch(() => {});
                }}
              />
            )}
            {showEdit && (
              <IconButton
                iconProps={{ iconName: "Edit" }}
                title="Editar"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  enterEdit(it as Vehiculo);
                }}
              />
            )}
            {showDelete && (
              <IconButton
                iconProps={{ iconName: "Delete" }}
                title="Borrar"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  remove((it as Vehiculo).id).catch(() => {});
                }}
              />
            )}
            {relatedListId && relatedParentField && relatedChildField && (
              <IconButton
                iconProps={{ iconName: "FileTemplate" }}
                title="Documentos relacionados"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openRelated(it).catch(() => {});
                }}
              />
            )}
          </Stack>
        )
      ) : null,
  };

  const columnsSem = enableSemaforo
    ? [
        { key: "semaforo", name: "Estado", minWidth: 140, onRender: (it?: any) => (it ? renderSemaforo(it) : null) } as IColumn,
        ...(dynItems ? dynCols || [] : baseColsOnly),
      ]
    : dynItems
    ? dynCols || []
    : baseColsOnly;

  const columns = s.canEdit ? [...columnsSem, colActions] : columnsSem;

  const canAdd = s.canEdit && showAdd && !dynItems;
  const cmdItems: ICommandBarItemProps[] = [
    ...(canAdd
      ? [
          {
            key: "add",
            text: "Agregar",
            iconProps: { iconName: "Add" },
            disabled: s.editingId !== undefined,
            onClick: () => addNew(),
          } as ICommandBarItemProps,
        ]
      : []),
    { key: "export", text: "Exportar", iconProps: { iconName: "ExcelDocument" }, onClick: exportToCsv },
    {
      key: "refresh",
      text: "Refrescar",
      iconProps: { iconName: "Refresh" },
      onClick: async () => {
        await refresh();
        await loadDynamic();
      },
    },
  ];

  const onRenderRow = (rowProps?: any) => {
    if (!rowProps) return null;
    const customStyles: Partial<IDetailsRowStyles> = { root: { selectors: { "&:hover": { background: "#f0f7ff !important" } } } };
    return <DetailsRow {...rowProps} styles={customStyles} className={classes.zebraRow} />;
  };

  const onRenderDetailsHeader = (props?: IDetailsHeaderProps, defaultRender?: IRenderFunction<IDetailsHeaderProps>) => {
    if (!props || !defaultRender) return null;
    const mergedProps: IDetailsHeaderProps = { ...props, styles: { ...props.styles, ...headerStyles } };
    return <div className={headerClass}>{defaultRender(mergedProps)}</div>;
  };

  if (s.loading && !dynItems) {
    return (
      <ThemeProvider theme={appTheme}>
        <ShimmeredDetailsList enableShimmer items={[]} columns={columns} selectionMode={SelectionMode.none} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={appTheme}>
      <Stack tokens={{ childrenGap: 12 }}>
        <Stack horizontal wrap horizontalAlign="space-between" className={classes.toolbar}>
          <Stack className={classes.responsiveRow} horizontal wrap tokens={{ childrenGap: 8 }} verticalAlign="center">
            <CommandBar items={cmdItems} ariaLabel="Acciones" />
          </Stack>
          <Stack className={classes.responsiveRow} horizontalAlign="end">
            <SearchBox
              placeholder="Buscar…"
              underlined
              onChange={(_, v) => setQuery(v || "")}
              styles={{ root: { minWidth: isMobile ? "100%" : 320 } }}
            />
          </Stack>
        </Stack>

        <div className={listWrapper}>
          <DetailsList
            items={itemsFiltered}
            columns={columns}
            selectionMode={SelectionMode.none}
            constrainMode={ConstrainMode.horizontalConstrained}
            onRenderRow={onRenderRow}
            onRenderDetailsHeader={onRenderDetailsHeader}
            compact={isMobile}
            styles={{ root: { width: "100%" } }}
            onRenderItemColumn={
              dynItems
                ? (item?: any, _i?: number, col?: IColumn) => {
                    if (!item || !col) return null;
                    const v = item[col.fieldName!];
                    if (v == null) return "";
                    if (Array.isArray(v)) return v.map((x) => (x?.Title ?? x ?? "")).join(", ");
                    if (typeof v === "object") return String((v as any).Title ?? stringify(v));
                    return String(v);
                  }
                : undefined
            }
          />
        </div>

        {/* Modal Documentos Relacionados (ocultando ID) */}
        <Modal
          isOpen={relOpen}
          onDismiss={() => setRelOpen(false)}
          isBlocking={false}
          allowTouchBodyScroll
          styles={{
            main: {
              width: isMobile ? "96vw" : "84vw",
              maxWidth: "1200px",
              borderRadius: 12,
              overflow: "hidden",
            },
          }}
        >
          <div className={modalHeader}>
            <span style={{ fontWeight: 600 }}>Documentos relacionados</span>
            <IconButton
              iconProps={{ iconName: "Cancel" }}
              styles={{ root: { color: "#fff" }, rootHovered: { color: "#fff" } }}
              onClick={() => setRelOpen(false)}
              ariaLabel="Cerrar"
            />
          </div>
          <div className={modalBody}>
            {relBusy ? (
              <Spinner label="Cargando..." />
            ) : (
              <div className={listWrapper} style={{ boxShadow: "none" }}>
                <DetailsList
                  items={relItems}
                  columns={filterOutIdCols(
                    relCols.map((c) => ({
                      ...c,
                      minWidth: c.minWidth ?? 100,
                      isResizable: true,
                    }))
                  )}
                  selectionMode={SelectionMode.none}
                  constrainMode={ConstrainMode.horizontalConstrained}
                  compact={isMobile}
                  onRenderItemColumn={(item?: any, _?: number, col?: IColumn) => {
                    if (!item || !col) return null;
                    const v = item[col.fieldName!];
                    if (v == null) return "";
                    if (Array.isArray(v)) return v.map((x) => (x?.Title ?? x ?? "")).join(", ");
                    if (typeof v === "object") return String((v as any).Title ?? "");
                    return String(v);
                  }}
                />
              </div>
            )}
          </div>
        </Modal>
      </Stack>
    </ThemeProvider>
  );
};

export default VehiculosGrid;
