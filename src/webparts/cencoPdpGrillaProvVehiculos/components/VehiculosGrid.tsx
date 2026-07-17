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
  Checkbox,
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
import { normalizeBooleanValue } from "../utils/booleans";
import { parseViewSnapshot, type ViewSnapshot } from "../utils/viewSnapshot";
import {
  buildViewColumnConfig,
  parseViewColumnConfig,
  stringifyViewColumnConfig,
  type ViewColumnConfigEntry,
} from "../utils/viewColumnConfig";
import {
  buildAutomateUrl as buildAutomateUrlHelper,
  csvEscape as csvEscapeHelper,
  filterOutIdColumns as filterOutIdColumnsHelper,
  getRowId as getRowIdHelper,
  isMotivoRequired as isMotivoRequiredHelper,
  shouldShowMotivoModal as shouldShowMotivoModalHelper,
} from "../utils/flowHelpers";

type RowItem = Record<string, unknown> & {
  id?: number | string;
  Id?: number | string;
  ID?: number | string;
  ItemId?: number | string;
  ID_x0020_?: number | string;
  Id_x0020_?: number | string;
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
const ensureSharedStyles = (): () => void => {
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

    .cnco-vehiculos-shell .cnco-html-grid-wrap{
      width:100%;
      overflow:auto;
    }

    .cnco-vehiculos-shell table.cnco-html-grid{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
      background:#fff;
    }

    .cnco-vehiculos-shell .cnco-html-grid thead th{
      position:sticky;
      top:0;
      z-index:1;
      background:linear-gradient(90deg,#1e88e5 0%,#3b8fd1 100%)!important;
      color:#fff!important;
      text-align:left;
      font-weight:600;
      padding:14px 12px;
      border-bottom:0;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .cnco-vehiculos-shell .cnco-html-grid thead th.cnco-sortable{
      cursor:pointer;
    }

    .cnco-vehiculos-shell .cnco-html-grid thead th .cnco-head-inner{
      display:flex;
      align-items:center;
      gap:6px;
      min-width:0;
    }

    .cnco-vehiculos-shell .cnco-html-grid tbody td{
      padding:12px;
      border-bottom:1px solid #f0f0f0;
      vertical-align:middle;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .cnco-vehiculos-shell .cnco-html-grid tbody tr:hover{
      background:#f0f7ff;
    }

    .cnco-vehiculos-shell .cnco-html-grid tbody tr.cnco-row-editing{
      background:#eef6ff;
    }

    .cnco-vehiculos-shell .cnco-html-grid .cnco-actions-cell{
      white-space:nowrap;
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

  type SharedStyleState = {
    observers: number;
    observer?: MutationObserver;
  };

  const w = window as unknown as { __cncoVehStylesState?: SharedStyleState };
  if (!w.__cncoVehStylesState) {
    w.__cncoVehStylesState = { observers: 0 };
  }

  const state = w.__cncoVehStylesState;
  state.observers += 1;

  if (!state.observer) {
    const obs = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (document.head.lastElementChild !== el) {
        document.head.appendChild(el);
      }
    });
    obs.observe(document.head, { childList: true });
    state.observer = obs;
  }

  return () => {
    const current = w.__cncoVehStylesState;
    if (!current) return;
    current.observers = Math.max(0, current.observers - 1);
    if (current.observers === 0) {
      current.observer?.disconnect();
      current.observer = undefined;
    }
  };
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
  allowRelatedDownloadAttachments?: boolean;

  showDownloadAttachments?: boolean;
  gridLazyLoad?: boolean;
  instanceKey?: string;
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

  viewSnapshotJson?: string;
  viewColumnConfigJson?: string;
  columnEditorOpenNonce?: number;
  onCaptureViewSnapshot?: () => Promise<void> | void;
  onSaveViewColumnConfig?: (json: string) => Promise<void> | void;

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
const FETCH_BATCH = 15;
const PREFETCH_THRESHOLD = 5;
const DYN_CACHE_TTL_MS = 5 * 60 * 1000;

const perfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

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
  instanceKey?: string;
  columnConfigJson?: string;
}): string => {
  const svc = p.service as unknown as {
    listId?: unknown;
    _listId?: unknown;
    baseListId?: unknown;
  };
  const listId = String(svc.listId ?? svc._listId ?? svc.baseListId ?? "");
  const cfgKey = String(p.columnConfigJson ?? "").trim();
  return `vehiculosGrid:${String(p.instanceKey ?? "global")}:${listId}:${String(p.viewId ?? "")}:${String(
    p.toggleField ?? ""
  )}:${cfgKey}`;
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

const getRowId = getRowIdHelper;

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
    allowRelatedDownloadAttachments = false,

    listId,
    showDownloadAttachments = true,
    gridLazyLoad = true,
    instanceKey = "global",

    // ===== UI: título + colapsable =====
    gridTitle = "",
    gridCollapsible = false,
    gridDefaultCollapsed = false,

    // ✅ estilo del título (defaults)
    gridTitleFontSize = 16,
    gridTitleColor = "#323130",
    gridTitleFontWeight = "700",
    gridTitleFontFamily = "Segoe UI",
    viewSnapshotJson,
    viewColumnConfigJson,
    columnEditorOpenNonce,
    onCaptureViewSnapshot,
    onSaveViewColumnConfig,

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

  const parsedSnapshot = React.useMemo<ViewSnapshot | undefined>(
    () => parseViewSnapshot(viewSnapshotJson),
    [viewSnapshotJson]
  );
  const parsedColumnConfig = React.useMemo(
    () => parseViewColumnConfig(viewColumnConfigJson),
    [viewColumnConfigJson]
  );
  const [appliedColumnConfig, setAppliedColumnConfig] = React.useState(
    parsedColumnConfig
  );
  const appliedColumnConfigRef = React.useRef(parsedColumnConfig);
  const snapshotEnabled = Boolean(parsedSnapshot);

  const perfEnabled = React.useMemo((): boolean => {
    try {
      return window.localStorage.getItem("cncoGridPerf") === "1";
    } catch {
      return false;
    }
  }, []);

  const perfLog = React.useCallback(
    (stage: string, startedAt: number, extra?: Record<string, unknown>): void => {
      if (!perfEnabled) return;
      const ms = Math.round((perfNow() - startedAt) * 10) / 10;
      const prefix = `[VehiculosGrid:${instanceKey}]`;
      if (extra) {
        // eslint-disable-next-line no-console
        console.log(prefix, stage, `${ms}ms`, extra);
        return;
      }
      // eslint-disable-next-line no-console
      console.log(prefix, stage, `${ms}ms`);
    },
    [instanceKey, perfEnabled]
  );

  React.useEffect(() => {
    const cleanup = ensureSharedStyles();
    return cleanup;
  }, []);

  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState<boolean>(!gridLazyLoad);

  React.useEffect(() => {
    if (!gridLazyLoad) {
      setIsVisible(true);
      return;
    }

    const el = shellRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [gridLazyLoad]);

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

  const [dynCols, setDynCols] = React.useState<IColumn[] | undefined>(
    parsedSnapshot?.columns as IColumn[] | undefined
  );
  const [dynBuffer, setDynBuffer] = React.useState<RowItem[]>(
    (parsedSnapshot?.items as RowItem[] | undefined) || []
  );
  const [dynNextToken, setDynNextToken] = React.useState<string | undefined>(undefined);
  const [dynLoading, setDynLoading] = React.useState<boolean>(false);
  const [dynLoadingMore, setDynLoadingMore] = React.useState<boolean>(false);
  const [pageIndex, setPageIndex] = React.useState<number>(0);

  const [dynSchema, setDynSchema] = React.useState<Record<string, EditField>>({});
  const [dynLookupOpts, setDynLookupOpts] = React.useState<
    Record<string, IDropdownOption[]>
  >({});
  const dynLookupTextCacheRef = React.useRef<Record<string, Record<string, string>>>({});
  const [columnEditorOpen, setColumnEditorOpen] = React.useState<boolean>(false);
  const [columnEditorLoading, setColumnEditorLoading] = React.useState<boolean>(false);
  const [columnEditorError, setColumnEditorError] = React.useState<string>("");
  const [columnEditorEntries, setColumnEditorEntries] = React.useState<ViewColumnConfigEntry[]>(
    []
  );
  const dragSourceIndexRef = React.useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [lockedQuickEditModalOpen, setLockedQuickEditModalOpen] = React.useState<boolean>(false);
  const [lockedQuickEditModalField, setLockedQuickEditModalField] = React.useState<string>("");
  const [lockedQuickEditModalTitle, setLockedQuickEditModalTitle] = React.useState<string>("");

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

  const snapshotCols = React.useMemo(
    () => (snapshotEnabled && parsedSnapshot ? (parsedSnapshot.columns as IColumn[]) : undefined),
    [parsedSnapshot, snapshotEnabled]
  );
  const snapshotItems = React.useMemo(
    () => (snapshotEnabled && parsedSnapshot ? ((parsedSnapshot.items as RowItem[]) || []) : []),
    [parsedSnapshot, snapshotEnabled]
  );
  const currentDynCols = snapshotCols ?? dynCols;
  const currentDynBuffer = snapshotEnabled ? snapshotItems : dynBuffer;
  const appliedColumnConfigEntries = React.useMemo(() => {
    const configEntries =
      appliedColumnConfig?.fields?.length ? appliedColumnConfig.fields : appliedColumnConfig?.columns;
    return Array.isArray(configEntries) ? configEntries : [];
  }, [appliedColumnConfig]);
  const appliedColumnConfigMap = React.useMemo(() => {
    const map = new Map<string, ViewColumnConfigEntry>();
    appliedColumnConfigEntries.forEach((entry) => {
      map.set(entry.internalName.trim().toLowerCase(), entry);
    });
    return map;
  }, [appliedColumnConfigEntries]);
  const activeDynCols = React.useMemo(() => {
    const baseCols = currentDynCols || [];
    if (!appliedColumnConfig || appliedColumnConfig.listId !== listId) return baseCols;
    if (appliedColumnConfig.viewId && appliedColumnConfig.viewId !== viewId) return baseCols;

    const byName = new Map<string, IColumn>();
    baseCols.forEach((col) => {
      const field = String(col.fieldName ?? col.key ?? "").trim().toLowerCase();
      if (field && !byName.has(field)) byName.set(field, col);
    });

    const ordered: IColumn[] = [];
    appliedColumnConfig.columns.forEach((entry) => {
      if (!entry.visible) return;
      const hit = byName.get(entry.internalName.trim().toLowerCase());
      if (!hit) return;
      ordered.push({
        ...hit,
        name: entry.title || hit.name,
        fieldName: hit.fieldName ?? hit.key,
      });
    });

    return ordered;
  }, [currentDynCols, appliedColumnConfig, listId, viewId]);
  const customGridMode = Boolean(appliedColumnConfig && appliedColumnConfig.listId === listId);
  const isQuickEditLocked = React.useCallback(
    (fieldName: string): boolean => {
      const hit = appliedColumnConfigMap.get(String(fieldName || "").trim().toLowerCase());
      return Boolean(hit && hit.editable === false);
    },
    [appliedColumnConfigMap]
  );
  const openLockedQuickEditModal = React.useCallback((fieldName: string, title: string): void => {
    setLockedQuickEditModalField(String(fieldName || ""));
    setLockedQuickEditModalTitle(String(title || fieldName || ""));
    setLockedQuickEditModalOpen(true);
  }, []);

  React.useEffect(() => {
    appliedColumnConfigRef.current = parsedColumnConfig;
    setAppliedColumnConfig(parsedColumnConfig);
  }, [parsedColumnConfig]);

  const isMountedRef = React.useRef<boolean>(true);
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!parsedSnapshot) return;

    setDynCols(parsedSnapshot.columns as IColumn[]);
    setDynBuffer((parsedSnapshot.items as RowItem[]) || []);
    setDynNextToken(undefined);
    setDynLoading(false);
    setDynLoadingMore(false);
    setDynSchema({});
    setDynLookupOpts({});
    setPageIndex(0);

    dynLenRef.current = parsedSnapshot.items.length;
    dynTokenRef.current = undefined;
  }, [parsedSnapshot]);

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
  } = useVehiculosGrid(service, groupNameForEdit, viewId, toggleField, undefined, undefined, {
    enabled: isVisible,
    instanceKey,
  });

  const isDynMode = Boolean(viewId || appliedColumnConfig);
  const cacheKey = React.useMemo(
    () =>
      makeDynCacheKey({
        service,
        viewId,
        toggleField,
        instanceKey,
        columnConfigJson: viewColumnConfigJson || "",
      }),
    [service, viewId, toggleField, instanceKey, viewColumnConfigJson]
  );

  React.useEffect(() => {
    dynLookupTextCacheRef.current = {};
  }, [cacheKey]);

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
    (action: "approve" | "reject"): boolean =>
      shouldShowMotivoModalHelper(approveMotivoModalMode, action),
    [approveMotivoModalMode]
  );

  const isMotivoRequired = React.useCallback(
    (action: "approve" | "reject"): boolean =>
      isMotivoRequiredHelper(approveMotivoRequiredMode, action),
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
    if (snapshotEnabled && parsedSnapshot) {
      setDynCols(parsedSnapshot.columns as IColumn[]);
      setDynBuffer((parsedSnapshot.items as RowItem[]) || []);
      setDynNextToken(undefined);
      setDynLoading(false);
      setDynLoadingMore(false);
      setDynSchema({});
      setDynLookupOpts({});
      setPageIndex(0);

      dynLenRef.current = parsedSnapshot.items.length;
      dynTokenRef.current = undefined;
      return;
    }

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
  }, [parsedSnapshot, snapshotEnabled]);

  const ensureDynSchema = React.useCallback(
    async (cols: IColumn[]): Promise<EditField[]> => {
      const t0 = perfNow();
      const fieldNames = cols.map((c) => c.fieldName ?? c.key);
      const metas = await service.getFieldsMeta(fieldNames);

      const schemaMap: Record<string, EditField> = {};
      metas.forEach((m) => {
        schemaMap[m.internalName] = m;
      });
      setDynSchema(schemaMap);
      perfLog("ensureDynSchema", t0, { fields: fieldNames.length, metas: metas.length });
      return metas;
    },
    [service, perfLog]
  );

  const hydrateDynRows = React.useCallback(
    async (
      rawRows: RowItem[],
      metas: EditField[],
      seq: number,
      baseLengthBefore: number
    ): Promise<void> => {
      const t0 = perfNow();
      const svcAny = service as unknown as {
        hydrateLookupTexts?: (
          items: RowItem[],
          fieldMetas: EditField[]
        ) => Promise<{
          items: RowItem[];
          lookupOpts: Record<string, IDropdownOption[]>;
        }>;
      };

      if (typeof svcAny.hydrateLookupTexts !== "function") return;

      const hydrated = await svcAny.hydrateLookupTexts(rawRows, metas);
      if (!isMountedRef.current || seq !== requestSeq.current) return;

      const lookupMetas = metas.filter((m) => m.type === "Lookup" || m.type === "User");
      if (lookupMetas.length) {
        const cache = dynLookupTextCacheRef.current;
        for (const row of hydrated.items) {
          const rowId = getRowId(row);
          if (rowId === undefined) continue;

          const rowCache = { ...(cache[String(rowId)] || {}) };
          for (const meta of lookupMetas) {
            const text = renderCellText((row as Record<string, unknown>)[meta.internalName]).trim();
            if (text && text !== "[object Object]") {
              rowCache[meta.internalName.toLowerCase()] = text;
            }
          }
          cache[String(rowId)] = rowCache;
        }
      }

      if (baseLengthBefore === 0) {
        setDynBuffer(hydrated.items);
      } else {
        setDynBuffer((prev) => {
          const prefix = prev.slice(0, baseLengthBefore);
          return prefix.concat(hydrated.items);
        });
      }

      setDynLookupOpts(hydrated.lookupOpts);
      perfLog("hydrateDynRows", t0, {
        rows: hydrated.items.length,
        lookupFields: Object.keys(hydrated.lookupOpts).length,
      });
    },
    [service, perfLog]
  );

  // ====== helpers stringify/render robustos ======
  const unwrapResults = React.useCallback((v: unknown): unknown => {
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    if ("results" in o && Array.isArray(o.results)) return o.results;
    return v;
  }, []);

  const getRowValueInsensitive = React.useCallback((row: RowItem, key: string): unknown => {
    const target = String(key || "").trim();
    if (!target) return undefined;

    if (Object.prototype.hasOwnProperty.call(row, target)) return row[target];

    const targetLower = target.toLowerCase();
    for (const rowKey of Object.keys(row)) {
      if (String(rowKey).toLowerCase() === targetLower) {
        return row[rowKey];
      }
    }

    return undefined;
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
        const txt = el.textContent || (el as HTMLElement).innerText || "";
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

  const parseDateForDisplay = React.useCallback((value: unknown): Date | undefined => {
    if (value === undefined || value === null) return undefined;

    const text = String(value).trim();
    if (!text) return undefined;

    const isoLike =
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    if (isoLike) {
      const year = Number(isoLike[1]);
      const month = Number(isoLike[2]);
      const day = Number(isoLike[3]);
      const hour = Number(isoLike[4] || 0);
      const minute = Number(isoLike[5] || 0);
      const second = Number(isoLike[6] || 0);
      const date = new Date(year, month - 1, day, hour, minute, second);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const latamLike =
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(text);
    if (latamLike) {
      const day = Number(latamLike[1]);
      const month = Number(latamLike[2]);
      const year = Number(latamLike[3]);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }, []);

  const formatDateOnly = React.useCallback(
    (value: unknown): string => {
      const parsed = parseDateForDisplay(value);
      if (!parsed) return renderCellText(value);

      const day = parsed.getDate() < 10 ? `0${parsed.getDate()}` : String(parsed.getDate());
      const month =
        parsed.getMonth() + 1 < 10
          ? `0${parsed.getMonth() + 1}`
          : String(parsed.getMonth() + 1);

      return `${day}/${month}/${parsed.getFullYear()}`;
    },
    [parseDateForDisplay, renderCellText]
  );

  const trimCalculatedDecimals = React.useCallback(
    (value: unknown): string => {
      const text = renderCellText(value).trim();
      if (!/^-?\d+\.\d+$/.test(text)) return text;

      return text.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
    },
    [renderCellText]
  );

  const getDynDisplayText = React.useCallback(
    (row: RowItem, fieldName: string, rawVal: unknown): string => {
      const meta = dynSchema[fieldName];

      if (meta?.type === "Boolean") {
        return normalizeBooleanValue(rawVal) ? "Si" : "No";
      }

      if (meta && (meta.type === "Lookup" || meta.type === "User")) {
        const rowId = getRowId(row);
        const cachedText =
          rowId !== undefined
            ? dynLookupTextCacheRef.current[String(rowId)]?.[fieldName.toLowerCase()]
            : undefined;
        if (cachedText) return cachedText;

        const opts = dynLookupOpts[fieldName];
        const fromText = renderCellText(rawVal);
        if (fromText && fromText !== "[object Object]") return fromText;

        const idCandidates = [
          rawVal,
          getRowValueInsensitive(row, `${fieldName}Id`),
          getRowValueInsensitive(row, `${fieldName}_Id`),
          getRowValueInsensitive(row, `${fieldName}ID`),
          getRowValueInsensitive(row, `${fieldName}Ids`),
          getRowValueInsensitive(row, `${fieldName}_Ids`),
        ];

        const titleCandidates = [
          getRowValueInsensitive(row, `${fieldName}Title`),
          getRowValueInsensitive(row, `${fieldName}_Title`),
          getRowValueInsensitive(row, `${fieldName}Name`),
          getRowValueInsensitive(row, `${fieldName}.Title`),
          getRowValueInsensitive(row, `${fieldName}.title`),
        ];
        for (const candidate of titleCandidates) {
          const text = renderCellText(candidate).trim();
          if (text && text !== "[object Object]") return text;
        }

        const ids = idCandidates.reduce<Array<number | string>>(
          (acc, cand) => acc.concat(extractIds(cand)),
          []
        );

        if (ids.length && opts && opts.length) {
          const txt = ids
            .map((id) => opts.find((o) => String(o.key) === String(id))?.text)
            .filter(Boolean)
            .join(", ");
          if (txt) return txt;
        }

        if (typeof rawVal === "object" && rawVal) {
          const o = rawVal as Record<string, unknown>;
          const candidate =
            String(o.Title ?? o.title ?? o.Name ?? o.text ?? o.Email ?? o.EMail ?? "").trim();
          if (candidate) return candidate;
        }

        return "";
      }

      if (meta?.type === "DateTime") return formatDateOnly(rawVal);
      if (meta?.type === "Calculated") return trimCalculatedDecimals(rawVal);
      if (meta?.type === "MultiChoice") return Array.isArray(rawVal) ? rawVal.join(", ") : "";

      return renderCellText(rawVal);
    },
    [dynLookupOpts, dynSchema, extractIds, formatDateOnly, renderCellText, trimCalculatedDecimals]
  );

  const renderLockedQuickEditCell = React.useCallback(
    (fieldName: string, title: string, value: unknown): JSX.Element => {
      const text = renderCellText(value) || "No editable";

      return (
        <span
          role="button"
          tabIndex={0}
          title={`${title || fieldName} no se edita desde la grilla`}
          onClick={() => openLockedQuickEditModal(fieldName, title)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              openLockedQuickEditModal(fieldName, title);
            }
          }}
          style={{
            cursor: "pointer",
            color: "#605e5c",
            textDecoration: "underline dotted",
          }}
        >
          {text}
        </span>
      );
    },
    [openLockedQuickEditModal, renderCellText]
  );

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
      copy.sort((a, b) => {
        const av = getSortable((a as Record<string, unknown>)?.[field]);
        const bv = getSortable((b as Record<string, unknown>)?.[field]);
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
      const t0 = perfNow();
      if (!isDynMode)
        return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
      if (!isMountedRef.current)
        return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

      const seq = ++requestSeq.current;
      const activeColumnConfig = appliedColumnConfigRef.current;
      const useCustomListMode = Boolean(
        activeColumnConfig &&
          activeColumnConfig.listId === listId &&
          activeColumnConfig.columns.length > 0
      );

      try {
        if (!isMountedRef.current)
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

        if (opts.initial) {
          setDynLoading(true);
          setPageIndex(0);
        } else {
          setDynLoadingMore(true);
        }

        const svcAny = service as unknown as {
          getListGridPaged?: (
            listId: string,
            pageSize: number,
            nextToken?: string,
            options?: { resolveLookups?: boolean }
          ) => Promise<{
            columns?: ViewGridColumn[];
            items?: RowItem[];
            nextToken?: string;
          }>;
          getViewGridPaged?: (
            viewId: string,
            pageSize: number,
            nextToken?: string,
            toggleField?: string,
            sortField?: string,
            sortDesc?: boolean,
            options?: { resolveLookups?: boolean }
          ) => Promise<{
            columns?: ViewGridColumn[];
            items?: RowItem[];
            nextToken?: string;
          }>;
        };
        const viewIdSafe = String(viewId ?? "").trim();

        if (useCustomListMode) {
          const full: {
            columns?: ViewGridColumn[];
            items?: RowItem[];
            nextToken?: string;
          } =
            typeof svcAny.getListGridPaged === "function"
              ? await svcAny.getListGridPaged!(
                  listId,
                  FETCH_BATCH,
                  opts.initial ? undefined : dynTokenRef.current,
                  { resolveLookups: false }
                )
              : (() => {
                  throw new Error(
                    "El service no implementa getListGridPaged, necesario para el modo de snapshot personalizado."
                  );
                })();

          if (!isMountedRef.current || seq !== requestSeq.current)
            return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

          const cols: IColumn[] = ((full.columns || []) as ViewGridColumn[]).map((c) => ({
            key: c.key,
            name: c.name,
            fieldName: c.fieldName,
            minWidth: c.minWidth ?? 100,
            isResizable: c.isResizable ?? true,
          }));

          const orderedCols =
            activeColumnConfig?.columns
              ?.filter((entry) => entry.visible)
              .map((entry) => {
                const hit = cols.find(
                  (col) =>
                    String(col.fieldName ?? col.key ?? "").trim().toLowerCase() ===
                    entry.internalName.trim().toLowerCase()
                );
                if (!hit) return undefined;
                return {
                  ...hit,
                  name: entry.title || hit.name,
                  fieldName: hit.fieldName ?? hit.key,
                } as IColumn;
              })
              .filter((col): col is IColumn => Boolean(col)) || [];

          setDynCols(orderedCols);
          const metas = await ensureDynSchema(orderedCols);

          const rawItems = Array.isArray(full.items) ? (full.items as RowItem[]) : [];
          const newItems =
            !isFiltered && sort.field
              ? sortItemsLocal(rawItems, sort.field, sort.desc)
              : rawItems;
          const baseLenBefore = dynLenRef.current;
          setDynBuffer(newItems);
          setDynNextToken(full.nextToken);

          dynLenRef.current = newItems.length;
          dynTokenRef.current = full.nextToken;

          if (opts.initial) {
            await hydrateDynRows(newItems, metas, seq, baseLenBefore);
          }

          perfLog("fetchDynBatch.list", t0, {
            initial: opts.initial,
            rows: newItems.length,
            nextToken: dynTokenRef.current ? "yes" : "no",
          });
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
        }

        if (typeof svcAny.getViewGridPaged !== "function") {
          if (!viewIdSafe) {
            throw new Error("viewId requerido");
          }

          const full = await service.getViewGrid(viewIdSafe, toggleField, {
            resolveLookups: false,
          });
          if (!isMountedRef.current || seq !== requestSeq.current)
            return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

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
          const metas = await ensureDynSchema(cols);

          const newItems = Array.isArray(full.items) ? (full.items as RowItem[]) : [];
          const baseLenBefore = dynLenRef.current;
          setDynBuffer(newItems);
          setDynNextToken(undefined);

          dynLenRef.current = newItems.length;
          dynTokenRef.current = undefined;

          if (opts.initial) {
            await hydrateDynRows(newItems, metas, seq, baseLenBefore);
          }

          perfLog("fetchDynBatch.fallback", t0, {
            initial: opts.initial,
            rows: newItems.length,
            nextToken: dynTokenRef.current ? "yes" : "no",
          });
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
        }

        const effectiveSortField = isFiltered ? undefined : sort.field;
        const effectiveSortDesc = isFiltered ? undefined : sort.desc;

        const doCall = async (
          sortDescArg: boolean | undefined,
          sortFieldArg?: string
        ): Promise<{
          columns?: ViewGridColumn[];
          items?: RowItem[];
          nextToken?: string;
        }> => {
          if (!viewIdSafe) {
            throw new Error("viewId requerido");
          }

          return svcAny.getViewGridPaged!(
            viewIdSafe,
            FETCH_BATCH,
            opts.initial ? undefined : dynTokenRef.current,
            toggleField,
            sortFieldArg ?? effectiveSortField,
            sortDescArg,
            { resolveLookups: false }
          );
        };

        let res = await doCall(effectiveSortDesc as boolean | undefined, effectiveSortField);
        if (!isMountedRef.current)
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

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
        if (!isMountedRef.current)
          return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };

        const cols: IColumn[] = (res.columns || []).map((c) => ({
          key: c.key,
          name: c.name,
          fieldName: c.fieldName,
          minWidth: c.minWidth ?? 100,
          isResizable: c.isResizable ?? true,
        }));

        setDynCols(cols);
        const metas = await ensureDynSchema(cols);

        const newItems = Array.isArray(res.items) ? res.items : [];
        const baseLenBefore = dynLenRef.current;
        setDynBuffer((prev) => (opts.initial ? newItems : prev.concat(newItems)));

        const resAny = res as {
          nextToken?: string;
          NextToken?: string;
          nextPageToken?: string;
          NextPageToken?: string;
          next?: string;
          Next?: string;
          nextHref?: string;
          NextHref?: string;
          odataNextLink?: string;
          "@odata.nextLink"?: string;
        };

        const nextToken =
          resAny.nextToken ??
          resAny.NextToken ??
          resAny.nextPageToken ??
          resAny.NextPageToken ??
          resAny.next ??
          resAny.Next ??
          resAny.nextHref ??
          resAny.NextHref ??
          resAny.odataNextLink ??
          resAny["@odata.nextLink"];

        // ✅ FIX: no pisar con res.nextToken al final (a veces viene undefined aunque nextToken exista)
        const normalizedNext = (nextToken ?? res.nextToken) as string | undefined;

        setDynNextToken(normalizedNext);
        dynTokenRef.current = normalizedNext;

        dynLenRef.current = opts.initial
          ? newItems.length
          : dynLenRef.current + newItems.length;

        await hydrateDynRows(newItems, metas, seq, baseLenBefore);

        perfLog("fetchDynBatch.paged", t0, {
          initial: opts.initial,
          rows: newItems.length,
          nextToken: dynTokenRef.current ? "yes" : "no",
        });

        return { bufferLen: dynLenRef.current, nextToken: dynTokenRef.current };
      } finally {
        if (isMountedRef.current) {
          if (opts.initial) setDynLoading(false);
          else setDynLoadingMore(false);
        }
      }
    },
    [
      service,
      listId,
      viewId,
      toggleField,
      ensureDynSchema,
      hydrateDynRows,
      perfLog,
      sort.field,
      sort.desc,
      sortItemsLocal,
      isFiltered,
    ]
  );

  // ✅ hard refresh
  const hardRefresh = React.useCallback((): void => {
    if (!isMountedRef.current) return;

    if (snapshotEnabled) {
      if (typeof onCaptureViewSnapshot === "function") {
        Promise.resolve(onCaptureViewSnapshot()).catch(() => {});
      }
      return;
    }

    if (!isVisible) {
      clearDynCache(cacheKey);
      resetDyn();
      return;
    }

    refresh().catch(() => {});
    requestSeq.current += 1;

    if (isDynMode) {
      clearDynCache(cacheKey);
      resetDyn();
      fetchDynBatch({ initial: true }).catch(() => {});
    }
  }, [
    isVisible,
    refresh,
    isDynMode,
    cacheKey,
    resetDyn,
    fetchDynBatch,
    snapshotEnabled,
    onCaptureViewSnapshot,
  ]);

  React.useEffect(() => {
    if (!isVisible) return;

    if (snapshotEnabled) {
      resetDyn();
      return;
    }

    if (!isDynMode) {
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
  }, [isVisible, isDynMode, cacheKey, resetDyn, fetchDynBatch, snapshotEnabled]);

  const loadMoreIfNeeded = React.useCallback(
    async (targetPageIndex: number): Promise<void> => {
      if (snapshotEnabled) return;
      if (!isDynMode) return;
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
    [isDynMode, isFiltered, dynLoading, dynLoadingMore, fetchDynBatch, snapshotEnabled]
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

  const dynSource = React.useMemo((): RowItem[] | undefined => (isDynMode ? currentDynBuffer : undefined), [
    isDynMode,
    currentDynBuffer,
  ]);

  const itemsFiltered = React.useMemo(() => {
    const q = qTrim.toLowerCase();

    if (dynSource) {
      const source = isFiltered ? filterSnap ?? currentDynBuffer : currentDynBuffer;
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
  }, [dynSource, s.items, qTrim, stringify, isFiltered, filterSnap, currentDynBuffer]);

  const itemsFilteredSorted = React.useMemo(() => {
    if (!sort.field) return itemsFiltered;

    if (!isDynMode)
      return sortItemsLocal(itemsFiltered as Array<Record<string, unknown>>, sort.field, sort.desc);
    if (isFiltered)
      return sortItemsLocal(itemsFiltered as Array<Record<string, unknown>>, sort.field, sort.desc);

    return itemsFiltered;
  }, [itemsFiltered, isDynMode, isFiltered, sort.field, sort.desc, sortItemsLocal]);

  const totalFiltered = itemsFilteredSorted.length;

  React.useEffect(() => {
    if (!isDynMode) return;
    if (snapshotEnabled) return;
    if (dynTokenRef.current) return;

    const maxIdx = Math.max(0, Math.ceil(totalFiltered / UI_PAGE_SIZE) - 1);
    setPageIndex((p) => Math.min(p, maxIdx));
  }, [isDynMode, totalFiltered, snapshotEnabled]);

  const pageItems = React.useMemo(() => {
    if (!isDynMode) return itemsFilteredSorted;
    const start = pageIndex * UI_PAGE_SIZE;
    return (itemsFilteredSorted as RowItem[]).slice(start, start + UI_PAGE_SIZE);
  }, [isDynMode, itemsFilteredSorted, pageIndex]);

  React.useEffect(() => {
    if (!isDynMode) return;
    if (snapshotEnabled) return;
    loadMoreIfNeeded(pageIndex).catch(() => {});
  }, [isDynMode, pageIndex, loadMoreIfNeeded, snapshotEnabled]);

  React.useEffect(() => {
    if (!isDynMode) return;
    if (snapshotEnabled) return;
    if (!isDynMode) return;
    if (isFiltered) return;

    requestSeq.current += 1;
    clearDynCache(cacheKey);
    resetDyn();
    fetchDynBatch({ initial: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDynMode, viewId, isFiltered, sort.field, sort.desc, snapshotEnabled]);

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

  const filterOutIdCols = filterOutIdColumnsHelper;

  // =======================
  // Relacionados
  // =======================
  const [relOpen, setRelOpen] = React.useState(false);
  const [relBusy, setRelBusy] = React.useState(false);
  const [relCols, setRelCols] = React.useState<IColumn[]>([]);
  const [relItems, setRelItems] = React.useState<RowItem[]>([]);
  const [relFieldTypes, setRelFieldTypes] = React.useState<Record<string, string>>({});
  const [relHasAttachments, setRelHasAttachments] = React.useState<Record<number, boolean>>({});
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

  const buildAutomateUrl = buildAutomateUrlHelper;

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
      const serviceAny = service as {
        updateItemFields?: (id: number, fields: Record<string, unknown>) => Promise<void>;
      };

      if (typeof serviceAny.updateItemFields === "function") {
        await serviceAny.updateItemFields(itemId, values);
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

      const svcAny = service as {
        getItemFieldsFromList?: (
          listId: string,
          id: number,
          internalNames: string[]
        ) => Promise<Record<string, unknown>>;
        getItemFields?: (id: number, internalNames: string[]) => Promise<Record<string, unknown>>;
        getItemValuesFromList?: (
          listId: string,
          id: number,
          schema: EditField[]
        ) => Promise<Record<string, unknown>>;
      };

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
              ? [
                  {
                    internalName: wfE,
                    title: wfE,
                    type: "Note",
                    required: false,
                    readOnly: false,
                  } as EditField,
                ]
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
        if (!isMountedRef.current) return {};
        const v = await readFields();
        if (!isMountedRef.current) return {};

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
          if (!isMountedRef.current) return;

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
        if (isMountedRef.current) {
          setApprovalBusy(false);
          setWfBusyText("");
        }
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

  const descargarAdjuntosDesdeLista = React.useCallback(
    async (targetListId: string, row: RowItem): Promise<void> => {
      const id = getRowId(row);
      if (!id) return;

      try {
        const atts = await service.listAttachments(targetListId, id);

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
    [service]
  );

  const descargarAdjuntos = React.useCallback(
    async (row: RowItem): Promise<void> => {
      await descargarAdjuntosDesdeLista(listId, row);
    },
    [descargarAdjuntosDesdeLista, listId]
  );

  const descargarAdjuntosRelacionados = React.useCallback(
    async (row: RowItem): Promise<void> => {
      const targetListId = relEditListId ?? relatedListId;
      if (!targetListId) return;

      await descargarAdjuntosDesdeLista(targetListId, row);
    },
    [descargarAdjuntosDesdeLista, relEditListId, relatedListId]
  );

  const loadRelatedFieldTypes = React.useCallback(
    async (childListId: string, cols: IColumn[]): Promise<Record<string, string>> => {
      const fieldNames = cols
        .map((c) => String(c.fieldName ?? c.key ?? "").trim())
        .filter((name) => name.length > 0);

      if (!fieldNames.length) return {};

      const wanted = new Set(fieldNames.map((name) => name.toLowerCase()));
      const allFields = await service.getListFields(childListId);
      const next: Record<string, string> = {};

      allFields.forEach((field) => {
        if (wanted.has(field.internalName.toLowerCase())) {
          next[field.internalName] = field.type;
        }
      });

      return next;
    },
    [service]
  );

  const loadRelatedAttachmentFlags = React.useCallback(
    async (childListId: string, items: RowItem[]): Promise<Record<number, boolean>> => {
      const pairs = await Promise.all(
        items.map(async (item): Promise<[number, boolean] | undefined> => {
          const id = getRowId(item);
          if (id === undefined) return undefined;

          const rawValue = item.Attachments;
          if (rawValue !== undefined) {
            return [id, normalizeBooleanValue(rawValue)];
          }

          try {
            const fields = await service.getItemFieldsFromList(childListId, id, ["Attachments"]);
            return [id, normalizeBooleanValue(fields.Attachments)];
          } catch {
            return [id, false];
          }
        })
      );

      const next: Record<number, boolean> = {};
      pairs.forEach((pair) => {
        if (!pair) return;
        next[pair[0]] = pair[1];
      });

      return next;
    },
    [service]
  );

  const renderRelatedCellText = React.useCallback(
    (fieldName: string | undefined, value: unknown): string => {
      const key = String(fieldName || "").trim();
      const fieldType = key ? relFieldTypes[key] : undefined;

      if (fieldType === "DateTime") return formatDateOnly(value);
      if (fieldType === "Calculated") return trimCalculatedDecimals(value);
      if (fieldType === "Boolean") return normalizeBooleanValue(value) ? "Si" : "No";

      return renderCellText(value);
    },
    [relFieldTypes, formatDateOnly, trimCalculatedDecimals, renderCellText]
  );

  const openRelated = React.useCallback(
    async (row: RowItem): Promise<void> => {
      if (!relatedListId || !relatedParentField || !relatedChildField) return;

      const parentValue = row?.[relatedParentField] as ParentValue;
      setRelParentValue(parentValue);
      setRelOpen(true);
      setRelBusy(true);
      setRelFieldTypes({});
      setRelHasAttachments({});

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

          const fieldTypes = await loadRelatedFieldTypes(relatedListId, cols);
          const attachmentFlags = allowRelatedDownloadAttachments
            ? await loadRelatedAttachmentFlags(relatedListId, items as RowItem[])
            : {};
          setRelCols(cols);
          setRelItems(items as RowItem[]);
          setRelFieldTypes(fieldTypes);
          setRelHasAttachments(attachmentFlags);
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

          const fieldTypes = await loadRelatedFieldTypes(relatedListId, cols);
          const attachmentFlags = allowRelatedDownloadAttachments
            ? await loadRelatedAttachmentFlags(relatedListId, items as RowItem[])
            : {};
          setRelCols(cols);
          setRelItems(items as RowItem[]);
          setRelFieldTypes(fieldTypes);
          setRelHasAttachments(attachmentFlags);
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
      allowRelatedDownloadAttachments,
      loadRelatedAttachmentFlags,
      loadRelatedFieldTypes,
    ]
  );

  const openRelatedEdit = React.useCallback(
    async (item: RowItem): Promise<void> => {
      if (!allowRelatedEdit) return;
      if (!relEditListId || !relatedEditViewId) return;

      const itemId = getRowId(item);
      if (itemId === undefined) return;

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

  const csvEscape = csvEscapeHelper;

  const buildExportRows = (): ExportRows => {
    if (activeDynCols && isDynMode) {
      const headers = activeDynCols.map((c) => c.name);
      const rows = (itemsFilteredSorted as RowItem[]).map((it) =>
        activeDynCols.map((c) =>
          renderCellText((it as Record<string, unknown>)[c.fieldName ?? c.key])
        )
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
        const rowId = getRowId(row);
        const isEditing = s.editingId !== undefined && rowId !== undefined && s.editingId === rowId;

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
        const rowId = getRowId(it as unknown as RowItem);
        const isEditing = s.editingId !== undefined && rowId !== undefined && s.editingId === rowId;

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
    if (!currentDynCols) return customGridMode ? [] : undefined;

    return activeDynCols.map((c) => {
      const fieldName = c.fieldName ?? c.key;

      return {
        ...c,
        onRender: (it?: unknown) => {
          if (!it) return undefined;

          const row = it as RowItem;
          const rowId = getRowId(row);
          const isEditing = s.editingId !== undefined && rowId !== undefined && s.editingId === rowId;

          const rawVal = row[fieldName];
          const meta = dynSchema[fieldName];
          const quickEditLocked = isQuickEditLocked(fieldName);
          const fieldTitle = c.name || fieldName;
          const displayValue = getDynDisplayText(row, fieldName, rawVal);

          if (quickEditLocked) {
            return renderLockedQuickEditCell(fieldName, fieldTitle, displayValue);
          }

          // display
          if (!isEditing) {
            if (meta?.type === "Boolean") {
              const booleanText = normalizeBooleanValue(rawVal) ? "Si" : "No";
              return <span>{booleanText}</span>;
              return <span>{normalizeBooleanValue(rawVal) ? "SÃ­" : "No"}</span>;
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
              const normalizedDraftValue = (s.draft as unknown as Record<string, unknown>)?.[
                fieldName
              ];
              const normalizedCurrentValue =
                normalizedDraftValue !== undefined
                  ? normalizeBooleanValue(normalizedDraftValue)
                  : normalizeBooleanValue(rawVal);

              return (
                <Dropdown
                  options={[
                    { key: "true", text: "Si" },
                    { key: "false", text: "No" },
                  ]}
                  selectedKey={normalizedCurrentValue ? "true" : "false"}
                  onChange={(_, opt) =>
                    updateDraft({ [fieldName]: opt?.key === "true" } as Record<string, unknown>)
                  }
                />
              );

              const draftValue = (s.draft as unknown as Record<string, unknown>)?.[fieldName];
              const currentValue =
                draftValue !== undefined
                  ? normalizeBooleanValue(draftValue)
                  : normalizeBooleanValue(rawVal);

              return (
                <Dropdown
                  options={[
                    { key: "true", text: "SÃ­" },
                    { key: "false", text: "No" },
                  ]}
                  selectedKey={currentValue ? "true" : "false"}
                  onChange={(_, opt) =>
                    updateDraft({ [fieldName]: opt?.key === "true" } as Record<string, unknown>)
                  }
                />
              );

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
              const selectedKey: string | number | undefined = ids.length ? ids[0] : undefined;

              return (
                <Dropdown
                  options={opts}
                  selectedKey={selectedKey}
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
    activeDynCols,
    dynSchema,
    dynLookupOpts,
    s.editingId,
    s.draft,
    updateDraft,
    renderCellText,
    extractIds,
    unwrapResults,
    customGridMode,
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
      const isEditing = s.editingId !== undefined && thisId !== undefined && s.editingId === thisId;

      const real = (s.items as Vehiculo[]).find(
        (r) => getRowId(r as unknown as RowItem) === thisId
      ) || (row as Vehiculo);

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
  const refreshButtonText = snapshotEnabled ? "Actualizar snapshot" : "Refrescar";
  const refreshButtonIcon = snapshotEnabled ? "Save" : "Refresh";

  const showOverlaySpinner =
    (isDynMode ? dynLoading : s.loading) &&
    (isDynMode ? currentDynBuffer.length : (s.items as unknown[]).length) > 0;

  const openColumnEditor = React.useCallback(async (): Promise<void> => {
    if (!listId) return;

    setColumnEditorOpen(true);
    setColumnEditorLoading(true);
    setColumnEditorError("");
    setDragOverIndex(null);
    dragSourceIndexRef.current = null;

    try {
      const fields = await service.getListFields(listId);
      const savedEntries =
        appliedColumnConfig &&
        appliedColumnConfig.listId === listId &&
        (!appliedColumnConfig.viewId || appliedColumnConfig.viewId === viewId)
          ? appliedColumnConfig.fields?.length
            ? appliedColumnConfig.fields
            : appliedColumnConfig.columns
          : [];

      const existingMap = new Map<string, ViewColumnConfigEntry>();
      savedEntries.forEach((entry) => {
        existingMap.set(entry.internalName.toLowerCase(), entry);
      });

      const nextEntries: ViewColumnConfigEntry[] = [];
      fields.forEach((field, index) => {
        const hit = existingMap.get(field.internalName.toLowerCase());
      nextEntries.push({
        internalName: field.internalName,
        title: hit?.title || field.title,
        type: field.type,
        visible: hit ? hit.visible !== false : true,
        editable: hit ? hit.editable !== false : true,
        order: hit && typeof hit.order === "number" ? hit.order : index,
      });
    });

      const unknownExisting = savedEntries.filter(
        (entry) =>
          !fields.some(
            (field) => field.internalName.toLowerCase() === entry.internalName.toLowerCase()
          )
      );
      unknownExisting.forEach((entry) => {
        nextEntries.push({ ...entry });
      });

      nextEntries.sort((a, b) => a.order - b.order);
      setColumnEditorEntries(nextEntries);
    } catch (error) {
      setColumnEditorError(
        error instanceof Error ? error.message : "No se pudieron cargar los campos de la lista."
      );
      setColumnEditorEntries([]);
    } finally {
      setColumnEditorLoading(false);
    }
  }, [appliedColumnConfig, listId, service, viewId]);

  const toggleColumnVisibility = React.useCallback((internalName: string): void => {
    const target = String(internalName || "").toLowerCase();
    setColumnEditorEntries((prev) =>
      prev.map((entry) =>
        entry.internalName.toLowerCase() === target
          ? { ...entry, visible: !entry.visible }
          : entry
      )
    );
  }, []);

  const toggleColumnEditable = React.useCallback((internalName: string): void => {
    const target = String(internalName || "").toLowerCase();
    setColumnEditorEntries((prev) =>
      prev.map((entry) =>
        entry.internalName.toLowerCase() === target
          ? { ...entry, editable: entry.editable === false }
          : entry
      )
    );
  }, []);

  const moveColumn = React.useCallback((internalName: string, delta: -1 | 1): void => {
    const target = String(internalName || "").toLowerCase();
    setColumnEditorEntries((prev) => {
      const idx = prev.findIndex((entry) => entry.internalName.toLowerCase() === target);
      if (idx < 0) return prev;

      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const copy = prev.slice();
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;

      return copy.map((entry, order) => ({ ...entry, order }));
    });
  }, []);

  const setAllColumnVisibility = React.useCallback((visible: boolean): void => {
    setColumnEditorEntries((prev) =>
      prev.map((entry, order) => ({
        ...entry,
        visible,
        order,
      }))
    );
  }, []);

  const reorderColumnByIndex = React.useCallback((fromIndex: number, toIndex: number): void => {
    setColumnEditorEntries((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;

      const copy = prev.slice();
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy.map((entry, order) => ({ ...entry, order }));
    });
  }, []);

  const allColumnsVisible = React.useMemo(
    () => columnEditorEntries.length > 0 && columnEditorEntries.every((entry) => entry.visible),
    [columnEditorEntries]
  );
  const someColumnsVisible = React.useMemo(
    () => columnEditorEntries.some((entry) => entry.visible),
    [columnEditorEntries]
  );

  const handleColumnDragStart = React.useCallback((index: number): void => {
    dragSourceIndexRef.current = index;
  }, []);

  const handleColumnDragOver = React.useCallback((ev: React.DragEvent<HTMLElement>, index: number): void => {
    ev.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleColumnDrop = React.useCallback((ev: React.DragEvent<HTMLElement>, index: number): void => {
    ev.preventDefault();
    const fromIndex = dragSourceIndexRef.current;
    dragSourceIndexRef.current = null;
    setDragOverIndex(null);
    if (fromIndex === null || fromIndex === undefined) return;
    reorderColumnByIndex(fromIndex, index);
  }, [reorderColumnByIndex]);

  const handleColumnDragEnd = React.useCallback((): void => {
    dragSourceIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const saveColumnEditor = React.useCallback(async (): Promise<void> => {
    if (!listId || !onSaveViewColumnConfig) return;

    const config = buildViewColumnConfig({
      listId,
      columns: columnEditorEntries,
      capturedAt: new Date().toISOString(),
    });

    appliedColumnConfigRef.current = config;
    await Promise.resolve(onSaveViewColumnConfig(stringifyViewColumnConfig(config)));
    setAppliedColumnConfig(config);
    if (isDynMode && !snapshotEnabled) {
      requestSeq.current += 1;
      clearDynCache(cacheKey);
      resetDyn();
      fetchDynBatch({ initial: true }).catch(() => {});
    }
    setColumnEditorOpen(false);
  }, [
    cacheKey,
    columnEditorEntries,
    fetchDynBatch,
    isDynMode,
    listId,
    onSaveViewColumnConfig,
    resetDyn,
    snapshotEnabled,
    toggleField,
  ]);

  const hasSeenColumnEditorNonceRef = React.useRef<boolean>(false);
  const lastColumnEditorNonceRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (columnEditorOpenNonce === undefined) return;
    if (!hasSeenColumnEditorNonceRef.current) {
      hasSeenColumnEditorNonceRef.current = true;
      lastColumnEditorNonceRef.current = columnEditorOpenNonce;
      return;
    }
    if (lastColumnEditorNonceRef.current === columnEditorOpenNonce) return;
    lastColumnEditorNonceRef.current = columnEditorOpenNonce;
    openColumnEditor().catch(() => undefined);
  }, [columnEditorOpenNonce, openColumnEditor]);

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
      text: refreshButtonText,
      iconProps: { iconName: refreshButtonIcon },
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
  if ((s.loading && !isDynMode) || (isDynMode && dynLoading && currentDynBuffer.length === 0)) {
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

  const renderCustomGridTable = (): JSX.Element | undefined => {
    if (!customGridMode) return undefined;

    return (
      <div className="cnco-html-grid-wrap">
        <table className="cnco-html-grid" role="grid">
          <thead>
            <tr>
              {columns.map((col) => {
                const field = col.fieldName ?? col.key;
                const isSortable = col.key !== "acciones" && col.key !== "semaforo" && Boolean(field);
                const isSorted = sort.field === field;
                const width = typeof col.minWidth === "number" && col.minWidth > 0 ? col.minWidth : undefined;

                return (
                  <th
                    key={col.key}
                    className={isSortable ? "cnco-sortable" : undefined}
                    style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                    onClick={
                      isSortable
                        ? () => {
                            onColumnClick(undefined, col);
                          }
                        : undefined
                    }
                    role={isSortable ? "button" : undefined}
                    aria-sort={isSorted ? (sort.desc ? "descending" : "ascending") : "none"}
                  >
                    <div className="cnco-head-inner">
                      <span>{col.name}</span>
                      {isSorted ? <span aria-hidden="true">{sort.desc ? "v" : "^"}</span> : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, rowIndex) => {
              const row = item as RowItem;
              const rowId = getRowId(row);
              const isEditing =
                s.editingId !== undefined && rowId !== undefined && s.editingId === rowId;
              const actionRow = {
                ...row,
                id: rowId,
                Id: rowId,
                ID: rowId,
                ItemId: rowId,
                ID_x0020_: rowId,
                Id_x0020_: rowId,
              } as unknown as Vehiculo;

              return (
                <tr
                  key={String(rowId ?? rowIndex)}
                  className={isEditing ? "cnco-row-editing" : "cnco-row"}
                >
                  {columns.map((col) => {
                    const fieldName = col.fieldName ?? col.key;
                    const width =
                      typeof col.minWidth === "number" && col.minWidth > 0
                        ? col.minWidth
                        : undefined;
                    let content: React.ReactNode;

                    if (col.key === "acciones") {
                      content = isEditing ? (
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
                              onClick={() => {
                                if (rowId === undefined) return;
                                enterEdit(actionRow);
                              }}
                              disabled={approvalBusy || rowId === undefined}
                            />
                          )}
                          {showDelete && rowId !== undefined && (
                            <IconButton
                              iconProps={{ iconName: "Delete" }}
                              title="Borrar"
                              onClick={() => remove(rowId).catch(() => {})}
                              disabled={approvalBusy}
                            />
                          )}
                          {toggleField && showToggle && rowId !== undefined && (
                            <IconButton
                              iconProps={{ iconName: actionRow.toggle ? "CircleStop" : "Play" }}
                              title={actionRow.toggle ? "Desactivar" : "Activar"}
                              onClick={() => toggleActive(actionRow).catch(() => {})}
                              disabled={approvalBusy}
                            />
                          )}
                          {canApprove && rowId !== undefined && approvalFieldsValid && (
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
                              onClick={() => descargarAdjuntos(actionRow).catch(() => {})}
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
                    } else if (isEditing && col.onRender) {
                      content = col.onRender(row, rowIndex, col);
                    } else {
                      content = <span>{getDynDisplayText(row, fieldName, row[fieldName])}</span>;
                    }

                    return (
                      <td
                        key={`${String(rowId ?? rowIndex)}-${col.key}`}
                        style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                        className={col.key === "acciones" ? "cnco-actions-cell" : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const hasDownloadableRelatedItems =
    allowRelatedDownloadAttachments &&
    relItems.some((item) => {
      const id = getRowId(item);
      return id !== undefined && relHasAttachments[id] === true;
    });

  return (
    <div className="cnco-vehiculos-shell" ref={shellRef}>
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
                {customGridMode ? (
                  renderCustomGridTable()
                ) : (
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
                )}

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

          {/* ===== Modal columnas ===== */}
          <Modal
            isOpen={columnEditorOpen}
            onDismiss={() => {
              if (columnEditorLoading) return;
              setColumnEditorOpen(false);
              setColumnEditorError("");
            }}
            isBlocking={true}
            allowTouchBodyScroll
            styles={{
              root: { zIndex: 100000 },
              layer: { zIndex: 100000 },
              main: {
                zIndex: 100001,
                width: isMobile ? "96vw" : "78vw",
                maxWidth: "980px",
                borderRadius: 12,
                overflow: "hidden",
              },
              scrollableContent: { zIndex: 100001 },
            }}
          >
            <div className={modalHeader}>
              <span style={{ fontWeight: 600 }}>Campos de la lista</span>
              <IconButton
                iconProps={{ iconName: "Cancel" }}
                styles={{ root: { color: "#fff" } }}
                onClick={() => {
                  if (columnEditorLoading) return;
                  setColumnEditorOpen(false);
                  setColumnEditorError("");
                }}
                ariaLabel="Cerrar"
              />
            </div>

            <div className={modalBody}>
              {columnEditorLoading ? (
                <Spinner label="Cargando campos..." />
              ) : (
                <Stack tokens={{ childrenGap: 10 }}>
                  <div style={{ color: "#605e5c" }}>
                    Elegí qué campos mostrar, ocultá los que no quieras y ordenalos antes de guardar la configuración.
                  </div>

                  <Stack
                    horizontal
                    verticalAlign="center"
                    horizontalAlign="space-between"
                    tokens={{ childrenGap: 8 }}
                    styles={{ root: { padding: "8px 10px", background: "#f8f9fb", borderRadius: 8 } }}
                  >
                    <Checkbox
                      label="Mostrar todos"
                      checked={allColumnsVisible}
                      indeterminate={!allColumnsVisible && someColumnsVisible}
                      onChange={(_, checked) => setAllColumnVisibility(Boolean(checked))}
                    />
                    <span style={{ fontSize: 12, color: "#605e5c" }}>
                      {columnEditorEntries.filter((entry) => entry.visible).length} de{" "}
                      {columnEditorEntries.length} visibles
                    </span>
                  </Stack>

                  {columnEditorError && (
                    <div style={{ color: "#a4262c", fontWeight: 600 }}>{columnEditorError}</div>
                  )}

                  <Stack
                    tokens={{ childrenGap: 6 }}
                    styles={{
                      root: {
                        maxHeight: "52vh",
                        overflow: "auto",
                        paddingRight: 4,
                      },
                    }}
                  >
                    {columnEditorEntries.map((entry, index) => (
                      <Stack
                        key={entry.internalName}
                        horizontal
                        verticalAlign="center"
                        tokens={{ childrenGap: 8 }}
                        draggable
                        onDragStart={() => handleColumnDragStart(index)}
                        onDragOver={(ev) => handleColumnDragOver(ev, index)}
                        onDrop={(ev) => handleColumnDrop(ev, index)}
                        onDragEnd={handleColumnDragEnd}
                        styles={{
                          root: {
                            padding: "8px 10px",
                            border: "1px solid #e5e5e5",
                            borderRadius: 8,
                            background:
                              dragOverIndex === index
                                ? "#eaf4ff"
                                : entry.visible
                                ? "#fff"
                                : "#fafafa",
                            cursor: "grab",
                          },
                        }}
                      >
                        <div
                          title="Arrastrar para reordenar"
                          style={{
                            width: 24,
                            textAlign: "center",
                            color: "#605e5c",
                            userSelect: "none",
                            fontSize: 18,
                            lineHeight: "18px",
                            cursor: "grab",
                          }}
                          draggable
                          onDragStart={() => handleColumnDragStart(index)}
                          onDragEnd={handleColumnDragEnd}
                        >
                          ⋮⋮
                        </div>
                        <Checkbox
                          checked={entry.visible}
                          onChange={() => toggleColumnVisibility(entry.internalName)}
                        />
                        <Checkbox
                          label="Editable en grilla"
                          checked={entry.editable !== false}
                          onChange={() => toggleColumnEditable(entry.internalName)}
                        />
                        <Stack grow>
                          <div style={{ fontWeight: 600 }}>{entry.title}</div>
                          <div style={{ fontSize: 12, color: "#605e5c" }}>
                            {entry.internalName}
                            {entry.type ? ` • ${entry.type}` : ""}
                          </div>
                        </Stack>
                        <IconButton
                          iconProps={{ iconName: "ChevronUp" }}
                          title="Subir"
                          onClick={() => moveColumn(entry.internalName, -1)}
                          disabled={index === 0}
                        />
                        <IconButton
                          iconProps={{ iconName: "ChevronDown" }}
                          title="Bajar"
                          onClick={() => moveColumn(entry.internalName, 1)}
                          disabled={index === columnEditorEntries.length - 1}
                        />
                      </Stack>
                    ))}
                  </Stack>

                  <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 8 } }}>
                    <PrimaryButton
                      text="Guardar"
                      onClick={() => saveColumnEditor().catch(() => {})}
                      disabled={columnEditorLoading || !columnEditorEntries.length}
                    />
                    <DefaultButton
                      text="Cancelar"
                      onClick={() => {
                        if (columnEditorLoading) return;
                        setColumnEditorOpen(false);
                        setColumnEditorError("");
                      }}
                      disabled={columnEditorLoading}
                    />
                  </Stack>
                </Stack>
              )}
            </div>
          </Modal>

          {/* ===== Modal ediciÃ³n bloqueada ===== */}
          <Modal
            isOpen={lockedQuickEditModalOpen}
            onDismiss={() => setLockedQuickEditModalOpen(false)}
            isBlocking={false}
            allowTouchBodyScroll
            styles={{
              main: {
                width: isMobile ? "94vw" : "520px",
                maxWidth: "94vw",
                borderRadius: 12,
                overflow: "hidden",
              },
            }}
          >
            <div className={modalHeader}>
              <span style={{ fontWeight: 600 }}>Campo no editable</span>
              <IconButton
                iconProps={{ iconName: "Cancel" }}
                styles={{ root: { color: "#fff" } }}
                onClick={() => setLockedQuickEditModalOpen(false)}
                ariaLabel="Cerrar"
              />
            </div>
            <div className={modalBody}>
              <Stack tokens={{ childrenGap: 12 }}>
                <div style={{ color: "#323130", lineHeight: 1.5 }}>
                  <strong>{lockedQuickEditModalTitle || lockedQuickEditModalField}</strong> no se
                  puede editar desde la grilla. Este valor debe modificarse desde el formulario de
                  edición.
                </div>
                <DefaultButton text="Entendido" onClick={() => setLockedQuickEditModalOpen(false)} />
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
                      ...(allowRelatedEdit || hasDownloadableRelatedItems
                        ? [
                            {
                              key: "relActions",
                              name: "Acciones",
                              minWidth:
                                (allowRelatedEdit ? 44 : 0) + (hasDownloadableRelatedItems ? 44 : 0),
                              onRender: (it?: unknown) => {
                                if (!it) return undefined;

                                const row = it as RowItem;
                                const rowId = getRowId(row);
                                const canDownload =
                                  rowId !== undefined && relHasAttachments[rowId] === true;

                                if (!allowRelatedEdit && !canDownload) return undefined;

                                return (
                                  <Stack horizontal tokens={{ childrenGap: 4 }}>
                                    {allowRelatedEdit && (
                                      <IconButton
                                        iconProps={{ iconName: "Edit" }}
                                        title="Editar"
                                        onClick={() => openRelatedEdit(row)}
                                      />
                                    )}
                                    {canDownload && (
                                      <IconButton
                                        iconProps={{ iconName: "Download" }}
                                        title="Descargar adjuntos"
                                        onClick={() =>
                                          descargarAdjuntosRelacionados(row).catch(() => {})
                                        }
                                      />
                                    )}
                                  </Stack>
                                );
                              },
                            } as IColumn,
                          ]
                        : []),
                    ]}
                    selectionMode={SelectionMode.none}
                    constrainMode={ConstrainMode.horizontalConstrained}
                    compact={isMobile}
                    onRenderItemColumn={(item?: unknown, _i?: number, col?: IColumn) => {
                      if (!item || !col) return undefined;
                      if (col.onRender) return col.onRender(item, _i, col);

                      const row = item as RowItem;
                      const v = row[col.fieldName ?? col.key];
                      return renderRelatedCellText(col.fieldName ?? col.key, v);
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
                        const normalizedCurrentValue = normalizeBooleanValue(val);
                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            options={[
                              { key: "true", text: "Si" },
                              { key: "false", text: "No" },
                            ]}
                            selectedKey={normalizedCurrentValue ? "true" : "false"}
                            onChange={(_, opt) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: opt?.key === "true",
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );

                        const currentValue = normalizeBooleanValue(val);
                        return (
                          <Dropdown
                            key={f.internalName}
                            label={f.title}
                            options={[
                              { key: "true", text: "SÃ­" },
                              { key: "false", text: "No" },
                            ]}
                            selectedKey={currentValue ? "true" : "false"}
                            onChange={(_, opt) =>
                              setRelEditValues((prev) => ({
                                ...prev,
                                [f.internalName]: opt?.key === "true",
                              }))
                            }
                            styles={{ root: { marginBottom: 10 } }}
                          />
                        );

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
                              setRelHasAttachments(
                                allowRelatedDownloadAttachments
                                  ? await loadRelatedAttachmentFlags(relatedListId, items as RowItem[])
                                  : {}
                              );
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
                              setRelHasAttachments(
                                allowRelatedDownloadAttachments
                                  ? await loadRelatedAttachmentFlags(relatedListId, items as RowItem[])
                                  : {}
                              );
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
