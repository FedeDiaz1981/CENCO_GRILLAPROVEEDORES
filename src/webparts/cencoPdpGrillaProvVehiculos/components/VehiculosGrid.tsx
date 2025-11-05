// VehiculosGrid.tsx
import * as React from "react";
import {
  ThemeProvider,
  createTheme,
  Stack,
  CommandBar,
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
  TextField,
  Dropdown,
  IDropdownOption,
  Spinner,
  Modal,
} from "@fluentui/react";
import { mergeStyles, mergeStyleSets } from "@fluentui/react/lib/Styling";
import { IVehiculosService, EditField } from "../services/IVehiculosService";
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
  const [dynSchema, setDynSchema] = React.useState<Record<string, EditField>>({});
  const [dynLookupOpts, setDynLookupOpts] = React.useState<Record<string, IDropdownOption[]>>({});

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

  const loadDynamic = React.useCallback(async () => {
    if (!viewId) {
      setDynCols(null);
      setDynItems(null);
      setDynSchema({});
      setDynLookupOpts({});
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

    const fieldNames = res.columns.map((c) => c.fieldName || c.key);
    const metas = await service.getFieldsMeta(fieldNames);

    const schemaMap: Record<string, EditField> = {};
    metas.forEach((m) => {
      schemaMap[m.internalName] = m;
    });
    setDynSchema(schemaMap);

    const lookupEntries = await Promise.all(
      metas
        .filter((m) => (m.type === "Lookup" || m.type === "User") && m.lookupListId)
        .map(async (m) => {
          const opts = await service.getLookupOptionsByListId(m.lookupListId!);
          const asDropdown: IDropdownOption[] = opts.map((o) => ({ key: o.key, text: o.text }));
          return [m.internalName, asDropdown] as [string, IDropdownOption[]];
        })
    );
    const lookupMap: Record<string, IDropdownOption[]> = {};
    lookupEntries.forEach(([name, opts]) => {
      lookupMap[name] = opts;
    });
    setDynLookupOpts(lookupMap);
  }, [service, viewId, toggleField]);

  React.useEffect(() => {
    void loadDynamic();
  }, [loadDynamic]);

  const { headerClass, listWrapper, classes, headerStyles, modalHeader, modalBody } = useStyles();
  const width = useWindowW();
  const isMobile = width < 640;

  const [query, setQuery] = React.useState("");
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

  const filterOutIdCols = React.useCallback(
    (cols: IColumn[]) =>
      cols.filter((c) => {
        const n = (c.fieldName || c.key || c.name || "").toString();
        return !/^(ID|Id)$/i.test(n);
      }),
    []
  );

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

  const proveedorText = (v: any): string => {
    if (v.proveedorTitles && v.proveedorTitles.length) return v.proveedorTitles.join(", ");
    const opts = (s.meta?.provOptions || []) as IDropdownOption[];
    const hit = (v.proveedorIds || [])
      .map((id: number) => opts.find((o) => Number(o.key) === id)?.text)
      .filter(Boolean);
    return hit.join(", ");
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
    const rows = s.items.map((v: any) => {
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

  const getRowId = (it: any): number | undefined => {
    if (!it) return undefined;
    return it.id ?? it.Id ?? it.ID ?? it.ItemId ?? it["ID_x0020_"] ?? it["Id_x0020_"];
  };

  const baseColsOnly: IColumn[] = [
    {
      key: "placa",
      name: "Placa",
      minWidth: 100,
      maxWidth: isMobile ? 120 : 160,
      isResizable: true,
      onRender: (it?: any) => {
        if (!it) return null;
        const isEditing = s.editingId === getRowId(it);
        return isEditing ? (
          <TextField value={s.draft?.placa || ""} onChange={(_, v) => updateDraft({ placa: v || "" })} />
        ) : (
          <span>{it.placa}</span>
        );
      },
    },
    {
      key: "proveedor",
      name: "Proveedor",
      minWidth: 160,
      maxWidth: isMobile ? 220 : 300,
      isResizable: true,
      onRender: (it?: any) => {
        if (!it) return null;
        const isEditing = s.editingId === getRowId(it);
        return isEditing ? (
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
        );
      },
    },
  ];

  if (toggleField) {
    baseColsOnly.push({
      key: "activo",
      name: "Activo",
      minWidth: 70,
      maxWidth: 90,
      onRender: (it?: any) => (!it ? null : <span>{it.toggle ? "Sí" : "No"}</span>),
    });
  }

  // ⬇⬇⬇ AQUÍ el cambio importante
  const editableDynCols: IColumn[] | null = React.useMemo(() => {
    if (!dynCols) return null;

    return dynCols.map((c) => {
      const fieldName = c.fieldName || c.key;

      return {
        ...c,
        onRender: (it?: any) => {
          if (!it) return null;
          const rowId = getRowId(it);
          const isEditing = s.editingId === rowId;
          const rawVal = it[fieldName as keyof typeof it];
          const meta = dynSchema[fieldName];

          // ======== LECTURA ========
          if (!isEditing) {
            // boolean
            if (meta?.type === "Boolean") {
              const b =
                rawVal === true ||
                rawVal === 1 ||
                rawVal === "1" ||
                rawVal === "true" ||
                rawVal === "TRUE";
              return <span>{b ? "Sí" : "No"}</span>;
            }

            // lookup / user
            if (meta && (meta.type === "Lookup" || meta.type === "User")) {
              const opts = dynLookupOpts[fieldName];
              let display: string | undefined;

              // 1) si vino como objeto con Title
              if (rawVal && typeof rawVal === "object" && "Title" in rawVal) {
                display = String((rawVal as any).Title || "");
              }

              // 2) si vino directamente como texto (porque ya lo resolviste en el service)
              if (!display && (typeof rawVal === "string" || typeof rawVal === "number")) {
                display = String(rawVal);
              }

              // 3) si no vino nada en el campo "limpio", probamos con los típicos ...Id
              if (!display && opts && opts.length) {
                const idCandidates = [
                  it[`${fieldName}Id`],
                  it[`${fieldName}_Id`],
                  it[`${fieldName}ID`],
                ];
                const first = idCandidates.find((x) => x !== undefined && x !== null);
                if (Array.isArray(first)) {
                  const texts = first
                    .map((id: any) => {
                      const hit = opts.find((o) => Number(o.key) === Number(id));
                      return hit ? hit.text : undefined;
                    })
                    .filter(Boolean)
                    .join(", ");
                  display = texts;
                } else if (first !== undefined && first !== null) {
                  const hit = opts.find((o) => Number(o.key) === Number(first));
                  display = hit ? hit.text : String(first);
                }
              }

              return <span>{display ?? ""}</span>;
            }

            // multichoice
            if (meta?.type === "MultiChoice") {
              return <span>{Array.isArray(rawVal) ? rawVal.join(", ") : ""}</span>;
            }

            if (Array.isArray(rawVal)) return <span>{rawVal.map((x: any) => x?.Title ?? x ?? "").join(", ")}</span>;
            if (rawVal && typeof rawVal === "object") return <span>{String((rawVal as any).Title ?? stringify(rawVal))}</span>;
            return <span>{rawVal ?? ""}</span>;
          }

          // ======== EDICIÓN ========
          if (meta) {
            const t = meta.type;

            if (t === "Boolean") {
              const current =
                (s.draft as any)?.[fieldName] ??
                (rawVal === true ||
                  rawVal === 1 ||
                  rawVal === "1" ||
                  rawVal === "true" ||
                  rawVal === "TRUE");
              return (
                <Dropdown
                  options={[
                    { key: "true", text: "Sí" },
                    { key: "false", text: "No" },
                  ]}
                  selectedKey={current ? "true" : "false"}
                  onChange={(_, opt) => updateDraft({ [fieldName]: opt?.key === "true" } as any)}
                />
              );
            }

            if (t === "Choice" && meta.choices && meta.choices.length) {
              const opts: IDropdownOption[] = meta.choices.map((ch: string) => ({ key: ch, text: ch }));
              const current =
                (s.draft as any)?.[fieldName] ??
                (rawVal && typeof rawVal === "object" && "Title" in rawVal
                  ? (rawVal as any).Title
                  : rawVal ?? "");
              return (
                <Dropdown
                  options={opts}
                  selectedKey={current ? String(current) : undefined}
                  onChange={(_, opt) => updateDraft({ [fieldName]: opt ? String(opt.key) : "" } as any)}
                />
              );
            }

            if (t === "MultiChoice" && meta.choices && meta.choices.length) {
              const opts: IDropdownOption[] = meta.choices.map((ch: string) => ({ key: ch, text: ch }));
              const current: string[] =
                (s.draft as any)?.[fieldName] ?? (Array.isArray(rawVal) ? (rawVal as string[]) : []);
              return (
                <Dropdown
                  multiSelect
                  options={opts}
                  selectedKeys={current}
                  onChange={(_, opt) => {
                    const key = String(opt!.key);
                    const prev: string[] =
                      (s.draft as any)?.[fieldName]
                        ? ((s.draft as any)[fieldName] as string[]).slice()
                        : Array.isArray(rawVal)
                        ? (rawVal as string[]).slice()
                        : [];
                    const idx = prev.indexOf(key);
                    if (opt?.selected) {
                      if (idx === -1) prev.push(key);
                    } else {
                      if (idx !== -1) prev.splice(idx, 1);
                    }
                    updateDraft({ [fieldName]: prev } as any);
                  }}
                />
              );
            }

            if ((t === "Lookup" || t === "User") && meta.lookupListId) {
              const opts = dynLookupOpts[fieldName] || [];
              const currentDraft = (s.draft as any)?.[fieldName];

              // 👇 tratar de obtener un id también desde los ...Id del item
              const idCandidates = [
                currentDraft,
                rawVal,
                it[`${fieldName}Id`],
                it[`${fieldName}_Id`],
                it[`${fieldName}ID`],
              ];
              let selectedKey: number | string | undefined;
              for (const cand of idCandidates) {
                if (typeof cand === "number" || typeof cand === "string") {
                  selectedKey = cand;
                  break;
                }
                if (cand && typeof cand === "object" && "Title" in cand) {
                  const hit = opts.find((o) => o.text === (cand as any).Title);
                  if (hit) {
                    selectedKey = hit.key;
                    break;
                  }
                }
              }

              return (
                <Dropdown
                  options={opts}
                  selectedKey={selectedKey}
                  onChange={(_, opt) => updateDraft({ [fieldName]: opt ? opt.key : null } as any)}
                />
              );
            }

            if (t === "Number" || t === "Currency") {
              return (
                <TextField
                  type="number"
                  value={
                    (s.draft as any)?.[fieldName] != null
                      ? String((s.draft as any)[fieldName])
                      : rawVal != null
                      ? String(rawVal)
                      : ""
                  }
                  onChange={(_, v) => updateDraft({ [fieldName]: v } as any)}
                />
              );
            }

            if (t === "DateTime") {
              return (
                <TextField
                  type="date"
                  value={
                    (s.draft as any)?.[fieldName]
                      ? String((s.draft as any)[fieldName]).substring(0, 10)
                      : rawVal
                      ? String(rawVal).substring(0, 10)
                      : ""
                  }
                  onChange={(_, v) => updateDraft({ [fieldName]: v } as any)}
                />
              );
            }
          }

          return (
            <TextField
              value={(s.draft as any)?.[fieldName] ?? (rawVal != null ? String(rawVal) : "")}
              onChange={(_, v) => updateDraft({ [fieldName]: v || "" } as any)}
            />
          );
        },
      };
    });
  }, [dynCols, dynSchema, dynLookupOpts, s.editingId, s.draft, updateDraft]);

  const colActions: IColumn = {
    key: "acciones",
    name: "Acciones",
    minWidth: 140,
    onRender: (it?: any) => {
      if (!it) return null;
      const thisId = getRowId(it);
      const isEditing = s.editingId === thisId;
      const real = s.items.find((row: any) => getRowId(row) === thisId) as Vehiculo | undefined;
      return isEditing ? (
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          <IconButton iconProps={{ iconName: "CheckMark" }} title="Confirmar" onClick={() => confirm().catch(() => {})} disabled={s.saving} />
          <IconButton iconProps={{ iconName: "Cancel" }} title="Cancelar" onClick={() => cancel()} disabled={s.saving} />
        </Stack>
      ) : (
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          {showEdit && (
            <IconButton iconProps={{ iconName: "Edit" }} title="Editar" onClick={() => enterEdit(real || it)} />
          )}
          {showDelete && real && (
            <IconButton iconProps={{ iconName: "Delete" }} title="Borrar" onClick={() => remove(real.id).catch(() => {})} />
          )}
          {toggleField && showToggle && real && (
            <IconButton
              iconProps={{ iconName: real.toggle ? "CircleStop" : "Play" }}
              title={real.toggle ? "Desactivar" : "Activar"}
              onClick={() => toggleActive(real).catch(() => {})}
            />
          )}
          {relatedListId && relatedParentField && relatedChildField && (
            <IconButton
              iconProps={{ iconName: "FileTemplate" }}
              title="Documentos relacionados"
              onClick={() => openRelated(it).catch(() => {})}
            />
          )}
        </Stack>
      );
    },
  };

  const columnsSem = enableSemaforo
    ? [
        {
          key: "semaforo",
          name: "Estado",
          minWidth: 140,
          onRender: (it?: any) => (it ? renderSemaforo(it) : null),
        } as IColumn,
        ...(editableDynCols ? editableDynCols : baseColsOnly),
      ]
    : editableDynCols
    ? editableDynCols
    : baseColsOnly;

  const columns: IColumn[] = [...columnsSem, colActions];

  const canAdd = s.canEdit && showAdd && !dynItems;

  const cmdItems = [
    ...(canAdd
      ? [
          {
            key: "add",
            text: "Agregar",
            iconProps: { iconName: "Add" },
            disabled: s.editingId !== undefined,
            onClick: () => addNew(),
          } as const,
        ]
      : []),
    {
      key: "export",
      text: "Exportar",
      iconProps: { iconName: "ExcelDocument" },
      onClick: () => exportToCsv(),
    },
    {
      key: "refresh",
      text: "Refrescar",
      iconProps: { iconName: "Refresh" },
      onClick: () => {
        refresh().catch(() => {});
        loadDynamic().catch(() => {});
      },
    },
  ];

  const onRenderRow = (rowProps?: any) => {
    if (!rowProps) return null;
    const customStyles: Partial<IDetailsRowStyles> = {
      root: { selectors: { "&:hover": { background: "#f0f7ff !important" } } },
    };
    return <DetailsRow {...rowProps} styles={customStyles} className={classes.zebraRow} />;
  };

  const onRenderDetailsHeader = (
    props?: IDetailsHeaderProps,
    defaultRender?: IRenderFunction<IDetailsHeaderProps>
  ) => {
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
                    if (col.onRender) return col.onRender(item, _i, col);
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
