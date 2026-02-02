// VehiculosGrid.tsx
/* eslint-disable max-lines */
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
  IDetailsRowProps,
  IDetailsRowStyles,
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
  PrimaryButton,
  DefaultButton,
} from "@fluentui/react";
import { mergeStyles, mergeStyleSets } from "@fluentui/react/lib/Styling";
import { IVehiculosService, EditField } from "../services/IVehiculosService";
import type { ParentValue } from "../services/IVehiculosService";
import { Vehiculo } from "../models/types";
import { useVehiculosGrid } from "../hooks/useVehiculosGrid";

type RowItem = Record<string, unknown> & {
  id?: number;
  Id?: number;
  ID?: number;
  ItemId?: number;
  ID_x0020_?: number;
  Id_x0020_?: number;
  toggle?: boolean;
  placa?: string;
};

type ExportRows = {
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
};

// Header: sin hover desprolijo / sin underline / sin fondo raro
const headerStyles = {
  root: {
    selectors: {
      ".ms-DetailsHeader-cellTitle": {
        padding: "0 8px",
        background: "transparent",
      },
      ".ms-DetailsHeader-cellTitle:hover": {
        background: "transparent",
      },
      ".ms-DetailsHeader-cellTitle:hover .ms-DetailsHeader-cellName": {
        textDecoration: "none",
      },
      ".ms-DetailsHeader-cellName": {
        textDecoration: "none",
      },
    },
  },
};

// ====== tema base ======
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
  fonts: {
    medium: { fontSize: "14px" },
    large: { fontSize: "16px", fontWeight: 600 },
  },
});

// ====== inyecta css solo una vez ======
const ensureSharedStyles = (): void => {
  const id = "cnco-vehiculos-shared";

  const css = `
    th:hover { background-color: transparent !important; }
    div[role=columnheader]:hover { background-color: transparent !important; }

    .cnco-vehiculos-shell{box-sizing:border-box;width:100%}
    .cnco-vehiculos-shell *,.cnco-vehiculos-shell *::before,.cnco-vehiculos-shell *::after{box-sizing:inherit}

    .cnco-vehiculos-shell .cnco-toolbar{
      width:100%;
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center;
      flex-wrap:wrap;
    }

    .cnco-vehiculos-shell .ms-SearchBox{max-width:320px}
    .cnco-vehiculos-shell .ms-SearchBox-field{
      height:32px!important;
      line-height:32px!important;
      font-size:14px!important;
    }

    .cnco-vehiculos-shell .cnco-list-wrapper{
      border-radius:12px;
      overflow:hidden;
      background:#fff;
      box-shadow:0 4px 14px rgba(0,0,0,.06);
    }

    /* ===== Header (lo que SP más pisa) ===== */
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader{
      background:linear-gradient(90deg,#1e88e5 0%,#3b8fd1 100%)!important;
      min-height:72px!important;
      border:0!important;
    }

    /* fuerza color texto + iconos (sort/chevron) */
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader,
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader *{
      color:#fff!important;
      fill:#fff!important;
    }

    /* evita el “bloque blanco” y subrayado en hover/focus */
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle{
      padding:0 8px!important;
      background:transparent!important;
      min-height:72px!important;
      display:flex!important;
      align-items:center!important;
      box-shadow:none!important;
      border:0!important;
      outline:none!important;
    }

    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle:hover,
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle:active,
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle:focus,
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle:focus-within{
      background:transparent!important;
      box-shadow:none!important;
      outline:none!important;
    }

    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellName{
      text-decoration:none!important;
      cursor:pointer!important;
      font-weight:600!important;
    }
    .cnco-vehiculos-shell .cnco-sticky-header .ms-DetailsHeader-cellTitle:hover .ms-DetailsHeader-cellName{
      text-decoration:none!important;
    }

    /* ===== Rows ===== */
    .cnco-vehiculos-shell .cnco-row:nth-of-type(odd){background:#fafafa}
    .cnco-vehiculos-shell .cnco-row:hover{background:#f0f7ff!important}

    .cnco-vehiculos-shell .ms-CommandBar{margin:0!important}
  `;

  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
  }
  style.textContent = css;
  document.head.appendChild(style);

  const w = window as unknown as { __cncoVehStylesObs?: MutationObserver };
  if (!w.__cncoVehStylesObs) {
    const obs = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (document.head.lastElementChild !== el) {
        document.head.appendChild(el);
      }
    });
    obs.observe(document.head, { childList: true });
    w.__cncoVehStylesObs = obs;
  }
};

// ====== estilos locales ======
type StylesBundle = {
  headerClass: string;
  listWrapper: string;
  classes: { toolbar: string; responsiveRow: string };
  modalHeader: string;
  modalBody: string;
  titleBar: string;
  titleText: string;
};

const useStyles = (): StylesBundle => {
  const headerClass = mergeStyles("cnco-sticky-header", {
    position: "sticky",
    top: 0,
    zIndex: 2,
  });
  const listWrapper = mergeStyles("cnco-list-wrapper");
  const classes = mergeStyleSets({
    toolbar: "cnco-toolbar",
    responsiveRow: { width: "100%" },
  });

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

  const titleBar = mergeStyles({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 12,

    background: "#f7f7f7",
    border: "1px solid #e5e5e5",
    boxShadow: "0 2px 10px rgba(0,0,0,.06)",
  });

  const titleText = mergeStyles({
    fontSize: 16,
    fontWeight: 700,
    color: "#323130",
    lineHeight: "20px",
  });

  return {
    headerClass,
    listWrapper,
    classes,
    modalHeader,
    modalBody,
    titleBar,
    titleText,
  };
};

const useWindowW = (): number => {
  const [w, setW] = React.useState<number>(
    typeof window === "undefined" ? 1200 : window.innerWidth
  );

  React.useEffect(() => {
    const onR = (): void => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  return w;
};

type Semaforo = "Vigente" | "Por vencer" | "Vencido";
const calcSemaforo = (
  fechaStr?: string,
  warnDays = 30,
  now = new Date()
): Semaforo => {
  if (!fechaStr) return "Vencido";
  const f = new Date(fechaStr);
  if (Number.isNaN(f.getTime())) return "Vencido";
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tf = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  if (tf < t0) return "Vencido";
  const diff = Math.ceil((tf - t0) / 86400000);
  return diff <= warnDays ? "Por vencer" : "Vigente";
};

const semaforoColor = (s: Semaforo): string =>
  s === "Vigente" ? "#14ae5c" : s === "Por vencer" ? "#f5a524" : "#f31260";

// ✅ Nuevo: modo del modal de motivo
type MotivoMode = "none" | "approve" | "reject" | "both";

// (dejamos type antiguo por compat, pero ya no lo usamos)
type ApprovalMode = "traditional" | "automate" | "both";

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
  relatedEditViewId?: string;
  allowRelatedEdit?: boolean;

  showDownloadAttachments?: boolean;
  listId: string;

  // ===== UI: título + colapsable =====
  gridTitle?: string;
  gridCollapsible?: boolean;
  gridDefaultCollapsed?: boolean;

  // ✅ estilo del título
  gridTitleFontSize?: number;
  gridTitleColor?: string;
  gridTitleFontWeight?: string | number;
  gridTitleFontFamily?: string;

  // ===== Aprobación (legacy) =====
  enableApproval?: boolean;
  approvalGroupName?: string;
  approvalStatusField?: string;
  approvalReasonField?: string;

  // ===== Aprobación (nuevo, desde webpart) =====
  enableApproveModal?: boolean;
  approveGroupName?: string;
  approveStatusField?: string;
  approveReasonField?: string;
  approveApprovedValue?: string;
  approveRejectedValue?: string;
  approveModalTitle?: string;

  // ✅ NUEVO: finalizado
  approveFinalizadoField?: string;

  // ✅ NUEVO: modal motivo y obligatoriedad
  approveMotivoModalMode?: MotivoMode; // none | approve | reject | both
  approveMotivoRequiredMode?: MotivoMode; // none | approve | reject | both

  // ✅ NUEVO: WF status fields
  wfStatusField?: string; // choice: Pendiente|Ok|Error
  wfErrorField?: string; // multiline text

  // compat (antes)
  approvalMode?: ApprovalMode;
  automateApproveUrl?: string;
  automateRejectUrl?: string;
};

const UI_PAGE_SIZE = 10;
const FETCH_BATCH = 30;
const PREFETCH_THRESHOLD = 10;
const DYN_CACHE_TTL_MS = 5 * 60 * 1000;

type DynCacheKey = string;
type DynCacheEntry = {
  ts: number;
  cols?: IColumn[];
  buffer: RowItem[];
  nextToken?: string;
  schema: Record<string, EditField>;
  lookupOpts: Record<string, IDropdownOption[]>;
};

const DYN_CACHE = new Map<DynCacheKey, DynCacheEntry>();

const makeDynCacheKey = (p: {
  viewId?: string;
  toggleField?: string;
  service: IVehiculosService;
}): string => {
  const svc = p.service as unknown as {
    listId?: unknown;
    _listId?: unknown;
    baseListId?: unknown;
  };
  const listId = String(svc.listId ?? svc._listId ?? svc.baseListId ?? "");
  return `vehiculosGrid:${listId}:${String(p.viewId ?? "")}:${String(
    p.toggleField ?? ""
  )}`;
};

const readDynCache = (key: DynCacheKey): DynCacheEntry | undefined => {
  const hit = DYN_CACHE.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > DYN_CACHE_TTL_MS) {
    DYN_CACHE.delete(key);
    return undefined;
  }
  return hit;
};

const writeDynCache = (key: DynCacheKey, entry: Omit<DynCacheEntry, "ts">): void => {
  DYN_CACHE.set(key, { ts: Date.now(), ...entry });
};

const clearDynCache = (key: DynCacheKey): void => {
  DYN_CACHE.delete(key);
};

type ViewGridColumn = {
  key: string;
  name: string;
  fieldName?: string;
  minWidth?: number;
  isResizable?: boolean;
};

type SortState = { field?: string; desc: boolean };

const getRowId = (it: RowItem | undefined): number | undefined => {
  if (!it) return undefined;
  return it.id ?? it.Id ?? it.ID ?? it.ItemId ?? it.ID_x0020_ ?? it.Id_x0020_;
};

const VehiculosGrid: React.FC<Props> = (props) => {
  const {
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
    relatedEditViewId,
    allowRelatedEdit = false,

    listId,
    showDownloadAttachments = true,

    // ===== UI: título + colapsable =====
    gridTitle = "",
    gridCollapsible = false,
    gridDefaultCollapsed = false,

    // ✅ estilo del título (defaults)
    gridTitleFontSize = 16,
    gridTitleColor = "#323130",
    gridTitleFontWeight = "700",
    gridTitleFontFamily = "Segoe UI",

    // legacy
    enableApproval = false,
    approvalGroupName = "Distribucion",
    approvalStatusField = "EstadoAprobacion",
    approvalReasonField = "Motivo",

    // nuevo (webpart)
    enableApproveModal,
    approveGroupName,
    approveStatusField,
    approveReasonField,
    approveApprovedValue,
    approveRejectedValue,
    approveModalTitle,

    // ✅ finalizado
    approveFinalizadoField = "",

    // ✅ motivo modal
    approveMotivoModalMode = "reject",
    approveMotivoRequiredMode = "reject",

    // ✅ wf fields
    wfStatusField = "wfstatus",
    wfErrorField = "wferror",

    // compat (antes)
    automateApproveUrl = "",
    automateRejectUrl = "",
  } = props;

  React.useEffect(() => {
    ensureSharedStyles();
  }, []);

  // ✅ colapsable
  const [collapsed, setCollapsed] = React.useState<boolean>(
    Boolean(gridCollapsible && gridDefaultCollapsed)
  );
  React.useEffect(() => {
    setCollapsed(Boolean(gridCollapsible && gridDefaultCollapsed));
  }, [gridCollapsible, gridDefaultCollapsed]);

  // ✅ estilo inline del título
  const titleStyle = React.useMemo<React.CSSProperties>(() => {
    const fs = Number(gridTitleFontSize);
    const safeFontSize = Number.isFinite(fs) && fs > 0 ? fs : 16;

    return {
      fontSize: `${safeFontSize}px`,
      color: gridTitleColor || "#323130",
      fontWeight: gridTitleFontWeight ?? "700",
      fontFamily: (gridTitleFontFamily || "Segoe UI").trim(),
    };
  }, [gridTitleFontSize, gridTitleColor, gridTitleFontWeight, gridTitleFontFamily]);

  // ====== SORT state ======
  const [sort, setSort] = React.useState<SortState>({
    field: undefined,
    desc: false,
  });

  const [dynCols, setDynCols] = React.useState<IColumn[] | undefined>(undefined);
  const [dynBuffer, setDynBuffer] = React.useState<RowItem[]>([]);
  const [dynNextToken, setDynNextToken] = React.useState<string | undefined>(undefined);
  const [dynLoading, setDynLoading] = React.useState<boolean>(false);
  const [dynLoadingMore, setDynLoadingMore] = React.useState<boolean>(false);
  const [pageIndex, setPageIndex] = React.useState<number>(0);

  const [dynSchema, setDynSchema] = React.useState<Record<string, EditField>>({});
  const [dynLookupOpts, setDynLookupOpts] = React.useState<
    Record<string, IDropdownOption[]>
  >({});

  const requestSeq = React.useRef(0);

  // ✅ refs para paginación robusta
  const dynLenRef = React.useRef<number>(0);
  const dynTokenRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    dynLenRef.current = dynBuffer.length;
  }, [dynBuffer.length]);
  React.useEffect(() => {
    dynTokenRef.current = dynNextToken;
  }, [dynNextToken]);

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

  const isDynMode = Boolean(viewId);
  const cacheKey = React.useMemo(
    () => makeDynCacheKey({ service, viewId, toggleField }),
    [service, viewId, toggleField]
  );

  // =======================
  // ✅ Aprobación (normalizo props legacy + nuevas)
  // =======================
  const approvalEnabled = Boolean(enableApproveModal ?? enableApproval);

  const approvalGroup = (
    String(approveGroupName ?? approvalGroupName ?? "").trim() || "Distribucion"
  ).trim();
  const statusField = (
    String(approveStatusField ?? approvalStatusField ?? "").trim() ||
    "EstadoAprobacion"
  ).trim();
  const reasonField = (
    String(approveReasonField ?? approvalReasonField ?? "").trim() || "Motivo"
  ).trim();

  const approvedValue = String(approveApprovedValue ?? "Aprobado");
  const rejectedValue = String(approveRejectedValue ?? "Rechazado");

  const approveModalTitleText = String(approveModalTitle ?? "Aprobar");
  const rejectModalTitleText = "Rechazar";

  const automateApproveUrlTrim = String(automateApproveUrl || "").trim();
  const automateRejectUrlTrim = String(automateRejectUrl || "").trim();

  // ✅ Unificación: si hay URL para esa acción => se llama WF como complemento
  const wfEnabledApprove = Boolean(automateApproveUrlTrim);
  const wfEnabledReject = Boolean(automateRejectUrlTrim);

  const approvalFieldsValid = Boolean(statusField) && Boolean(reasonField);

  const [isApprover, setIsApprover] = React.useState<boolean>(false);

  // overlay bloqueante (approve/reject + wf)
  const [approvalBusy, setApprovalBusy] = React.useState<boolean>(false);
  const [wfBusyText, setWfBusyText] = React.useState<string>("");

  // Modal motivo unificado (approve/reject)
  const [motivoOpen, setMotivoOpen] = React.useState<boolean>(false);
  const [motivoItemId, setMotivoItemId] = React.useState<number | undefined>(undefined);
  const [motivoValue, setMotivoValue] = React.useState<string>("");
  const [motivoAction, setMotivoAction] = React.useState<"approve" | "reject">("reject");

  const shouldShowMotivoModal = React.useCallback(
    (action: "approve" | "reject"): boolean => {
      const mode = approveMotivoModalMode || "none";
      if (mode === "both") return true;
      if (mode === "approve") return action === "approve";
      if (mode === "reject") return action === "reject";
      return false;
    },
    [approveMotivoModalMode]
  );

  const isMotivoRequired = React.useCallback(
    (action: "approve" | "reject"): boolean => {
      const mode = approveMotivoRequiredMode || "none";
      if (mode === "both") return true;
      if (mode === "approve") return action === "approve";
      if (mode === "reject") return action === "reject";
      return false;
    },
    [approveMotivoRequiredMode]
  );

  React.useEffect(() => {
    if (!approvalEnabled) {
      setIsApprover(false);
      return;
    }

    let alive = true;

    Promise.resolve()
      .then(async () => {
        if (!service.userInGroup) return false;
        return await service.userInGroup(approvalGroup);
      })
      .then((ok) => {
        if (alive) setIsApprover(Boolean(ok));
      })
      .catch(() => {
        if (alive) setIsApprover(false);
      });

    return () => {
      alive = false;
    };
  }, [approvalEnabled, approvalGroup, service]);

  const resetDyn = React.useCallback((): void => {
    setDynCols(undefined);
    setDynBuffer([]);
    setDynNextToken(undefined);
    setDynLoading(false);
    setDynLoadingMore(false);
    setDynSchema({});
    setDynLookupOpts({});
    setPageIndex(0);

    dynLenRef.current = 0;
    dynTokenRef.current = undefined;
  }, []);

  const ensureDynSchemaAndLookups = React.useCallback(
    async (cols: IColumn[]): Promise<void> => {
      const fieldNames = cols.map((c) => c.fieldName ?? c.key);
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
            const asDropdown: IDropdownOption[] = opts.map((o) => ({
              key: o.key,
              text: o.text,
            }));
            return [m.internalName, asDropdown] as const;
          })
      );

      const lookupMap: Record<string, IDropdownOption[]> = {};
      lookupEntries.forEach(([name, opts]) => {
        lookupMap[name] = opts;
      });
      setDynLookupOpts(lookupMap);
    },
    [service]
  );

  // ====== helpers stringify/render robustos ======
  const unwrapResults = React.useCallback((v: unknown): unknown => {
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    if ("results" in o && Array.isArray(o.results)) return o.results;
    return v;
  }, []);

  const stringify = React.useCallback(
    (v: unknown): string => {
      if (v === undefined || v === null) return "";

      const unwrapped = unwrapResults(v);

      if (Array.isArray(unwrapped)) return (unwrapped as unknown[]).map(stringify).join(", ");

      if (typeof unwrapped === "object") {
        const o = unwrapped as Record<string, unknown>;
        if ("Title" in o) return String((o as { Title?: unknown }).Title ?? "");
        if ("title" in o) return String((o as { title?: unknown }).title ?? "");
        if ("text" in o) return String((o as { text?: unknown }).text ?? "");
        if ("Name" in o) return String((o as { Name?: unknown }).Name ?? "");
        if ("Email" in o) return String((o as { Email?: unknown }).Email ?? "");

        return Object.keys(o)
          .map((k) => stringify(o[k]))
          .join(" ");
      }

      return String(unwrapped);
    },
    [unwrapResults]
  );

  const renderCellText = React.useCallback(
    (v: unknown): string => {
      if (v === undefined || v === null) return "";

      const htmlToText = (input: unknown): string => {
        const sVal = String(input ?? "");

        if (
          !/[<>]/.test(sVal) ||
          (!sVal.includes("<div") &&
            !sVal.includes("<p") &&
            !sVal.includes("<br") &&
            !sVal.includes("</"))
        ) {
          return sVal;
        }

        const el = document.createElement("div");
        el.innerHTML = sVal;
        const txt = el.textContent || (el as any).innerText || "";
        return txt.replace(/\u00a0/g, " ").trim();
      };

      const unwrapped = unwrapResults(v);

      if (Array.isArray(unwrapped)) {
        return (unwrapped as unknown[])
          .map((x) => {
            const xu = unwrapResults(x);

            if (xu && typeof xu === "object") {
              const o = xu as Record<string, unknown>;
              if ("Title" in o) return htmlToText(o.Title);
              if ("title" in o) return htmlToText(o.title);
              if ("text" in o) return htmlToText(o.text);
              if ("Name" in o) return htmlToText(o.Name);
              if ("Email" in o) return htmlToText(o.Email);
              if ("EMail" in o) return htmlToText(o.EMail);
              if ("LoginName" in o) return htmlToText(o.LoginName);
              if ("Id" in o) return htmlToText(o.Id);
              if ("ID" in o) return htmlToText(o.ID);
            }

            return htmlToText(xu ?? "");
          })
          .filter((s) => String(s).trim() !== "")
          .join(", ");
      }

      if (typeof unwrapped === "object") {
        const o = unwrapped as Record<string, unknown>;
        if ("Title" in o) return htmlToText(o.Title);
        if ("title" in o) return htmlToText(o.title);
        if ("text" in o) return htmlToText(o.text);
        if ("Name" in o) return htmlToText(o.Name);
        if ("Email" in o) return htmlToText(o.Email);
        if ("EMail" in o) return htmlToText(o.EMail);
        if ("LoginName" in o) return htmlToText(o.LoginName);
        if ("Id" in o) return htmlToText(o.Id);
        if ("ID" in o) return htmlToText(o.ID);

        return htmlToText(stringify(unwrapped));
      }

      if (typeof unwrapped === "string") return htmlToText(unwrapped);

      return htmlToText(unwrapped);
    },
    [stringify, unwrapResults]
  );

  // IDs extractor SIN flatMap
  const extractIds = React.useCallback(
    (cand: unknown): Array<number | string> => {
      if (cand === undefined || cand === null) return [];

      const unwrapped = unwrapResults(cand);

      if (Array.isArray(unwrapped)) {
        const arr = unwrapped as unknown[];
        return arr.reduce<Array<number | string>>((acc, x) => acc.concat(extractIds(x)), []);
      }

      if (typeof unwrapped === "number" || typeof unwrapped === "string") return [unwrapped];

      if (typeof unwrapped === "object") {
        const o = unwrapped as Record<string, unknown>;
        const id = (o.Id ?? o.ID ?? o.key) as unknown;
        if (typeof id === "number" || typeof id === "string") return [id];
      }

      return [];
    },
    [unwrapResults]
  );

  const tryParseDate = React.useCallback((sVal: string): number | undefined => {
    const t1 = Date.parse(sVal);
    if (!Number.isNaN(t1)) return t1;

    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(sVal.trim());
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yy = Number(m[3]);
      const dt = new Date(yy, mm - 1, dd).getTime();
      if (!Number.isNaN(dt)) return dt;
    }
    return undefined;
  }, []);

  const getSortable = React.useCallback(
    (v: unknown): string | number => {
      if (v === null || v === undefined) return "";
      if (typeof v === "boolean") return v ? 1 : 0;
      if (typeof v === "number") return v;

      if (typeof v === "string") {
        const asDate = tryParseDate(v);
        if (asDate !== undefined) return asDate;

        const asNum = Number(v);
        if (!Number.isNaN(asNum) && v.trim() !== "") return asNum;

        return v.toLowerCase();
      }

      const txt = renderCellText(v);
      const asDate2 = tryParseDate(txt);
      if (asDate2 !== undefined) return asDate2;

      const asNum2 = Number(txt);
      if (!Number.isNaN(asNum2) && txt.trim() !== "") return asNum2;

      return txt.toLowerCase();
    },
    [renderCellText, tryParseDate]
  );

  const sortItemsLocal = React.useCallback(
    <T,>(items: T[], field: string, desc: boolean): T[] => {
      const copy = items.slice();
      copy.sort((a: any, b: any) => {
        const av = getSortable(a?.[field]);
        const bv = getSortable(b?.[field]);
        if (av < bv) return desc ? 1 : -1;
        if (av > bv) return desc ? -1 : 1;
        return 0;
      });
      return copy;
    },
    [getSortable]
  );

  const [query, setQuery] = React.useState("");
  const qTrim = query.trim();
  const isFiltered = qTrim.length > 0;

  const [filterSnap, setFilterSnap] = React.useState<RowItem[] | null>(null);

  React.useEffect(() => {
    if (!isDynMode) return;

    if (isFiltered && !filterSnap) setFilterSnap(dynBuffer.slice());
    if (!isFiltered && filterSnap) setFilterSnap(null);
  }, [isDynMode, isFiltered, filterSnap, dynBuffer]);

  const fetchDynBatch = React.useCallback(
    async (opts: { initial: boolean }): Promise<{ bufferLen: number; nextToken?: string }> => {
      if (!viewId)
        return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

      const seq = ++requestSeq.current;

      try {
        if (opts.initial) {
          setDynLoading(true);
          setPageIndex(0);
        } else {
          setDynLoadingMore(true);
        }

        const svcAny = service as unknown as {
          getViewGridPaged?: (
            viewId: string,
            pageSize: number,
            nextToken?: string,
            toggleField?: string,
            sortField?: string,
            sortDesc?: boolean
          ) => Promise<{
            columns?: ViewGridColumn[];
            items?: RowItem[];
            nextToken?: string;
          }>;
        };

        if (typeof svcAny.getViewGridPaged !== "function") {
          const full = await service.getViewGrid(viewId, toggleField);
          if (seq !== requestSeq.current)
            return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

          const cols: IColumn[] = ((full.columns || []) as ViewGridColumn[]).map((c) => ({
            key: c.key,
            name: c.name,
            fieldName: c.fieldName,
            minWidth: c.minWidth ?? 100,
            isResizable: c.isResizable ?? true,
          }));

          setDynCols(cols);
          if (opts.initial) await ensureDynSchemaAndLookups(cols);

          const newItems = Array.isArray(full.items) ? (full.items as RowItem[]) : [];
          setDynBuffer(newItems);
          setDynNextToken(undefined);

          dynLenRef.current = newItems.length;
          dynTokenRef.current = undefined;

          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
        }

        const effectiveSortField = isFiltered ? undefined : sort.field;
        const effectiveSortDesc = isFiltered ? undefined : sort.desc;

        const doCall = async (sortDescArg: boolean | undefined, sortFieldArg?: string) => {
          return svcAny.getViewGridPaged!(
            viewId,
            FETCH_BATCH,
            opts.initial ? undefined : dynTokenRef.current,
            toggleField,
            sortFieldArg ?? effectiveSortField,
            sortDescArg
          );
        };

        let res = await doCall(effectiveSortDesc as boolean | undefined, effectiveSortField);

        if (
          !isFiltered &&
          opts.initial &&
          sort.field &&
          sort.desc === false &&
          (!res.items || res.items.length === 0)
        ) {
          res = await doCall(undefined, sort.field);

          if (!res.items || res.items.length === 0) {
            const resNoSort = await doCall(undefined, undefined);
            const raw = Array.isArray(resNoSort.items) ? resNoSort.items : [];
            const sortedLocal = sortItemsLocal(raw, sort.field, false);

            res = {
              columns: resNoSort.columns,
              items: sortedLocal,
              nextToken: undefined,
            };
          }
        }

        if (seq !== requestSeq.current)
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

        const cols: IColumn[] = (res.columns || []).map((c) => ({
          key: c.key,
          name: c.name,
          fieldName: c.fieldName,
          minWidth: c.minWidth ?? 100,
          isResizable: c.isResizable ?? true,
        }));

        setDynCols(cols);
        if (opts.initial) await ensureDynSchemaAndLookups(cols);

        const newItems = Array.isArray(res.items) ? res.items : [];
        setDynBuffer((prev) => (opts.initial ? newItems : prev.concat(newItems)));

        const nextToken =
          (res as any).nextToken ??
          (res as any).NextToken ??
          (res as any).nextPageToken ??
          (res as any).NextPageToken ??
          (res as any).next ??
          (res as any).Next ??
          (res as any).nextHref ??
          (res as any).NextHref ??
          (res as any).odataNextLink ??
          (res as any)["@odata.nextLink"];

        // ✅ FIX: no pisar con res.nextToken al final (a veces viene undefined aunque nextToken exista)
        const normalizedNext = (nextToken ?? res.nextToken) as string | undefined;

        setDynNextToken(normalizedNext);
        dynTokenRef.current = normalizedNext;

        dynLenRef.current = opts.initial
          ? newItems.length
          : dynLenRef.current + newItems.length;

        return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
      } finally {
        if (opts.initial) setDynLoading(false);
        else setDynLoadingMore(false);
      }
    },
    [
      service,
      viewId,
      toggleField,
      ensureDynSchemaAndLookups,
      sort.field,
      sort.desc,
      sortItemsLocal,
      isFiltered,
    ]
  );

  // ✅ hard refresh
  const hardRefresh = React.useCallback((): void => {
    refresh().catch(() => {});
    requestSeq.current += 1;

    if (isDynMode) {
      clearDynCache(cacheKey);
      resetDyn();
      fetchDynBatch({ initial: true }).catch(() => {});
    }
  }, [refresh, isDynMode, cacheKey, resetDyn, fetchDynBatch]);

  React.useEffect(() => {
    if (!viewId) {
      resetDyn();
      return;
    }

    const cached = readDynCache(cacheKey);
    if (cached) {
      setDynCols(cached.cols);
      setDynBuffer(cached.buffer);
      setDynNextToken(cached.nextToken);
      setDynSchema(cached.schema);
      setDynLookupOpts(cached.lookupOpts);
      setDynLoading(false);
      setDynLoadingMore(false);
      setPageIndex(0);

      dynLenRef.current = cached.buffer.length;
      dynTokenRef.current = cached.nextToken;

      return;
    }

    resetDyn();
    fetchDynBatch({ initial: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, cacheKey, resetDyn]);

  const loadMoreIfNeeded = React.useCallback(
    async (targetPageIndex: number): Promise<void> => {
      if (!viewId) return;
      if (isFiltered) return;
      if (dynLoading || dynLoadingMore) return;

      const needCount = (targetPageIndex + 1) * UI_PAGE_SIZE;

      while (dynTokenRef.current && dynLenRef.current < needCount) {
        const r = await fetchDynBatch({ initial: false });
        if (!r.nextToken && r.bufferLen < needCount) break;
      }

      const remainingAfterThisPage = dynLenRef.current - needCount;
      if (dynTokenRef.current && remainingAfterThisPage <= PREFETCH_THRESHOLD) {
        fetchDynBatch({ initial: false }).catch(() => {});
      }
    },
    [viewId, isFiltered, dynLoading, dynLoadingMore, fetchDynBatch]
  );

  const { headerClass, listWrapper, classes, modalHeader, modalBody, titleBar, titleText } =
    useStyles();
  const width = useWindowW();
  const isMobile = width < 640;

  const [cfg, setCfg] = React.useState<Record<string, { dateField: string; warnDays: number }>>(
    {}
  );

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

  const dynSource = React.useMemo((): RowItem[] | undefined => (viewId ? dynBuffer : undefined), [
    viewId,
    dynBuffer,
  ]);

  const itemsFiltered = React.useMemo(() => {
    const q = qTrim.toLowerCase();

    if (dynSource) {
      const source = isFiltered ? filterSnap ?? dynBuffer : dynBuffer;
      if (!q) return source;

      return source.filter((it) => {
        const obj = it as Record<string, unknown>;
        return Object.keys(obj).some((k) => stringify(obj[k]).toLowerCase().includes(q));
      });
    }

    if (!q) return s.items as Vehiculo[];
    return (s.items as Vehiculo[]).filter((v) => {
      const proveedorTextLocal = (v.proveedorTitles || []).join(", ");
      return (
        String(v.placa || "").toLowerCase().includes(q) ||
        String(v.marca || "").toLowerCase().includes(q) ||
        String(v.modelo || "").toLowerCase().includes(q) ||
        proveedorTextLocal.toLowerCase().includes(q)
      );
    });
  }, [dynSource, s.items, qTrim, stringify, isFiltered, filterSnap, dynBuffer]);

  const itemsFilteredSorted = React.useMemo(() => {
    if (!sort.field) return itemsFiltered;

    if (!isDynMode)
      return sortItemsLocal(itemsFiltered as any[], sort.field, sort.desc) as any;
    if (isFiltered)
      return sortItemsLocal(itemsFiltered as any[], sort.field, sort.desc) as any;

    return itemsFiltered;
  }, [itemsFiltered, isDynMode, isFiltered, sort.field, sort.desc, sortItemsLocal]);

  const totalFiltered = itemsFilteredSorted.length;

  React.useEffect(() => {
    if (!isDynMode) return;
    if (dynTokenRef.current) return;

    const maxIdx = Math.max(0, Math.ceil(totalFiltered / UI_PAGE_SIZE) - 1);
    setPageIndex((p) => Math.min(p, maxIdx));
  }, [isDynMode, totalFiltered]);

  const pageItems = React.useMemo(() => {
    if (!isDynMode) return itemsFilteredSorted;
    const start = pageIndex * UI_PAGE_SIZE;
    return (itemsFilteredSorted as RowItem[]).slice(start, start + UI_PAGE_SIZE);
  }, [isDynMode, itemsFilteredSorted, pageIndex]);

  React.useEffect(() => {
    if (!isDynMode) return;
    loadMoreIfNeeded(pageIndex).catch(() => {});
  }, [isDynMode, pageIndex, loadMoreIfNeeded]);

  React.useEffect(() => {
    if (!isDynMode) return;
    if (!viewId) return;
    if (isFiltered) return;

    requestSeq.current += 1;
    clearDynCache(cacheKey);
    resetDyn();
    fetchDynBatch({ initial: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDynMode, viewId, isFiltered, sort.field, sort.desc]);

  React.useEffect(() => {
    if (!isDynMode) return;

    return () => {
      writeDynCache(cacheKey, {
        cols: dynCols,
        buffer: dynBuffer,
        nextToken: dynNextToken,
        schema: dynSchema,
        lookupOpts: dynLookupOpts,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDynMode, cacheKey, dynCols, dynBuffer, dynNextToken, dynSchema, dynLookupOpts]);

  const filterOutIdCols = React.useCallback(
    (cols: IColumn[]): IColumn[] =>
      cols.filter((c) => {
        const n = (c.fieldName || c.key || c.name || "").toString();
        return !/^(ID|Id)$/i.test(n);
      }),
    []
  );

  // =======================
  // Relacionados
  // =======================
  const [relOpen, setRelOpen] = React.useState(false);
  const [relBusy, setRelBusy] = React.useState(false);
  const [relCols, setRelCols] = React.useState<IColumn[]>([]);
  const [relItems, setRelItems] = React.useState<RowItem[]>([]);
  const [relParentValue, setRelParentValue] = React.useState<ParentValue | undefined>(undefined);

  const [relEditOpen, setRelEditOpen] = React.useState(false);
  const [relEditLoading, setRelEditLoading] = React.useState(false);
  const [relEditSaving, setRelEditSaving] = React.useState(false);
  const [relEditSchema, setRelEditSchema] = React.useState<EditField[]>([]);
  const [relEditValues, setRelEditValues] = React.useState<Record<string, unknown>>({});
  const [relEditItemId, setRelEditItemId] = React.useState<number | undefined>(undefined);
  const [relEditListId, setRelEditListId] = React.useState<string | undefined>(undefined);
  const [relEditLookups, setRelEditLookups] = React.useState<Record<string, IDropdownOption[]>>(
    {}
  );
  const [relEditAttachments, setRelEditAttachments] = React.useState<
    Array<{ name: string; serverRelativeUrl: string }>
  >([]);
  const [relEditNewFile, setRelEditNewFile] = React.useState<File | undefined>(undefined);

  // =======================
  // ✅ Aprobación unificada + WF complemento
  // =======================
  const canApprove = approvalEnabled && isApprover;

  const buildAutomateUrl = React.useCallback(
    (baseUrl: string, args: Record<string, string | number | boolean | undefined | null>): string => {
      let url = String(baseUrl || "").trim();
      if (!url) return url;

      Object.keys(args).forEach((k) => {
        const val = args[k];
        const safe = val === undefined || val === null ? "" : encodeURIComponent(String(val));
        url = url.replace(new RegExp(`\\{${k}\\}`, "g"), safe);
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
    },
    []
  );

  const callWf = React.useCallback(
    async (action: "approve" | "reject", itemId: number, reason: string): Promise<void> => {
      const base = action === "approve" ? automateApproveUrlTrim : automateRejectUrlTrim;
      if (!base) return;

      const payload = {
        action,
        itemId,
        listId,
        viewId: viewId ?? "",
        reason: String(reason || ""),
      };

      const url = buildAutomateUrl(base, payload);

      // Intento POST (HTTP trigger). Fallback GET.
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const getRes = await fetch(url, { method: "GET", credentials: "include" });
        if (!getRes.ok) {
          throw new Error(`WF call failed: ${res.status} / ${getRes.status}`);
        }
      }
    },
    [automateApproveUrlTrim, automateRejectUrlTrim, listId, viewId, buildAutomateUrl]
  );

  const updateApprovalFields = React.useCallback(
    async (itemId: number, action: "approve" | "reject", motivo: string): Promise<void> => {
      if (!approvalFieldsValid) throw new Error("Faltan campos de aprobación configurados.");

      const statusValue = action === "approve" ? approvedValue : rejectedValue;
      const motivoValue = String(motivo || "");

      const values: Record<string, unknown> = {
        [statusField]: statusValue,
        [reasonField]: motivoValue,
      };

      // finalizado
      if (approveFinalizadoField && String(approveFinalizadoField).trim()) {
        values[String(approveFinalizadoField).trim()] = true;
      }

      // WF fields: si hay WF configurado para esta acción => Pendiente + limpiar error
      const wfEnabled = action === "approve" ? wfEnabledApprove : wfEnabledReject;
      if (wfEnabled) {
        const wfS = String(wfStatusField || "").trim();
        const wfE = String(wfErrorField || "").trim();
        if (wfS) values[wfS] = "Pendiente";
        if (wfE) values[wfE] = "";
      }

      // 1) updateItemFields (ideal)
      if (typeof (service as any).updateItemFields === "function") {
        await (service as any).updateItemFields(itemId, values);
        return;
      }

      // 2) fallback metas + updateFields
      const keys = Object.keys(values);
      const metas = await service.getFieldsMeta(keys);
      await service.updateFields(itemId, metas, values);
    },
    [
      service,
      approvalFieldsValid,
      statusField,
      reasonField,
      approvedValue,
      rejectedValue,
      approveFinalizadoField,
      wfEnabledApprove,
      wfEnabledReject,
      wfStatusField,
      wfErrorField,
    ]
  );

  const pollWfUntilDone = React.useCallback(
    async (itemId: number): Promise<{ status?: string; error?: string }> => {
      const wfS = String(wfStatusField || "").trim();
      const wfE = String(wfErrorField || "").trim();
      if (!wfS) return {};

      const svcAny = service as any;

      const maxMs = 90_000; // 90s
      const stepMs = 2000; // 2s
      const t0 = Date.now();

      const readFields = async (): Promise<Record<string, unknown>> => {
        // ✅ preferido (nuevo): lectura puntual (más liviano)
        if (typeof svcAny.getItemFieldsFromList === "function") {
          const names = wfE ? [wfS, wfE] : [wfS];
          return (await svcAny.getItemFieldsFromList(listId, itemId, names)) as Record<
            string,
            unknown
          >;
        }

        // (si el service está “pegado” a la lista base) también puede existir getItemFields
        if (typeof svcAny.getItemFields === "function") {
          const names = wfE ? [wfS, wfE] : [wfS];
          return (await svcAny.getItemFields(itemId, names)) as Record<string, unknown>;
        }

        // fallback legacy: getItemValuesFromList con schema
        if (typeof svcAny.getItemValuesFromList === "function") {
          const schema: EditField[] = [
            { internalName: wfS, title: wfS, type: "Choice", required: false, readOnly: false },
            ...(wfE
              ? ([
                  {
                    internalName: wfE,
                    title: wfE,
                    type: "Note",
                    required: false,
                    readOnly: false,
                  },
                ] as any)
              : []),
          ] as EditField[];
          return (await svcAny.getItemValuesFromList(listId, itemId, schema)) as Record<
            string,
            unknown
          >;
        }

        return {};
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const v = await readFields();

        const st = String(v?.[wfS] ?? "").trim();
        const err = wfE ? String(v?.[wfE] ?? "").trim() : "";

        if (st === "Ok" || st === "Error") return { status: st, error: err };

        if (Date.now() - t0 >= maxMs) return { status: st || "Pendiente", error: err };

        await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
      }
    },
    [service, listId, wfStatusField, wfErrorField]
  );

  const runApproval = React.useCallback(
    async (action: "approve" | "reject", row: RowItem, motivoFromModal?: string): Promise<void> => {
      const id = getRowId(row);
      if (!id) return;

      const motivo = String(motivoFromModal ?? "").trim();

      // validación required
      if (isMotivoRequired(action) && !motivo) {
        alert("Ingresá un motivo.");
        return;
      }

      const wfEnabled = action === "approve" ? wfEnabledApprove : wfEnabledReject;

      setApprovalBusy(true);
      setWfBusyText(
        wfEnabled ? "Procesando aprobación y ejecutando workflow..." : "Procesando aprobación..."
      );

      try {
        // 1) Update item (status + motivo + finalizado + wfstatus=Pendiente)
        await updateApprovalFields(id, action, motivo);

        // 2) Disparar WF si hay URL configurada
        if (wfEnabled) {
          setWfBusyText("Ejecutando workflow...");
          await callWf(action, id, motivo);

          // 3) Esperar respuesta via wfstatus
          setWfBusyText("Esperando respuesta del workflow...");
          const r = await pollWfUntilDone(id);

          if (r.status === "Error") {
            alert(
              r.error ? `El workflow devolvió ERROR:\n\n${r.error}` : "El workflow devolvió ERROR."
            );
          } else if (r.status && r.status !== "Ok") {
            alert(
              `El workflow no confirmó finalización (estado actual: ${r.status}). Podés refrescar en unos segundos.`
            );
          }
        }

        hardRefresh();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error aprobación", e);
        alert("No se pudo completar la aprobación/rechazo.");
      } finally {
        setApprovalBusy(false);
        setWfBusyText("");
      }
    },
    [
      isMotivoRequired,
      wfEnabledApprove,
      wfEnabledReject,
      updateApprovalFields,
      callWf,
      pollWfUntilDone,
      hardRefresh,
    ]
  );

  const onClickApprove = React.useCallback(
    (row: RowItem): void => {
      if (!canApprove) return;
      const id = getRowId(row);
      if (!id) return;

      if (shouldShowMotivoModal("approve")) {
        setMotivoAction("approve");
        setMotivoItemId(id);
        setMotivoValue("");
        setMotivoOpen(true);
        return;
      }

      runApproval("approve", row).catch(() => {});
    },
    [canApprove, shouldShowMotivoModal, runApproval]
  );

  const onClickReject = React.useCallback(
    (row: RowItem): void => {
      if (!canApprove) return;
      const id = getRowId(row);
      if (!id) return;

      if (shouldShowMotivoModal("reject")) {
        setMotivoAction("reject");
        setMotivoItemId(id);
        setMotivoValue("");
        setMotivoOpen(true);
        return;
      }

      // sin modal, pero igual puede ser required => bloquea
      runApproval("reject", row, "").catch(() => {});
    },
    [canApprove, shouldShowMotivoModal, runApproval]
  );

  const onConfirmMotivo = React.useCallback(async (): Promise<void> => {
    if (!motivoItemId) return;

    const findRow = (): RowItem | undefined => {
      if (isDynMode) return (dynBuffer || []).find((x) => getRowId(x) === motivoItemId);
      const base = (s.items as unknown as RowItem[]) || [];
      return base.find((x) => getRowId(x) === motivoItemId);
    };

    const row = findRow();
    if (!row) {
      setMotivoOpen(false);
      setMotivoItemId(undefined);
      setMotivoValue("");
      return;
    }

    const motivo = motivoValue.trim();

    if (isMotivoRequired(motivoAction) && !motivo) {
      alert("Ingresá un motivo.");
      return;
    }

    await runApproval(motivoAction, row, motivo);

    setMotivoOpen(false);
    setMotivoItemId(undefined);
    setMotivoValue("");
  }, [
    motivoItemId,
    motivoValue,
    motivoAction,
    isDynMode,
    dynBuffer,
    s.items,
    isMotivoRequired,
    runApproval,
  ]);

  const descargarAdjuntos = React.useCallback(
    async (row: RowItem): Promise<void> => {
      const id = getRowId(row);
      if (!id) return;

      try {
        const atts = await service.listAttachments(listId, id);

        if (!atts || !atts.length) {
          alert("Este registro no tiene adjuntos.");
          return;
        }

        atts.forEach((a) => {
          const link = document.createElement("a");
          link.href = a.serverRelativeUrl;
          link.download = a.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error descargando adjuntos", err);
        alert("No se pudieron descargar los adjuntos.");
      }
    },
    [listId, service]
  );

  const openRelated = React.useCallback(
    async (row: RowItem): Promise<void> => {
      if (!relatedListId || !relatedParentField || !relatedChildField) return;

      const parentValue = row?.[relatedParentField] as ParentValue;
      setRelParentValue(parentValue);
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
            (columns as ViewGridColumn[]).map((c) => ({
              key: c.key,
              name: c.name,
              fieldName: c.fieldName,
              minWidth: c.minWidth ?? 100,
              isResizable: c.isResizable ?? true,
            }))
          );

          setRelCols(cols);
          setRelItems(items as RowItem[]);
          setRelEditListId(relatedListId);
        } else {
          const { columns, items } = await service.getRelatedItems({
            childListId: relatedListId,
            childField: relatedChildField,
            parentValue,
          });

          const cols: IColumn[] = filterOutIdCols(
            (columns as ViewGridColumn[]).map((c) => ({
              key: c.key,
              name: c.name,
              fieldName: c.fieldName,
              minWidth: c.minWidth ?? 100,
              isResizable: c.isResizable ?? true,
            }))
          );

          setRelCols(cols);
          setRelItems(items as RowItem[]);
          setRelEditListId(relatedListId);
        }
      } finally {
        setRelBusy(false);
      }
    },
    [
      service,
      relatedListId,
      relatedParentField,
      relatedChildField,
      relatedChildViewId,
      filterOutIdCols,
    ]
  );

  const openRelatedEdit = React.useCallback(
    async (item: RowItem): Promise<void> => {
      if (!allowRelatedEdit) return;
      if (!relEditListId || !relatedEditViewId) return;

      const itemId = item.Id ?? item.ID ?? item.id;
      if (!itemId) return;

      setRelEditOpen(true);
      setRelEditLoading(true);
      setRelEditItemId(itemId);
      setRelEditNewFile(undefined);

      try {
        const viewFieldNames = await service.getViewFieldNamesFromList(
          relEditListId,
          relatedEditViewId
        );
        const allFields = await service.getListFields(relEditListId);

        const schema: EditField[] = viewFieldNames
          .map((vf) => {
            const hit = (allFields as unknown as Array<Record<string, unknown>>).find(
              (f) =>
                String((f as { internalName?: unknown }).internalName ?? "").toLowerCase() ===
                String(vf).toLowerCase()
            );
            if (!hit) return undefined;

            return {
              internalName: String((hit as { internalName?: unknown }).internalName ?? ""),
              title: String((hit as { title?: unknown }).title ?? ""),
              type: String((hit as { type?: unknown }).type ?? "") as EditField["type"],
              required: false,
              readOnly: Boolean((hit as { readOnly?: unknown }).readOnly),
              allowMultiple: Boolean((hit as { allowMultiple?: unknown }).allowMultiple),
              lookupListId: (hit as { lookupListId?: string }).lookupListId,
              choices: (hit as { choices?: string[] }).choices,
            } as EditField;
          })
          .filter((x): x is EditField => Boolean(x));

        setRelEditSchema(schema);

        const lookupMap: Record<string, IDropdownOption[]> = {};
        await Promise.all(
          schema
            .filter((f) => (f.type === "Lookup" || f.type === "User") && f.lookupListId)
            .map(async (f) => {
              const opts = await service.getLookupOptionsByListId(f.lookupListId!);
              lookupMap[f.internalName] = opts.map((o) => ({ key: o.key, text: o.text }));
            })
        );

        const values = await service.getItemValuesFromList(relEditListId, itemId, schema);
        const atts = await service.listAttachments(relEditListId, itemId);

        setRelEditLookups(lookupMap);
        setRelEditValues(values as Record<string, unknown>);
        setRelEditAttachments(atts);
      } finally {
        setRelEditLoading(false);
      }
    },
    [allowRelatedEdit, relEditListId, relatedEditViewId, service]
  );

  const proveedorText = React.useCallback(
    (v: Vehiculo): string => {
      if (v.proveedorTitles && v.proveedorTitles.length) return v.proveedorTitles.join(", ");
      const opts = (s.meta?.provOptions || []) as IDropdownOption[];
      const hit = (v.proveedorIds || [])
        .map((id: number) => opts.find((o) => Number(o.key) === id)?.text)
        .filter(Boolean) as string[];
      return hit.join(", ");
    },
    [s.meta?.provOptions]
  );

  const csvEscape = (v: unknown): string => {
    const sVal = v === undefined || v === null ? "" : String(v);
    const needQuotes = /[;"\n\r,]/.test(sVal);
    const esc = sVal.replace(/"/g, '""');
    return needQuotes ? `"${esc}"` : esc;
  };

  const buildExportRows = (): ExportRows => {
    if (dynCols && isDynMode) {
      const headers = dynCols.map((c) => c.name);
      const rows = (itemsFilteredSorted as RowItem[]).map((it) =>
        dynCols.map((c) => renderCellText((it as Record<string, unknown>)[c.fieldName ?? c.key]))
      );
      return { headers, rows };
    }

    const headers = ["Placa", "Proveedor", "Marca", "Modelo", ...(toggleField ? ["Activo"] : [])];
    const rows = (itemsFilteredSorted as Vehiculo[]).map((v: Vehiculo) => {
      const fila: Array<string | number | boolean> = [
        v.placa || "",
        proveedorText(v),
        v.marca || "",
        v.modelo || "",
      ];
      if (toggleField) fila.push(v.toggle ? "Sí" : "No");
      return fila;
    });

    return { headers, rows };
  };

  const exportToCsv = (): void => {
    const { headers, rows } = buildExportRows();
    const sep = ";";
    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(sep));
    rows.forEach((r) => lines.push(r.map(csvEscape).join(sep)));

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

  const renderSemaforo = (it: RowItem): JSX.Element => {
    const keyText = String(it?.[tipoFieldName] ?? "").trim().toLowerCase();
    const rule = keyText ? cfg[keyText] : undefined;
    const dateField = rule?.dateField || fallbackDateField;
    const warnDays = rule?.warnDays ?? defaultWarnDays;
    const rawDate = dateField ? (it?.[dateField] as string | undefined) : undefined;

    const estado = calcSemaforo(rawDate, warnDays);
    const color = semaforoColor(estado);

    const dot: React.CSSProperties = {
      display: "inline-block",
      width: 22,
      height: 20,
      borderRadius: "50%",
      background: color,
      marginRight: 0,
      marginLeft: 8,
      boxShadow: "0 0 0 2px rgba(0,0,0,.06)",
      paddingLeft: "5px",
      textAlign: "center",
    };

    const tooltip = rawDate
      ? `${estado} — vence: ${new Date(rawDate).toLocaleDateString()}`
      : estado;

    return (
      <span title={tooltip}>
        <span style={dot} aria-label={estado} />
      </span>
    );
  };

  // ====== click sort en columnas ======
  const onColumnClick = React.useCallback((_ev?: React.MouseEvent<HTMLElement>, col?: IColumn) => {
    if (!col) return;
    if (col.key === "acciones" || col.key === "semaforo") return;

    const field = col.fieldName ?? col.key;
    if (!field) return;

    setSort((prev) => {
      const same = prev.field === field;
      return { field, desc: same ? !prev.desc : false };
    });

    setPageIndex(0);
  }, []);

  // ========== columnas base ==========
  const baseColsOnly: IColumn[] = [
    {
      key: "placa",
      name: "Placa",
      fieldName: "placa",
      minWidth: 100,
      maxWidth: isMobile ? 120 : 160,
      isResizable: true,
      onRender: (it?: unknown) => {
        if (!it) return undefined;
        const row = it as RowItem;
        const isEditing = s.editingId === getRowId(row);

        return isEditing ? (
          <TextField
            value={String((s.draft as { placa?: unknown } | undefined)?.placa ?? "")}
            onChange={(_, v) => updateDraft({ placa: v || "" })}
          />
        ) : (
          <span>{String(row.placa ?? "")}</span>
        );
      },
    },
    {
      key: "proveedor",
      name: "Proveedor",
      fieldName: "proveedorTitles",
      minWidth: 160,
      maxWidth: isMobile ? 220 : 300,
      isResizable: true,
      onRender: (it?: unknown) => {
        if (!it) return undefined;
        const row = it as Vehiculo;
        const isEditing = s.editingId === getRowId(it as unknown as RowItem);

        return isEditing ? (
          <Dropdown
            placeholder="Seleccione…"
            options={(s.meta?.provOptions || []) as IDropdownOption[]}
            multiSelect={Boolean(s.meta?.provMulti)}
            selectedKey={
              !s.meta?.provMulti
                ? ((s.draft as { proveedorId?: unknown } | undefined)?.proveedorId as
                    | number
                    | undefined)
                : undefined
            }
            selectedKeys={
              s.meta?.provMulti
                ? ((s.draft as { proveedorId?: unknown } | undefined)?.proveedorId as
                    | number[]
                    | undefined)
                : undefined
            }
            onChange={(_, opt) => toggleProv(Number(opt!.key), Boolean(opt?.selected))}
          />
        ) : (
          <span title={proveedorText(row)}>{proveedorText(row)}</span>
        );
      },
    },
  ];

  if (toggleField) {
    baseColsOnly.push({
      key: "activo",
      name: "Activo",
      fieldName: "toggle",
      minWidth: 70,
      maxWidth: 90,
      onRender: (it?: unknown) =>
        !it ? undefined : <span>{(it as RowItem).toggle ? "Sí" : "No"}</span>,
    });
  }

  const editableDynCols: IColumn[] | undefined = React.useMemo(() => {
    if (!dynCols) return undefined;

    return dynCols.map((c) => {
      const fieldName = c.fieldName ?? c.key;

      return {
        ...c,
        onRender: (it?: unknown) => {
          if (!it) return undefined;

          const row = it as RowItem;
          const rowId = getRowId(row);
          const isEditing = s.editingId === rowId;

          const rawVal = row[fieldName];
          const meta = dynSchema[fieldName];

          // display
          if (!isEditing) {
            if (meta?.type === "Boolean") {
              const b =
                rawVal === true ||
                rawVal === 1 ||
                rawVal === "1" ||
                rawVal === "true" ||
                rawVal === "TRUE";
              return <span>{b ? "Sí" : "No"}</span>;
            }

            if (meta && (meta.type === "Lookup" || meta.type === "User")) {
              const opts = dynLookupOpts[fieldName];
              let display = renderCellText(rawVal);

              if ((!display || display === "[object Object]") && opts && opts.length) {
                const idCandidates = [
                  row[`${fieldName}Id`],
                  row[`${fieldName}_Id`],
                  row[`${fieldName}ID`],
                  row[`${fieldName}Ids`],
                  row[`${fieldName}_Ids`],
                ];

                const ids = idCandidates.reduce<Array<number | string>>(
                  (acc, cand) => acc.concat(extractIds(cand)),
                  []
                );
                if (ids.length) {
                  display = ids
                    .map((id) => opts.find((o) => String(o.key) === String(id))?.text)
                    .filter(Boolean)
                    .join(", ");
                }
              }

              return <span>{display ?? ""}</span>;
            }

            if (meta?.type === "MultiChoice") {
              return <span>{Array.isArray(rawVal) ? rawVal.join(", ") : ""}</span>;
            }

            return <span>{renderCellText(rawVal)}</span>;
          }

          // edit
          if (meta) {
            const t = meta.type;

            if (t === "Boolean") {
              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const current =
                draft ??
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
                  onChange={(_, opt) =>
                    updateDraft({ [fieldName]: opt?.key === "true" } as Record<string, unknown>)
                  }
                />
              );
            }

            if (t === "Choice" && meta.choices && meta.choices.length) {
              const opts: IDropdownOption[] = meta.choices.map((ch) => ({ key: ch, text: ch }));

              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const current = draft ?? renderCellText(rawVal);

              return (
                <Dropdown
                  options={opts}
                  selectedKey={current ? String(current) : undefined}
                  onChange={(_, opt) =>
                    updateDraft(
                      { [fieldName]: opt ? String(opt.key) : "" } as Record<string, unknown>
                    )
                  }
                />
              );
            }

            if (t === "MultiChoice" && meta.choices && meta.choices.length) {
              const opts: IDropdownOption[] = meta.choices.map((ch) => ({ key: ch, text: ch }));
              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const current: string[] =
                (Array.isArray(draft) ? (draft as string[]) : undefined) ??
                (Array.isArray(unwrapResults(rawVal)) ? (unwrapResults(rawVal) as string[]) : []);

              return (
                <Dropdown
                  multiSelect
                  options={opts}
                  selectedKeys={current}
                  onChange={(_, opt) => {
                    const key = String(opt!.key);
                    const prev = current.slice();
                    const idx = prev.indexOf(key);
                    if (opt?.selected) {
                      if (idx === -1) prev.push(key);
                    } else {
                      if (idx !== -1) prev.splice(idx, 1);
                    }
                    updateDraft({ [fieldName]: prev } as Record<string, unknown>);
                  }}
                />
              );
            }

            if ((t === "Lookup" || t === "User") && meta.lookupListId) {
              const opts = dynLookupOpts[fieldName] || [];
              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];

              const idCandidates = [
                draft,
                rawVal,
                row[`${fieldName}Id`],
                row[`${fieldName}_Id`],
                row[`${fieldName}ID`],
                row[`${fieldName}Ids`],
                row[`${fieldName}_Ids`],
              ];

              const ids = idCandidates.reduce<Array<number | string>>(
                (acc, cand) => acc.concat(extractIds(cand)),
                []
              );
              const selectedKey = ids.length ? ids[0] : undefined;

              return (
                <Dropdown
                  options={opts}
                  selectedKey={selectedKey as any}
                  onChange={(_, opt) =>
                    updateDraft({ [fieldName]: opt ? opt.key : undefined } as Record<string, unknown>)
                  }
                />
              );
            }

            if (t === "Number" || t === "Currency") {
              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const val =
                draft !== undefined && draft !== null
                  ? String(draft)
                  : rawVal !== undefined && rawVal !== null
                  ? String(rawVal)
                  : "";

              return (
                <TextField
                  type="number"
                  value={val}
                  onChange={(_, v) => updateDraft({ [fieldName]: v } as Record<string, unknown>)}
                />
              );
            }

            if (t === "DateTime") {
              const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const val = draft
                ? String(draft).substring(0, 10)
                : rawVal
                ? String(rawVal).substring(0, 10)
                : "";

              return (
                <TextField
                  type="date"
                  value={val}
                  onChange={(_, v) => updateDraft({ [fieldName]: v } as Record<string, unknown>)}
                />
              );
            }
          }

          const draft = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
          const val =
            draft !== undefined && draft !== null
              ? String(draft)
              : rawVal !== undefined && rawVal !== null
              ? String(rawVal)
              : "";

          return (
            <TextField
              value={val}
              onChange={(_, v) => updateDraft({ [fieldName]: v || "" } as Record<string, unknown>)}
            />
          );
        },
      };
    });
  }, [
    dynCols,
    dynSchema,
    dynLookupOpts,
    s.editingId,
    s.draft,
    updateDraft,
    renderCellText,
    extractIds,
    unwrapResults,
  ]);

  // ✅ acciones: ahora solo 2 (aprobar/rechazar) si canApprove
  const actionsExtraCount = canApprove && approvalFieldsValid ? 2 : 0;
  const actionsMinWidth = 140 + actionsExtraCount * 40;

  const colActions: IColumn = {
    key: "acciones",
    name: "Acciones",
    minWidth: actionsMinWidth,
    onRender: (it?: unknown) => {
      if (!it) return undefined;

      const row = it as RowItem;
      const thisId = getRowId(row);
      const isEditing = s.editingId === thisId;

      const real = (s.items as Vehiculo[]).find(
        (r) => getRowId(r as unknown as RowItem) === thisId
      );

      return isEditing ? (
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          <IconButton
            iconProps={{ iconName: "CheckMark" }}
            title="Confirmar"
            onClick={() =>
              confirm()
                .then(() => {
                  if (isDynMode) hardRefresh();
                })
                .catch(() => {})
            }
            disabled={s.saving || approvalBusy}
          />
          <IconButton
            iconProps={{ iconName: "Cancel" }}
            title="Cancelar"
            onClick={() => cancel()}
            disabled={s.saving || approvalBusy}
          />
        </Stack>
      ) : (
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          {showEdit && (
            <IconButton
              iconProps={{ iconName: "Edit" }}
              title="Editar"
              onClick={() => enterEdit(real || (it as Vehiculo))}
              disabled={approvalBusy}
            />
          )}

          {showDelete && real && (
            <IconButton
              iconProps={{ iconName: "Delete" }}
              title="Borrar"
              onClick={() => remove(real.id).catch(() => {})}
              disabled={approvalBusy}
            />
          )}

          {toggleField && showToggle && real && (
            <IconButton
              iconProps={{ iconName: real.toggle ? "CircleStop" : "Play" }}
              title={real.toggle ? "Desactivar" : "Activar"}
              onClick={() => toggleActive(real).catch(() => {})}
              disabled={approvalBusy}
            />
          )}

          {/* ✅ Aprobación unificada: actualiza item y (si hay URLs) dispara WF */}
          {canApprove && thisId && approvalFieldsValid && (
            <>
              <IconButton
                iconProps={{ iconName: "CompletedSolid" }}
                title="Aprobar"
                onClick={() => onClickApprove(row)}
                disabled={approvalBusy}
              />
              <IconButton
                iconProps={{ iconName: "StatusErrorFull" }}
                title="Rechazar"
                onClick={() => onClickReject(row)}
                disabled={approvalBusy}
              />
            </>
          )}

          {showDownloadAttachments && (
            <IconButton
              iconProps={{ iconName: "Download" }}
              title="Descargar adjuntos"
              onClick={() => descargarAdjuntos((real as unknown as RowItem) || row)}
              disabled={approvalBusy}
            />
          )}

          {relatedListId && relatedParentField && relatedChildField && (
            <IconButton
              iconProps={{ iconName: "FileTemplate" }}
              title="Documentos relacionados"
              onClick={() => openRelated(row).catch(() => {})}
              disabled={approvalBusy}
            />
          )}
        </Stack>
      );
    },
  };

  const columnsSem: IColumn[] = enableSemaforo
    ? ([
        {
          key: "semaforo",
          name: "Semáforo",
          minWidth: 80,
          onRender: (it?: unknown) => (it ? renderSemaforo(it as RowItem) : undefined),
        } as IColumn,
        ...(editableDynCols ? editableDynCols : baseColsOnly),
      ] as IColumn[])
    : editableDynCols
    ? editableDynCols
    : baseColsOnly;

  const columns: IColumn[] = React.useMemo(() => {
    return [...columnsSem, colActions].map((c) => {
      const field = c.fieldName ?? c.key;
      const isSortable = c.key !== "acciones" && c.key !== "semaforo" && Boolean(field);
      if (!isSortable) return c;

      return {
        ...c,
        onColumnClick,
        isSorted: sort.field === field,
        isSortedDescending: sort.field === field ? sort.desc : false,
      };
    });
  }, [columnsSem, colActions, onColumnClick, sort.field, sort.desc]);

  const canAdd = s.canEdit && showAdd && !isDynMode;
  const exportDisabledDyn = isDynMode && totalFiltered === 0;

  const showOverlaySpinner =
    (isDynMode ? dynLoading : s.loading) &&
    (isDynMode ? dynBuffer.length : (s.items as unknown[]).length) > 0;

  const cmdItems = [
    ...(canAdd
      ? ([
          {
            key: "add",
            text: "Agregar",
            iconProps: { iconName: "Add" },
            disabled: s.editingId !== undefined,
            onClick: () => addNew(),
          } as const,
        ] as const)
      : []),
    {
      key: "export",
      text: "Exportar",
      iconProps: { iconName: "ExcelDocument" },
      disabled: exportDisabledDyn,
      onClick: () => exportToCsv(),
    },
    {
      key: "refresh",
      text: "Refrescar",
      iconProps: { iconName: "Refresh" },
      onClick: () => hardRefresh(),
    },
  ];

  const onRenderRow: IRenderFunction<IDetailsRowProps> = (
    rowProps?: IDetailsRowProps
  ): JSX.Element | null => {
    if (!rowProps) return null;

    const customStyles: Partial<IDetailsRowStyles> = {
      root: { selectors: { "&:hover": { background: "#f0f7ff !important" } } },
    };

    return <DetailsRow {...rowProps} styles={customStyles} className="cnco-row" />;
  };

  const onRenderDetailsHeader: IRenderFunction<IDetailsHeaderProps> = (
    headerProps?: IDetailsHeaderProps,
    defaultRender?: IRenderFunction<IDetailsHeaderProps>
  ): JSX.Element | null => {
    if (!headerProps || !defaultRender) return null;

    const mergedProps: IDetailsHeaderProps = {
      ...headerProps,
      styles: { ...headerProps.styles, ...headerStyles },
    };

    return <div className={headerClass}>{defaultRender(mergedProps)}</div>;
  };

  // ================= render =================
  if ((s.loading && !isDynMode) || (isDynMode && dynLoading && dynBuffer.length === 0)) {
    return (
      <div className="cnco-vehiculos-shell">
        <ThemeProvider theme={appTheme}>
          <ShimmeredDetailsList
            enableShimmer
            items={[]}
            columns={[]}
            selectionMode={SelectionMode.none}
            styles={headerStyles}
          />
        </ThemeProvider>
      </div>
    );
  }

  const canPrev = isDynMode ? pageIndex > 0 : false;

  const canNext = isDynMode
    ? isFiltered
      ? (pageIndex + 1) * UI_PAGE_SIZE < totalFiltered
      : Boolean(dynTokenRef.current) || (pageIndex + 1) * UI_PAGE_SIZE < dynLenRef.current
    : false;

  const goPrev = (): void => {
    if (!canPrev) return;
    setPageIndex((p) => Math.max(0, p - 1));
  };

  const goNext = async (): Promise<void> => {
    if (!canNext) return;

    const next = pageIndex + 1;

    if (!isFiltered) {
      await loadMoreIfNeeded(next).catch(() => {});
      const startIndex = next * UI_PAGE_SIZE;
      if (dynLenRef.current <= startIndex && !dynTokenRef.current) return;
    } else {
      const startIndex = next * UI_PAGE_SIZE;
      if (totalFiltered <= startIndex) return;
    }

    setPageIndex(next);
  };

  const renderPagination = (): JSX.Element | undefined => {
    if (!isDynMode) return undefined;

    const start = totalFiltered === 0 ? 0 : pageIndex * UI_PAGE_SIZE + 1;
    const end = totalFiltered === 0 ? 0 : start + pageItems.length - 1;

    return (
      <Stack
        horizontal
        verticalAlign="center"
        horizontalAlign="space-between"
        styles={{ root: { padding: "8px 12px", borderTop: "1px solid #eee" } }}
      >
        <span style={{ color: "#555" }}>
          Mostrando {start}-{end}
          {dynLoadingMore ? " (cargando...)" : ""}
        </span>

        <Stack horizontal tokens={{ childrenGap: 6 }} verticalAlign="center">
          <IconButton
            iconProps={{ iconName: "ChevronLeft" }}
            title="Anterior"
            disabled={!canPrev}
            onClick={goPrev}
          />
          <span style={{ minWidth: 70, textAlign: "center" }}>Página {pageIndex + 1}</span>
          <IconButton
            iconProps={{ iconName: "ChevronRight" }}
            title="Siguiente"
            disabled={!canNext}
            onClick={() => goNext().catch(() => {})}
          />
        </Stack>
      </Stack>
    );
  };

  return (
    <div className="cnco-vehiculos-shell">
      <ThemeProvider theme={appTheme}>
        <Stack tokens={{ childrenGap: 12 }}>
          {/* ✅ Título visible + colapsable */}
          {(gridTitle || gridCollapsible) && (
            <div className={titleBar}>
              <div className={titleText} style={titleStyle}>
                {gridTitle || " "}
              </div>
              {gridCollapsible && (
                <IconButton
                  title={collapsed ? "Expandir" : "Colapsar"}
                  iconProps={{ iconName: collapsed ? "ChevronRight" : "ChevronDown" }}
                  onClick={() => setCollapsed((c) => !c)}
                  styles={{
                    root: {
                      border: "1px solid #e5e5e5",
                      background: "#ffffff",
                      borderRadius: 8,
                    },
                  }}
                />
              )}
            </div>
          )}

          {!collapsed && (
            <>
              <Stack horizontal wrap horizontalAlign="space-between" className={classes.toolbar}>
                <Stack
                  className={classes.responsiveRow}
                  horizontal
                  wrap
                  tokens={{ childrenGap: 8 }}
                  verticalAlign="center"
                >
                  <CommandBar items={cmdItems} ariaLabel="Acciones" />
                  {isDynMode && dynLoadingMore && (
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                      <Spinner />
                    </Stack>
                  )}
                </Stack>

                <Stack className={classes.responsiveRow} horizontalAlign="end">
                  <SearchBox
                    placeholder="Buscar…"
                    underlined
                    value={query}
                    onChange={(_, v) => {
                      if (v !== undefined) setQuery(v);
                    }}
                    onClear={() => setQuery("")}
                    styles={{ root: { minWidth: isMobile ? "100%" : 320 } }}
                  />
                </Stack>
              </Stack>

              <div className={listWrapper} style={{ position: "relative" }}>
                <DetailsList
                  items={pageItems}
                  columns={columns}
                  selectionMode={SelectionMode.none}
                  constrainMode={ConstrainMode.horizontalConstrained}
                  onRenderRow={onRenderRow}
                  onRenderDetailsHeader={onRenderDetailsHeader}
                  compact={isMobile}
                  styles={{ root: { width: "100%" } }}
                  onRenderItemColumn={
                    isDynMode
                      ? (item?: unknown, _i?: number, col?: IColumn) => {
                          if (!item || !col) return undefined;
                          if (col.onRender) return col.onRender(item, _i, col);

                          const row = item as RowItem;
                          const v = row[col.fieldName ?? col.key];
                          return renderCellText(v);
                        }
                      : undefined
                  }
                />

                {renderPagination()}

                {(showOverlaySpinner || approvalBusy) && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 8,
                      backdropFilter: "blur(1px)",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <Spinner label={approvalBusy ? wfBusyText || "Procesando..." : "Cargando..."} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ✅ Modal Motivo unificado (approve/reject) */}
          <Modal
            isOpen={motivoOpen}
            onDismiss={() => {
              if (approvalBusy) return;
              setMotivoOpen(false);
              setMotivoItemId(undefined);
              setMotivoValue("");
            }}
            isBlocking={true}
            styles={{
              main: {
                width: 520,
                maxWidth: "90vw",
                borderRadius: 12,
                overflow: "hidden",
              },
            }}
          >
            <div
              style={{
                background: "#1e88e5",
                color: "#fff",
                padding: "10px 14px",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{motivoAction === "approve" ? approveModalTitleText : rejectModalTitleText}</span>
              <IconButton
                iconProps={{ iconName: "Cancel" }}
                styles={{ root: { color: "#fff" } }}
                onClick={() => {
                  if (approvalBusy) return;
                  setMotivoOpen(false);
                  setMotivoItemId(undefined);
                  setMotivoValue("");
                }}
              />
            </div>

            <div style={{ padding: 14 }}>
              <TextField
                label="Motivo"
                multiline
                rows={4}
                required={isMotivoRequired(motivoAction)}
                value={motivoValue}
                onChange={(_, v) => setMotivoValue(v || "")}
              />

              <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 12 } }}>
                <PrimaryButton
                  text={approvalBusy ? "Procesando..." : "Confirmar"}
                  onClick={() => onConfirmMotivo().catch(() => {})}
                  disabled={approvalBusy}
                />
                <DefaultButton
                  text="Cancelar"
                  onClick={() => {
                    if (approvalBusy) return;
                    setMotivoOpen(false);
                    setMotivoItemId(undefined);
                    setMotivoValue("");
                  }}
                  disabled={approvalBusy}
                />
              </Stack>
            </div>
          </Modal>

          {/* ===== Modal relacionados ===== */}
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
                styles={{
                  root: { color: "#fff" },
                  rootHovered: { color: "#fff" },
                }}
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
                    columns={[
                      ...filterOutIdCols(
                        relCols.map((c) => ({
                          ...c,
                          minWidth: c.minWidth ?? 100,
                          isResizable: true,
                        }))
                      ),
                      {
                        key: "relActions",
                        name: "Acciones",
                        minWidth: allowRelatedEdit ? 90 : 0,
                        onRender: (it?: unknown) =>
                          it && allowRelatedEdit ? (
                            <IconButton
                              iconProps={{ iconName: "Edit" }}
                              title="Editar"
                              onClick={() => openRelatedEdit(it as RowItem)}
                            />
                          ) : undefined,
                      },
                    ]}
                    selectionMode={SelectionMode.none}
                    constrainMode={ConstrainMode.horizontalConstrained}
                    compact={isMobile}
                    onRenderItemColumn={(item?: unknown, _i?: number, col?: IColumn) => {
                      if (!item || !col) return undefined;
                      if (col.onRender) return col.onRender(item, _i, col);

                      const row = item as RowItem;
                      const v = row[col.fieldName ?? col.key];
                      return renderCellText(v);
                    }}
                  />
                </div>
              )}
            </div>
          </Modal>

          {/* ===== Modal editar relacionado ===== */}
          <Modal
            isOpen={relEditOpen}
            onDismiss={() => {
              setRelEditOpen(false);
              setRelEditSchema([]);
              setRelEditValues({});
              setRelEditItemId(undefined);
              setRelEditAttachments([]);
              setRelEditNewFile(undefined);
            }}
            isBlocking={true}
            styles={{
              main: {
                width: 520,
                maxWidth: "90vw",
                borderRadius: 12,
                overflow: "hidden",
              },
            }}
          >
            <div
              style={{
                background: "#1e88e5",
                color: "#fff",
                padding: "10px 14px",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Editar documento relacionado</span>
              <IconButton
                iconProps={{ iconName: "Cancel" }}
                styles={{ root: { color: "#fff" } }}
                onClick={() => {
                  setRelEditOpen(false);
                  setRelEditSchema([]);
                  setRelEditValues({});
                  setRelEditItemId(undefined);
                  setRelEditAttachments([]);
                  setRelEditNewFile(undefined);
                }}
              />
            </div>

            <div style={{ padding: 14 }}>
              {relEditLoading ? (
                <Spinner label="Cargando campos..." />
              ) : (
                <>
                  {relEditSchema
                    .filter((f) => !f.readOnly)
                    .map((f) => {
                      const val = relEditValues[f.internalName];

                      if ((f.type === "Lookup" || f.type === "User") && f.lookupListId) {
                        const opts = relEditLookups[f.internalName] || [];
                        const selectedKey =
                          typeof val === "object" && val
                            ? (val as { key?: unknown; Id?: unknown }).key ??
                              (val as { Id?: unknown }).Id
                            : val;

                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            options={opts}
                            selectedKey={selectedKey as string | number | undefined}
                            onChange={(_, opt) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: opt ? { key: opt.key, text: opt.text } : undefined,
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );
                      }

                      if (f.type === "Choice" && f.choices && f.choices.length) {
                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            options={f.choices.map((c) => ({ key: c, text: c }))}
                            selectedKey={val ? String(val) : undefined}
                            onChange={(_, opt) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: opt ? opt.key : "",
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );
                      }

                      if (f.type === "MultiChoice" && f.choices && f.choices.length) {
                        const current: string[] = Array.isArray(val) ? (val as string[]) : [];
                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            multiSelect
                            options={f.choices.map((c) => ({ key: c, text: c }))}
                            selectedKeys={current}
                            onChange={(_, opt) => {
                              const k = String(opt!.key);
                              const next = current.slice();
                              const idx = next.indexOf(k);
                              if (opt?.selected) {
                                if (idx === -1) next.push(k);
                              } else if (idx !== -1) {
                                next.splice(idx, 1);
                              }
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: next,
                              }));
                            }}
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );
                      }

                      if (f.type === "DateTime") {
                        return (
                          <TextField
                            key={f.internalName}
                            label={f.title}
                            type="date"
                            value={val ? String(val).substring(0, 10) : ""}
                            onChange={(_, v) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: v ?? "",
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );
                      }

                      if (f.type === "Boolean") {
                        const current =
                          val === true || val === 1 || val === "1" || val === "true" || val === "TRUE";
                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            options={[
                              { key: "true", text: "Sí" },
                              { key: "false", text: "No" },
                            ]}
                            selectedKey={current ? "true" : "false"}
                            onChange={(_, opt) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: opt?.key === "true",
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );
                      }

                      return (
                        <TextField
                          key={f.internalName}
                          label={f.title}
                          value={val !== undefined && val !== null ? String(val) : ""}
                          onChange={(_, v) =>
                            setRelEditValues((prev) => ({
                              ...prev,
                              [f.internalName]: v ?? "",
                            }))
                          }
                          styles={{ root: { marginBottom: 10 } }}
                        />
                      );
                    })}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Adjuntos actuales</div>
                    {relEditAttachments.length ? (
                      relEditAttachments.map((a) => (
                        <div key={a.serverRelativeUrl}>
                          <a href={a.serverRelativeUrl} target="_blank" rel="noreferrer">
                            {a.name}
                          </a>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontStyle: "italic", color: "#666" }}>Sin adjuntos</div>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontWeight: 600, display: "block" }}>Reemplazar adjunto</label>
                    <input
                      type="file"
                      onChange={(e) => setRelEditNewFile(e.target.files?.[0] ?? undefined)}
                    />
                  </div>

                  <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 12 } }}>
                    <button
                      style={{
                        background: "#1e88e5",
                        color: "#fff",
                        border: "none",
                        padding: "6px 18px",
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                      onClick={async () => {
                        if (!relEditItemId || !relEditListId) return;

                        setRelEditSaving(true);
                        try {
                          const svcAny = service as unknown as {
                            updateFieldsOnList?: (
                              listId: string,
                              itemId: number,
                              schema: EditField[],
                              values: Record<string, unknown>
                            ) => Promise<void>;
                          };

                          if (typeof svcAny.updateFieldsOnList === "function") {
                            await svcAny.updateFieldsOnList(
                              relEditListId,
                              relEditItemId,
                              relEditSchema,
                              relEditValues
                            );
                          } else {
                            await service.updateFields(relEditItemId, relEditSchema, relEditValues);
                          }

                          if (relEditNewFile) {
                            await service.replaceAttachment(relEditListId, relEditItemId, relEditNewFile);
                          }

                          if (relParentValue !== undefined && relatedListId && relatedChildField) {
                            if (relatedChildViewId) {
                              const { columns, items } = await service.getRelatedGridByView(
                                relatedListId,
                                relatedChildViewId,
                                relatedChildField,
                                relParentValue
                              );

                              const cols: IColumn[] = filterOutIdCols(
                                (columns as ViewGridColumn[]).map((c) => ({
                                  key: c.key,
                                  name: c.name,
                                  fieldName: c.fieldName,
                                  minWidth: c.minWidth ?? 100,
                                  isResizable: c.isResizable ?? true,
                                }))
                              );

                              setRelCols(cols);
                              setRelItems(items as RowItem[]);
                            } else {
                              const { columns, items } = await service.getRelatedItems({
                                childListId: relatedListId,
                                childField: relatedChildField,
                                parentValue: relParentValue,
                              });

                              const cols: IColumn[] = filterOutIdCols(
                                (columns as ViewGridColumn[]).map((c) => ({
                                  key: c.key,
                                  name: c.name,
                                  fieldName: c.fieldName,
                                  minWidth: c.minWidth ?? 100,
                                  isResizable: c.isResizable ?? true,
                                }))
                              );

                              setRelCols(cols);
                              setRelItems(items as RowItem[]);
                            }
                          }

                          setRelEditOpen(false);
                          setRelEditSchema([]);
                          setRelEditValues({});
                          setRelEditItemId(undefined);
                          setRelEditAttachments([]);
                          setRelEditNewFile(undefined);
                        } finally {
                          setRelEditSaving(false);
                        }
                      }}
                      disabled={relEditSaving}
                    >
                      {relEditSaving ? "Guardando..." : "Guardar"}
                    </button>

                    <button
                      style={{
                        background: "#fff",
                        border: "1px solid #ccc",
                        padding: "6px 18px",
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setRelEditOpen(false);
                        setRelEditSchema([]);
                        setRelEditValues({});
                        setRelEditItemId(undefined);
                        setRelEditAttachments([]);
                        setRelEditNewFile(undefined);
                      }}
                      disabled={relEditSaving}
                    >
                      Cancelar
                    </button>
                  </Stack>
                </>
              )}
            </div>
          </Modal>
        </Stack>
      </ThemeProvider>
    </div>
  );
};

export default VehiculosGrid;
