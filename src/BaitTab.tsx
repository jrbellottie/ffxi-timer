// src/BaitTab.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { styles } from "./styles";
import baitData from "./data/bait.json";
import fishData from "./data/fish.json";
import rodsData from "./data/rods.json";
import rodFishData from "./data/rodFish.json";
import { loadJson, saveJson } from "./utils/storage";
import { formatVendorPrice, getVendorPriceEach } from "./utils/vendorPrice";
import {
  SkillupFish,
  SkillupRod,
  calculateRodRisk,
  calculateSkillup,
  getRodHiddenSuccessBonus,
} from "./utils/fishingSkillup";

type BaitEntry = {
  fish: string;
  lvl: number | null;
  size: string;
  bait: string | null;
  kind: string | null;
  bite: string | null;
  hookBonus: number | null;
  best: boolean;
  note: string | null;
};

type PoolEntry = {
  zone: string;
  area: string;
  fish: string;
  lvl: number | null;
  bait: string;
  kind: string;
  bite: string;
  hookBonus: number;
  sharePct: number;
  competing: string[];
};

type FishZoneEntry = {
  zone: string;
  area: string;
  catch: string;
  lvl: number | null;
  rarity: string;
  type: string;
};

const BAIT: BaitEntry[] = baitData as BaitEntry[];
const FISH_ZONES: FishZoneEntry[] = fishData as FishZoneEntry[];
const SKILLUP_FISH: SkillupFish[] = rodFishData as SkillupFish[];
const SKILLUP_RODS: SkillupRod[] = (rodsData as SkillupRod[]).filter(
  (rod) => rod.era === "TOAU" && rod.rod !== "Judges Rod" && rod.rod !== "Goldfish Basket"
);
const SKILLUP_ROD_NAMES = SKILLUP_RODS.map((rod) => rod.rod);
const SKILLUP_FISH_BY_NAME = new Map(SKILLUP_FISH.map((fish) => [fish.fish, fish]));

/** Rarity like "x0.35" → 0.35; "-" (no penalty) = 1. */
function rarityValue(rarity: string): number {
  const m = String(rarity).match(/x\s*([\d.]+)/i);
  return m ? Number(m[1]) : 1;
}

/**
 * Compute every (zone, area, fish, bait) combination with its pool share.
 * Hook weight per fish = clamp((25 + hookBonus) × rarity, 20, 120), assuming
 * neutral time/moon and adequate skill — matches the source table's model.
 * Share = target weight / total weight of all pool fish that bite that bait.
 */
function buildSpots(): PoolEntry[] {
  const baitByFish = new Map<string, BaitEntry[]>();
  for (const b of BAIT) {
    if (!b.bait || b.hookBonus === null) continue;
    const list = baitByFish.get(b.fish);
    if (list) list.push(b);
    else baitByFish.set(b.fish, [b]);
  }

  const poolMembers = new Map<string, FishZoneEntry[]>();
  for (const f of FISH_ZONES) {
    const key = `${f.zone}|${f.area}`;
    const list = poolMembers.get(key);
    if (list) list.push(f);
    else poolMembers.set(key, [f]);
  }

  const spots: PoolEntry[] = [];

  for (const members of poolMembers.values()) {
    // All baits bitten by at least one member of this pool.
    const baitsInPool = new Set<string>();
    for (const m of members) {
      for (const row of baitByFish.get(m.catch) ?? []) baitsInPool.add(row.bait as string);
    }

    for (const baitName of baitsInPool) {
      // Everyone in this pool that bites this bait, with their hook weight.
      const biters: { member: FishZoneEntry; row: BaitEntry; weight: number }[] = [];
      for (const m of members) {
        const row = (baitByFish.get(m.catch) ?? []).find((r) => r.bait === baitName);
        if (!row) continue;
        const weight = Math.min(120, Math.max(20, (25 + (row.hookBonus as number)) * rarityValue(m.rarity)));
        biters.push({ member: m, row, weight });
      }

      const total = biters.reduce((sum, b) => sum + b.weight, 0);

      for (const b of biters) {
        spots.push({
          zone: b.member.zone,
          area: b.member.area,
          fish: b.member.catch,
          lvl: b.member.lvl ?? b.row.lvl,
          bait: baitName,
          kind: b.row.kind ?? "-",
          bite: b.row.bite ?? "-",
          hookBonus: b.row.hookBonus as number,
          sharePct: Math.round((1000 * b.weight) / total) / 10,
          competing: biters.filter((o) => o !== b).map((o) => o.member.catch),
        });
      }
    }
  }

  return spots;
}

const POOLS: PoolEntry[] = buildSpots();

type Mode = "affinity" | "spots" | "skillup";

type AffinityKey = "fish" | "lvl" | "size" | "bait" | "kind" | "bite" | "hookBonus" | "vendorPriceEach" | "best" | "note";
type SpotKey = "zone" | "area" | "fish" | "lvl" | "bait" | "kind" | "bite" | "hookBonus" | "vendorPriceEach" | "sharePct" | "competingCount";
type SkillupKey =
  | "expectedLandedGain"
  | "fish"
  | "fishLevel"
  | "levelDifference"
  | "skillupChancePct"
  | "sharePct"
  | "landPct"
  | "rod"
  | "effectiveSkill"
  | "zone"
  | "area"
  | "bait";
type SortDir = "asc" | "desc";
type RodAccess = "ebisu" | "luShang" | "standard";

type SkillupRow = PoolEntry & {
  fishLevel: number;
  levelDifference: number;
  skillupChancePct: number;
  expectedResolvedGain: number;
  expectedLandedGain: number;
  rod: string;
  effectiveSkill: number;
  landPct: number;
  snapPct: number;
  breakPct: number;
  escapePct: number;
};

const AFFINITY_COLUMNS: { key: AffinityKey; label: string }[] = [
  { key: "fish", label: "Fish" },
  { key: "lvl", label: "Lvl" },
  { key: "size", label: "Size" },
  { key: "bait", label: "Bait" },
  { key: "kind", label: "Kind" },
  { key: "bite", label: "Bite" },
  { key: "hookBonus", label: "Hook Bonus" },
  { key: "vendorPriceEach", label: "Vendor Price" },
  { key: "best", label: "Best" },
  { key: "note", label: "Note" },
];

const SPOT_COLUMNS: { key: SpotKey; label: string }[] = [
  { key: "zone", label: "Zone" },
  { key: "area", label: "Area" },
  { key: "fish", label: "Target Fish" },
  { key: "lvl", label: "Lvl" },
  { key: "bait", label: "Bait" },
  { key: "kind", label: "Kind" },
  { key: "bite", label: "Bite" },
  { key: "hookBonus", label: "Hook Bonus" },
  { key: "vendorPriceEach", label: "Vendor Price" },
  { key: "sharePct", label: "Pool Share" },
  { key: "competingCount", label: "Competing" },
];

const SKILLUP_COLUMNS: { key: SkillupKey; label: string }[] = [
  { key: "expectedLandedGain", label: "Expected Gain / 100 Hooks" },
  { key: "fish", label: "Fish" },
  { key: "fishLevel", label: "Fish Lvl" },
  { key: "levelDifference", label: "+Lvl" },
  { key: "skillupChancePct", label: "Skill-up Chance" },
  { key: "sharePct", label: "Pool Share" },
  { key: "landPct", label: "Land Chance" },
  { key: "rod", label: "Rod" },
  { key: "effectiveSkill", label: "Success Skill" },
  { key: "zone", label: "Zone" },
  { key: "area", label: "Area" },
  { key: "bait", label: "Bait" },
];

const MAX_VISIBLE_ROWS = 300;
const BAIT_UI_KEY = "ffxi_bait_ui_v1";

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null && v !== ""))].sort((a, b) =>
    a.localeCompare(b)
  );
}

const KINDS = uniqueSorted(BAIT.map((b) => b.kind));
const BITES = uniqueSorted(BAIT.map((b) => b.bite));
const POOL_ZONES = uniqueSorted(POOLS.map((p) => p.zone));
const POOL_BITES = uniqueSorted(POOLS.map((p) => p.bite));

const COP_LOCKED_ZONES = new Set(["Lufaise Meadows", "Misareaux Coast"]);
const TOAU_LOCKED_ZONES = new Set([
  "Aht Urhgan Whitegate",
  "Al Zahbi",
  "Arrapago Reef",
  "Aydeewa Subterrane",
  "Bhaflau Thickets",
  "Caedarva Mire",
  "Mamook",
  "Mount Zhayolm",
  "Nashmau",
  "Open sea route to Al Zahbi",
  "Silver Sea route to Al Zahbi",
  "Silver Sea route to Nashmau",
  "Talacca Cove",
  "Wajaom Woodlands",
]);

const optionBaseStyle: React.CSSProperties = {
  backgroundColor: "#0c0c0c",
  color: "#eaeaea",
};

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#161616",
  color: "#eaeaea",
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
  borderBottom: "1px solid #444",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

const selectedRowStyle: React.CSSProperties = {
  background: "rgba(138, 246, 176, 0.12)",
  outline: "1px solid #8af6b0",
  outlineOffset: "-1px",
};

const clickableRowStyle: React.CSSProperties = {
  cursor: "pointer",
};

function shareColor(pct: number | null): React.CSSProperties {
  if (pct === null) return {};
  if (pct >= 100) return { color: "#8af6b0", fontWeight: 800 };
  if (pct >= 60) return { color: "#D8B04B", fontWeight: 700 };
  return { color: "#ff9c7a", fontWeight: 700 };
}

export default function BaitTab() {
  const rodsDropdownRef = useRef<HTMLDetailsElement | null>(null);

  type BaitUiState = {
    mode: Mode;
    aGlobal: string;
    aFish: string;
    aBait: string;
    aKind: string;
    aBite: string;
    aBestOnly: boolean;
    aLvlMin: string;
    aLvlMax: string;
    aSortKey: AffinityKey;
    aSortDir: SortDir;
    sGlobal: string;
    sFish: string;
    sZone: string;
    sArea: string;
    sBait: string;
    sKind: string;
    sBite: string;
    sMinShare: string;
    sSoloOnly: boolean;
    sSortKey: SpotKey;
    sSortDir: SortDir;
    uSkill: string;
    uBonusSkill: string;
    uSelectedRods: string[];
    uIncludeCop: boolean;
    uIncludeToau: boolean;
    uGlobal: string;
    uFish: string;
    uZone: string;
    uBait: string;
    uMinShare: string;
    uSortKey: SkillupKey;
    uSortDir: SortDir;
  };

  const defaultUi: BaitUiState = {
    mode: "affinity",
    aGlobal: "",
    aFish: "",
    aBait: "",
    aKind: "",
    aBite: "",
    aBestOnly: false,
    aLvlMin: "",
    aLvlMax: "",
    aSortKey: "fish",
    aSortDir: "asc",
    sGlobal: "",
    sFish: "",
    sZone: "",
    sArea: "",
    sBait: "",
    sKind: "",
    sBite: "",
    sMinShare: "",
    sSoloOnly: false,
    sSortKey: "sharePct",
    sSortDir: "desc",
    uSkill: "1",
    uBonusSkill: "5",
    uSelectedRods: SKILLUP_ROD_NAMES,
    uIncludeCop: true,
    uIncludeToau: true,
    uGlobal: "",
    uFish: "",
    uZone: "",
    uBait: "",
    uMinShare: "",
    uSortKey: "expectedLandedGain",
    uSortDir: "desc",
  };

  const loaded = loadJson<Partial<BaitUiState> & { uRodAccess?: RodAccess }>(BAIT_UI_KEY, {});
  const legacySelectedRods = SKILLUP_RODS.filter((rod) => {
    if (loaded.uRodAccess === "standard") return !rod.legendary;
    if (loaded.uRodAccess === "luShang") return !rod.rod.startsWith("Ebisu Fishing Rod");
    return true;
  }).map((rod) => rod.rod);
  const initialUi: BaitUiState = {
    ...defaultUi,
    ...loaded,
    mode:
      loaded.mode === "spots"
        ? "spots"
        : loaded.mode === "skillup"
            ? "skillup"
          : "affinity",
    aSortKey: AFFINITY_COLUMNS.some((c) => c.key === loaded.aSortKey)
      ? (loaded.aSortKey as AffinityKey)
      : defaultUi.aSortKey,
    aSortDir: loaded.aSortDir === "desc" ? "desc" : "asc",
    sSortKey: SPOT_COLUMNS.some((c) => c.key === loaded.sSortKey)
      ? (loaded.sSortKey as SpotKey)
      : defaultUi.sSortKey,
    sSortDir: loaded.sSortDir === "asc" ? "asc" : "desc",
    uSelectedRods: Array.isArray(loaded.uSelectedRods)
      ? loaded.uSelectedRods.filter((rod) => SKILLUP_ROD_NAMES.includes(rod))
      : legacySelectedRods,
    uSortKey: SKILLUP_COLUMNS.some((c) => c.key === loaded.uSortKey)
      ? (loaded.uSortKey as SkillupKey)
      : defaultUi.uSortKey,
    uSortDir: loaded.uSortDir === "asc" ? "asc" : "desc",
  };

  const [mode, setMode] = useState<Mode>(initialUi.mode);

  // ---- Affinity (Fish x Bait) filters ----
  const [aGlobal, setAGlobal] = useState(initialUi.aGlobal);
  const [aFish, setAFish] = useState(initialUi.aFish);
  const [aBait, setABait] = useState(initialUi.aBait);
  const [aKind, setAKind] = useState(initialUi.aKind);
  const [aBite, setABite] = useState(initialUi.aBite);
  const [aBestOnly, setABestOnly] = useState(initialUi.aBestOnly);
  const [aLvlMin, setALvlMin] = useState(initialUi.aLvlMin);
  const [aLvlMax, setALvlMax] = useState(initialUi.aLvlMax);
  const [aSortKey, setASortKey] = useState<AffinityKey>(initialUi.aSortKey);
  const [aSortDir, setASortDir] = useState<SortDir>(initialUi.aSortDir);

  // ---- Best-spot (pool) filters ----
  const [sGlobal, setSGlobal] = useState(initialUi.sGlobal);
  const [sFish, setSFish] = useState(initialUi.sFish);
  const [sZone, setSZone] = useState(initialUi.sZone);
  const [sArea, setSArea] = useState(initialUi.sArea);
  const [sBait, setSBait] = useState(initialUi.sBait);
  const [sKind, setSKind] = useState(initialUi.sKind);
  const [sBite, setSBite] = useState(initialUi.sBite);
  const [sMinShare, setSMinShare] = useState(initialUi.sMinShare);
  const [sSoloOnly, setSSoloOnly] = useState(initialUi.sSoloOnly);
  const [sSortKey, setSSortKey] = useState<SpotKey>(initialUi.sSortKey);
  const [sSortDir, setSSortDir] = useState<SortDir>(initialUi.sSortDir);

  // ---- Practical skill-up combinations ----
  const [uSkill, setUSkill] = useState(initialUi.uSkill);
  const [uBonusSkill, setUBonusSkill] = useState(initialUi.uBonusSkill);
  const [uSelectedRods, setUSelectedRods] = useState(initialUi.uSelectedRods);
  const [uIncludeCop, setUIncludeCop] = useState(initialUi.uIncludeCop);
  const [uIncludeToau, setUIncludeToau] = useState(initialUi.uIncludeToau);
  const [uGlobal, setUGlobal] = useState(initialUi.uGlobal);
  const [uFish, setUFish] = useState(initialUi.uFish);
  const [uZone, setUZone] = useState(initialUi.uZone);
  const [uBait, setUBait] = useState(initialUi.uBait);
  const [uMinShare, setUMinShare] = useState(initialUi.uMinShare);
  const [uSortKey, setUSortKey] = useState<SkillupKey>(initialUi.uSortKey);
  const [uSortDir, setUSortDir] = useState<SortDir>(initialUi.uSortDir);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  useEffect(() => {
    function onDocumentPointerDown(event: PointerEvent) {
      const dropdown = rodsDropdownRef.current;
      if (!dropdown || !dropdown.open) return;
      if (!dropdown.contains(event.target as Node)) {
        dropdown.open = false;
      }
    }

    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, []);

  useEffect(() => {
    saveJson(BAIT_UI_KEY, {
      mode,
      aGlobal,
      aFish,
      aBait,
      aKind,
      aBite,
      aBestOnly,
      aLvlMin,
      aLvlMax,
      aSortKey,
      aSortDir,
      sGlobal,
      sFish,
      sZone,
      sArea,
      sBait,
      sKind,
      sBite,
      sMinShare,
      sSoloOnly,
      sSortKey,
      sSortDir,
      uSkill,
      uBonusSkill,
      uSelectedRods,
      uIncludeCop,
      uIncludeToau,
      uGlobal,
      uFish,
      uZone,
      uBait,
      uMinShare,
      uSortKey,
      uSortDir,
    } satisfies BaitUiState);
  }, [
    mode,
    aGlobal,
    aFish,
    aBait,
    aKind,
    aBite,
    aBestOnly,
    aLvlMin,
    aLvlMax,
    aSortKey,
    aSortDir,
    sGlobal,
    sFish,
    sZone,
    sArea,
    sBait,
    sKind,
    sBite,
    sMinShare,
    sSoloOnly,
    sSortKey,
    sSortDir,
    uSkill,
    uBonusSkill,
    uSelectedRods,
    uIncludeCop,
    uIncludeToau,
    uGlobal,
    uFish,
    uZone,
    uBait,
    uMinShare,
    uSortKey,
    uSortDir,
  ]);

  function onAffinityHeader(key: AffinityKey) {
    if (key === aSortKey) setASortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setASortKey(key);
      setASortDir(key === "hookBonus" || key === "vendorPriceEach" || key === "best" ? "desc" : "asc");
    }
  }

  function onSpotHeader(key: SpotKey) {
    if (key === sSortKey) setSSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSSortKey(key);
      setSSortDir(key === "sharePct" || key === "hookBonus" || key === "vendorPriceEach" ? "desc" : "asc");
    }
  }

  function onSkillupHeader(key: SkillupKey) {
    if (key === uSortKey) setUSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    else {
      setUSortKey(key);
      setUSortDir(
        key === "expectedLandedGain" ||
          key === "fishLevel" ||
          key === "levelDifference" ||
          key === "skillupChancePct" ||
          key === "sharePct" ||
          key === "landPct" ||
          key === "effectiveSkill"
          ? "desc"
          : "asc"
      );
    }
  }

  function clearAffinityFilters() {
    setAGlobal("");
    setAFish("");
    setABait("");
    setAKind("");
    setABite("");
    setABestOnly(false);
    setALvlMin("");
    setALvlMax("");
  }

  function clearSpotFilters() {
    setSGlobal("");
    setSFish("");
    setSZone("");
    setSArea("");
    setSBait("");
    setSKind("");
    setSBite("");
    setSMinShare("");
    setSSoloOnly(false);
  }

  function clearSkillupFilters() {
    setUGlobal("");
    setUFish("");
    setUZone("");
    setUBait("");
    setUMinShare("");
    setUIncludeCop(true);
    setUIncludeToau(true);
    setUSortKey("expectedLandedGain");
    setUSortDir("desc");
  }

  function toggleSkillupRod(rodName: string) {
    setUSelectedRods((selected) =>
      selected.includes(rodName)
        ? selected.filter((name) => name !== rodName)
        : [...selected, rodName]
    );
  }

  /** Carry current affinity filters into the best-spot finder and switch views. */
  function findBestSpots() {
    setSFish(aFish.trim() !== "" ? aFish : aGlobal);
    setSBait(aBait);
    setSZone("");
    setSArea("");
    setSKind(aKind);
    setSBite("");
    setSGlobal("");
    setSMinShare("");
    setSSoloOnly(false);
    setSSortKey("sharePct");
    setSSortDir("desc");
    setMode("spots");
  }

  const affinityActive =
    aGlobal.trim() !== "" ||
    aFish.trim() !== "" ||
    aBait.trim() !== "" ||
    aKind !== "" ||
    aBite !== "" ||
    aBestOnly ||
    aLvlMin.trim() !== "" ||
    aLvlMax.trim() !== "";

  const spotActive =
    sGlobal.trim() !== "" ||
    sFish.trim() !== "" ||
    sZone !== "" ||
    sArea.trim() !== "" ||
    sBait.trim() !== "" ||
    sKind !== "" ||
    sBite !== "" ||
    sMinShare.trim() !== "" ||
    sSoloOnly;

  const skillupFilterActive =
    uGlobal.trim() !== "" ||
    uFish.trim() !== "" ||
    uZone !== "" ||
    uBait.trim() !== "" ||
    uMinShare.trim() !== "" ||
    !uIncludeCop ||
    !uIncludeToau;

  const affinityResults = useMemo(() => {
    const g = aGlobal.trim().toLowerCase();
    const fq = aFish.trim().toLowerCase();
    const bq = aBait.trim().toLowerCase();
    const min = aLvlMin.trim() === "" ? null : Number(aLvlMin);
    const max = aLvlMax.trim() === "" ? null : Number(aLvlMax);

    const filtered = BAIT.filter((b) => {
      if (aKind && b.kind !== aKind) return false;
      if (aBite && b.bite !== aBite) return false;
      if (aBestOnly && !b.best) return false;
      if (fq && !b.fish.toLowerCase().includes(fq)) return false;
      if (bq && !(b.bait ?? "").toLowerCase().includes(bq)) return false;
      if (min !== null && Number.isFinite(min) && (b.lvl === null || b.lvl < min)) return false;
      if (max !== null && Number.isFinite(max) && (b.lvl === null || b.lvl > max)) return false;

      if (g) {
        const hay = [
          b.fish,
          b.lvl === null ? "" : String(b.lvl),
          b.size,
          b.bait ?? "",
          b.kind ?? "",
          b.bite ?? "",
          b.hookBonus === null ? "" : String(b.hookBonus),
          b.best ? "best" : "",
          b.note ?? "",
        ]
          .join(" | ")
          .toLowerCase();
        if (!hay.includes(g)) return false;
      }
      return true;
    });

    return filtered.sort((x, y) => {
      let cmp = 0;
      if (aSortKey === "lvl" || aSortKey === "hookBonus") {
        const xv = x[aSortKey];
        const yv = y[aSortKey];
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (aSortKey === "vendorPriceEach") {
        const xv = getVendorPriceEach(x.fish);
        const yv = getVendorPriceEach(y.fish);
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (aSortKey === "best") {
        cmp = Number(x.best) - Number(y.best);
      } else {
        cmp = ((x[aSortKey] ?? "") as string).localeCompare((y[aSortKey] ?? "") as string);
      }
      return aSortDir === "asc" ? cmp : -cmp;
    });
  }, [aGlobal, aFish, aBait, aKind, aBite, aBestOnly, aLvlMin, aLvlMax, aSortKey, aSortDir]);

  const spotResults = useMemo(() => {
    const g = sGlobal.trim().toLowerCase();
    const fq = sFish.trim().toLowerCase();
    const aq = sArea.trim().toLowerCase();
    const bq = sBait.trim().toLowerCase();
    const minShare = sMinShare.trim() === "" ? null : Number(sMinShare);

    const filtered = POOLS.filter((p) => {
      if (sZone && p.zone !== sZone) return false;
      if (sKind && p.kind !== sKind) return false;
      if (sBite && p.bite !== sBite) return false;
      if (sSoloOnly && p.sharePct < 100) return false;
      if (fq && !p.fish.toLowerCase().includes(fq)) return false;
      if (aq && !p.area.toLowerCase().includes(aq)) return false;
      if (bq && !p.bait.toLowerCase().includes(bq)) return false;
      if (minShare !== null && Number.isFinite(minShare) && p.sharePct < minShare) return false;

      if (g) {
        const hay = [
          p.zone,
          p.area,
          p.fish,
          p.lvl === null ? "" : String(p.lvl),
          p.bait,
          p.kind,
          p.bite,
          `${p.sharePct}%`,
          p.competing.join(", "),
        ]
          .join(" | ")
          .toLowerCase();
        if (!hay.includes(g)) return false;
      }
      return true;
    });

    return filtered.sort((x, y) => {
      let cmp = 0;
      if (sSortKey === "lvl") {
        const xv = x.lvl;
        const yv = y.lvl;
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (sSortKey === "sharePct" || sSortKey === "hookBonus") {
        cmp = x[sSortKey] - y[sSortKey];
      } else if (sSortKey === "vendorPriceEach") {
        const xv = getVendorPriceEach(x.fish);
        const yv = getVendorPriceEach(y.fish);
        if (xv === null && yv === null) cmp = 0;
        else if (xv === null) return 1;
        else if (yv === null) return -1;
        else cmp = xv - yv;
      } else if (sSortKey === "competingCount") {
        cmp = x.competing.length - y.competing.length;
      } else {
        cmp = x[sSortKey].localeCompare(y[sSortKey]);
      }
      if (cmp === 0) {
        // Tie-break: higher share first, then higher hook bonus, then fewer competitors.
        cmp = y.sharePct - x.sharePct;
        if (cmp !== 0) return cmp;
        cmp = y.hookBonus - x.hookBonus;
        if (cmp !== 0) return cmp;
        return x.competing.length - y.competing.length;
      }
      return sSortDir === "asc" ? cmp : -cmp;
    });
  }, [sGlobal, sFish, sZone, sArea, sBait, sKind, sBite, sMinShare, sSoloOnly, sSortKey, sSortDir]);

  const skillupResults = useMemo(() => {
    const baseSkill = Number(uSkill);
    const bonusSkill = Math.max(0, Math.min(8, Math.floor(Number(uBonusSkill) || 0)));
    if (!Number.isFinite(baseSkill) || baseSkill < 0 || baseSkill > 200) return [];

    const globalQuery = uGlobal.trim().toLowerCase();
    const fishQuery = uFish.trim().toLowerCase();
    const baitQuery = uBait.trim().toLowerCase();
    const minimumShare = uMinShare.trim() === "" ? null : Number(uMinShare);

    const selectedRodNames = new Set(uSelectedRods);
    const availableRods = SKILLUP_RODS.filter((rod) => selectedRodNames.has(rod.rod));

    const rows: SkillupRow[] = [];
    for (const pool of POOLS) {
      if (pool.lvl === null) continue;
      const fish = SKILLUP_FISH_BY_NAME.get(pool.fish);
      if (!fish) continue;
      if (!uIncludeCop && COP_LOCKED_ZONES.has(pool.zone)) continue;
      if (!uIncludeToau && TOAU_LOCKED_ZONES.has(pool.zone)) continue;
      if (uZone && pool.zone !== uZone) continue;
      if (fishQuery && !pool.fish.toLowerCase().includes(fishQuery)) continue;
      if (baitQuery && !pool.bait.toLowerCase().includes(baitQuery)) continue;
      if (minimumShare !== null && Number.isFinite(minimumShare) && pool.sharePct < minimumShare) continue;

      for (const rod of availableRods) {
        const hiddenRodSkill = getRodHiddenSuccessBonus(rod.rod);
        const effectiveSkill = Math.floor(baseSkill) + bonusSkill + hiddenRodSkill;
        const skillup = calculateSkillup(baseSkill, pool.lvl, pool.zone, rod.rod);
        if (!skillup.eligible) continue;

        const risk = calculateRodRisk(effectiveSkill, fish, rod);
        const expectedResolvedGain = skillup.expectedGainPerTargetHook * (pool.sharePct / 100) * 100;
        const expectedLandedGain = expectedResolvedGain * (risk.landPct / 100);
        const candidate: SkillupRow = {
          ...pool,
          fishLevel: pool.lvl,
          levelDifference: skillup.difference,
          skillupChancePct: skillup.chancePct,
          expectedResolvedGain,
          expectedLandedGain,
          rod: rod.rod,
          effectiveSkill,
          landPct: risk.landPct,
          snapPct: risk.snapPct,
          breakPct: risk.breakPct,
          escapePct: risk.escapePct,
        };

        if (globalQuery) {
          const haystack = [
            candidate.fish,
            candidate.zone,
            candidate.area,
            candidate.bait,
            candidate.rod,
            candidate.kind,
            candidate.bite,
          ]
            .join(" | ")
            .toLowerCase();
          if (!haystack.includes(globalQuery)) continue;
        }
        rows.push(candidate);
      }
    }

    return rows.sort((a, b) => {
      let comparison = 0;
      if (
        uSortKey === "expectedLandedGain" ||
        uSortKey === "fishLevel" ||
        uSortKey === "levelDifference" ||
        uSortKey === "skillupChancePct" ||
        uSortKey === "sharePct" ||
        uSortKey === "landPct" ||
        uSortKey === "effectiveSkill"
      ) {
        comparison = a[uSortKey] - b[uSortKey];
      } else {
        comparison = a[uSortKey].localeCompare(b[uSortKey]);
      }
      if (comparison === 0) comparison = b.expectedLandedGain - a.expectedLandedGain;
      return uSortDir === "asc" ? comparison : -comparison;
    });
  }, [
    uSkill,
    uBonusSkill,
    uSelectedRods,
    uIncludeCop,
    uIncludeToau,
    uGlobal,
    uFish,
    uZone,
    uBait,
    uMinShare,
    uSortKey,
    uSortDir,
  ]);

  const skillupTop = skillupResults[0] ?? null;

  const results = mode === "affinity" ? affinityResults : mode === "spots" ? spotResults : skillupResults;
  const visibleCount = Math.min(results.length, MAX_VISIBLE_ROWS);

  const selectFilter = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options: string[],
    width = 170
  ) => (
    <div style={{ ...styles.field, width }}>
      <div style={styles.label}>{label}</div>
      <select style={styles.selectCompact} value={value} onChange={(e) => setter(e.target.value)}>
        <option value="" style={optionBaseStyle}>
          Any
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={optionBaseStyle}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  const textFilter = (
    label: string,
    value: string,
    setter: (v: string) => void,
    placeholder: string,
    width = 200
  ) => (
    <div style={{ ...styles.field, width }}>
      <div style={styles.label}>{label}</div>
      <input
        style={styles.inputCompact}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <section style={styles.card}>
      <div style={styles.titleRow}>
        <h3 style={styles.h3}>
          {mode === "affinity"
            ? "Bait Affinity (Fish × Bait)"
            : mode === "spots"
              ? "Best Fishing Spots (Pool Share)"
              : "Fishing Skill-up Planner"}
        </h3>
        <div style={styles.sub}>
          {results.length.toLocaleString()} of{" "}
          {(mode === "affinity" ? BAIT.length : POOLS.length).toLocaleString()} entries
          {results.length > MAX_VISIBLE_ROWS ? ` (showing first ${MAX_VISIBLE_ROWS} — refine filters)` : ""}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={mode === "affinity" ? styles.buttonPrimaryCompact : styles.buttonCompact}
            onClick={() => setMode("affinity")}
          >
            Bait list
          </button>
          <button
            style={mode === "spots" ? styles.buttonPrimaryCompact : styles.buttonCompact}
            onClick={() => setMode("spots")}
          >
            Best spots
          </button>
          <button
            style={mode === "skillup" ? styles.buttonPrimaryCompact : styles.buttonCompact}
            onClick={() => setMode("skillup")}
          >
            Skill-up planner
          </button>
        </div>

        {mode === "affinity" ? (
          <div style={styles.subCard}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {textFilter("Search everything", aGlobal, setAGlobal, "e.g. moat carp", 240)}
              {textFilter("Fish", aFish, setAFish, "e.g. carp")}
              {textFilter("Bait", aBait, setABait, "e.g. lugworm")}
              {selectFilter("Kind", aKind, setAKind, KINDS, 130)}
              {selectFilter("Bite", aBite, setABite, BITES, 140)}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ ...styles.field, width: 90 }}>
                <div style={styles.label}>Lvl min</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={aLvlMin}
                  onChange={(e) => setALvlMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={{ ...styles.field, width: 90 }}>
                <div style={styles.label}>Lvl max</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={aLvlMax}
                  onChange={(e) => setALvlMax(e.target.value)}
                  placeholder="120"
                />
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 32,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <input type="checkbox" checked={aBestOnly} onChange={(e) => setABestOnly(e.target.checked)} />
                Best bait only
              </label>

              <button
                style={{ ...styles.buttonCompact, ...(affinityActive ? {} : styles.buttonDisabled) }}
                onClick={clearAffinityFilters}
                disabled={!affinityActive}
              >
                Clear filters
              </button>

              <button
                style={styles.buttonPrimaryCompact}
                onClick={findBestSpots}
                title="Find the zones/areas where the filtered fish is easiest to target (fewest competing fish on the same bait)"
              >
                Find best spot →
              </button>
            </div>

            <div style={{ marginTop: 8, ...styles.sub }}>
              “Best” here = highest hook bonus for that fish. Use “Find best spot” to factor in pool competition —
              where other fish steal bites on the same bait.
            </div>
          </div>
        ) : mode === "spots" ? (
          <div style={styles.subCard}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {textFilter("Search everything", sGlobal, setSGlobal, "e.g. moat carp", 240)}
              {textFilter("Target fish", sFish, setSFish, "e.g. carp")}
              {selectFilter("Zone", sZone, setSZone, POOL_ZONES, 200)}
              {textFilter("Area", sArea, setSArea, "e.g. whole zone", 160)}
              {textFilter("Bait", sBait, setSBait, "e.g. lugworm", 160)}
              {selectFilter("Kind", sKind, setSKind, KINDS, 120)}
              {selectFilter("Bite", sBite, setSBite, POOL_BITES, 140)}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ ...styles.field, width: 120 }}>
                <div style={styles.label}>Min share %</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  value={sMinShare}
                  onChange={(e) => setSMinShare(e.target.value)}
                  placeholder="e.g. 80"
                />
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 32,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <input type="checkbox" checked={sSoloOnly} onChange={(e) => setSSoloOnly(e.target.checked)} />
                100% pools only (no competition)
              </label>

              <button
                style={{ ...styles.buttonCompact, ...(spotActive ? {} : styles.buttonDisabled) }}
                onClick={clearSpotFilters}
                disabled={!spotActive}
              >
                Clear filters
              </button>
            </div>

            <div style={{ marginTop: 8, ...styles.sub }}>
              Lists every zone/area/bait combination for each fish. Pool Share = your target&apos;s estimated share of
              bites on that bait in that spot (neutral time/moon, adequate skill).{" "}
              <span style={shareColor(100)}>100%</span> = only your target bites it there;{" "}
              <span style={shareColor(70)}>60–99%</span> = minor competition; <span style={shareColor(30)}>&lt;60%</span>{" "}
              = crowded pool. A lower-share bait can still be the practical pick if it&apos;s cheaper or easier to get
              (e.g. Meatball vs Drill Calamary for Gugrusaurus).
            </div>
          </div>
        ) : (
          <div style={styles.subCard}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ ...styles.field, width: 120 }}>
                <div style={styles.label}>Base fishing skill</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={200}
                  step={1}
                  value={uSkill}
                  onChange={(event) => setUSkill(event.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
              <div style={{ ...styles.field, width: 155 }}>
                <div style={styles.label}>Gear/support +skill (0–8)</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={8}
                  step={1}
                  value={uBonusSkill}
                  onChange={(event) => setUBonusSkill(event.target.value)}
                  placeholder="5"
                />
              </div>
              <div style={{ ...styles.field, width: 240, position: "relative" }}>
                <div style={styles.label}>Rods to compare</div>
                <details ref={rodsDropdownRef} style={{ position: "relative" }}>
                  <summary
                    style={{
                      ...styles.selectCompact,
                      boxSizing: "border-box",
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {uSelectedRods.length === 0
                      ? "No rods selected"
                      : `${uSelectedRods.length} rod${uSelectedRods.length === 1 ? "" : "s"} selected`}
                  </summary>
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 20,
                      top: "calc(100% + 4px)",
                      left: 0,
                      width: 280,
                      maxHeight: 330,
                      overflowY: "auto",
                      padding: 10,
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: 8,
                      background: "#111",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button style={styles.buttonCompact} onClick={() => setUSelectedRods(SKILLUP_ROD_NAMES)}>
                        Select all
                      </button>
                      <button style={styles.buttonCompact} onClick={() => setUSelectedRods([])}>
                        None
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {SKILLUP_RODS.map((rod) => (
                        <label
                          key={rod.rodId}
                          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}
                        >
                          <input
                            type="checkbox"
                            checked={uSelectedRods.includes(rod.rod)}
                            onChange={() => toggleSkillupRod(rod.rod)}
                          />
                          <span>{rod.rod}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", minHeight: 32 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input type="checkbox" checked={uIncludeCop} onChange={(event) => setUIncludeCop(event.target.checked)} />
                  CoP
                </label>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={uIncludeToau}
                    onChange={(event) => setUIncludeToau(event.target.checked)}
                  />
                  ToAU
                </label>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {textFilter("Search everything", uGlobal, setUGlobal, "fish, rod, zone, bait", 240)}
              {textFilter("Fish", uFish, setUFish, "e.g. carp", 170)}
              {selectFilter("Zone", uZone, setUZone, POOL_ZONES, 200)}
              {textFilter("Bait", uBait, setUBait, "e.g. lugworm", 170)}
              <div style={{ ...styles.field, width: 120 }}>
                <div style={styles.label}>Min share %</div>
                <input
                  style={styles.inputCompact}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  value={uMinShare}
                  onChange={(event) => setUMinShare(event.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
              <button
                style={{ ...styles.buttonCompact, ...(skillupFilterActive ? {} : styles.buttonDisabled) }}
                onClick={clearSkillupFilters}
                disabled={!skillupFilterActive}
              >
                Clear filters
              </button>
            </div>

            <div style={{ marginTop: 8, ...styles.sub }}>
              Ranked by expected landed skill gained per 100 resolved pool hooks: fish skill-up rate × pool share ×
              rod landing chance. Base skill alone controls eligibility and the skill-up roll. Gear/support and the
              selected bonus skill only improve success. Hidden rod success bonus is applied automatically: Lu Shang
              rods use +10, Ebisu rods use +15. City fishing receives the server&apos;s lower skill-up rate, and Lu
              Shang&apos;s under-50 skill-up penalty is applied.
            </div>

            {skillupTop ? (
              <div style={{ marginTop: 10, ...styles.sub }}>
                Best combination: <span style={{ color: "#8af6b0", fontWeight: 800 }}>{skillupTop.fish}</span> with{" "}
                <strong>{skillupTop.bait}</strong> and <strong>{skillupTop.rod}</strong> at {skillupTop.zone} /{" "}
                {skillupTop.area} — {skillupTop.expectedLandedGain.toFixed(3)} expected skill per 100 pool hooks.
              </div>
            ) : null}
          </div>
        )}

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            overflow: "auto",
            maxHeight: "62vh",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          {mode === "affinity" ? (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {AFFINITY_COLUMNS.map((col) => {
                    const active = col.key === aSortKey;
                    return (
                      <th
                        key={col.key}
                        style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                        onClick={() => onAffinityHeader(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {active ? (aSortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleCount === 0 ? (
                  <tr>
                    <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={AFFINITY_COLUMNS.length}>
                      No matches. Try clearing some filters.
                    </td>
                  </tr>
                ) : (
                  affinityResults.slice(0, MAX_VISIBLE_ROWS).map((b, i) => {
                    const rowKey = `affinity|${b.fish}|${b.bait}|${i}`;
                    const selected = selectedRowKey === rowKey;
                    return (
                    <tr
                      key={rowKey}
                      onClick={() => setSelectedRowKey(rowKey)}
                      style={{ ...clickableRowStyle, ...(selected ? selectedRowStyle : {}) }}
                      title="Click to highlight this row"
                    >
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{b.fish}</td>
                      <td style={tdStyle}>{b.lvl ?? "-"}</td>
                      <td style={tdStyle}>{b.size}</td>
                      <td style={tdStyle}>{b.bait ?? "—"}</td>
                      <td style={tdStyle}>{b.kind ?? "-"}</td>
                      <td style={tdStyle}>{b.bite ?? "-"}</td>
                      <td style={tdStyle}>{b.hookBonus !== null ? `+${b.hookBonus}` : "-"}</td>
                      <td style={tdStyle}>{formatVendorPrice(getVendorPriceEach(b.fish))}</td>
                      <td style={{ ...tdStyle, ...(b.best ? { color: "#8af6b0", fontWeight: 800 } : {}) }}>
                        {b.best ? "BEST" : ""}
                      </td>
                      <td style={{ ...tdStyle, opacity: 0.85 }}>{b.note ?? ""}</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : mode === "spots" ? (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {SPOT_COLUMNS.map((col) => {
                    const active = col.key === sSortKey;
                    return (
                      <th
                        key={col.key}
                        style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                        onClick={() => onSpotHeader(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {active ? (sSortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    );
                  })}
                  <th style={{ ...thStyle, cursor: "default" }}>Competing Fish</th>
                </tr>
              </thead>
              <tbody>
                {visibleCount === 0 ? (
                  <tr>
                    <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={SPOT_COLUMNS.length + 1}>
                      No matches. Try clearing some filters.
                    </td>
                  </tr>
                ) : (
                  spotResults.slice(0, MAX_VISIBLE_ROWS).map((p, i) => {
                    const rowKey = `spots|${p.zone}|${p.area}|${p.fish}|${p.bait}|${i}`;
                    const selected = selectedRowKey === rowKey;
                    return (
                    <tr
                      key={rowKey}
                      onClick={() => setSelectedRowKey(rowKey)}
                      style={{ ...clickableRowStyle, ...(selected ? selectedRowStyle : {}) }}
                      title="Click to highlight this row"
                    >
                      <td style={tdStyle}>{p.zone}</td>
                      <td style={tdStyle}>{p.area}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{p.fish}</td>
                      <td style={tdStyle}>{p.lvl ?? "-"}</td>
                      <td style={tdStyle}>{p.bait}</td>
                      <td style={tdStyle}>{p.kind}</td>
                      <td style={tdStyle}>{p.bite}</td>
                      <td style={tdStyle}>+{p.hookBonus}</td>
                      <td style={tdStyle}>{formatVendorPrice(getVendorPriceEach(p.fish))}</td>
                      <td style={{ ...tdStyle, ...shareColor(p.sharePct) }}>{p.sharePct}%</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{p.competing.length}</td>
                      <td style={{ ...tdStyle, opacity: 0.85, whiteSpace: "normal", minWidth: 200 }}>
                        {p.competing.length > 0 ? p.competing.join(", ") : "—"}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {SKILLUP_COLUMNS.map((column) => {
                    const active = column.key === uSortKey;
                    return (
                      <th
                        key={column.key}
                        style={{ ...thStyle, ...(active ? { color: "#8af6b0" } : {}) }}
                        onClick={() => onSkillupHeader(column.key)}
                        title={`Sort by ${column.label}`}
                      >
                        {column.label}
                        {active ? (uSortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    );
                  })}
                  <th style={{ ...thStyle, cursor: "default" }}>Risk Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleCount === 0 ? (
                  <tr>
                    <td style={{ ...tdStyle, opacity: 0.7 }} colSpan={SKILLUP_COLUMNS.length + 1}>
                      No eligible combinations. Check the base skill, rod access, or filters.
                    </td>
                  </tr>
                ) : (
                  skillupResults.slice(0, MAX_VISIBLE_ROWS).map((row, index) => {
                    const rowKey = `skillup|${row.zone}|${row.area}|${row.fish}|${row.bait}|${row.rod}|${index}`;
                    const selected = selectedRowKey === rowKey;
                    return (
                      <tr
                        key={rowKey}
                        onClick={() => setSelectedRowKey(rowKey)}
                        style={{ ...clickableRowStyle, ...(selected ? selectedRowStyle : {}) }}
                        title="Click to highlight this row"
                      >
                        <td style={{ ...tdStyle, color: "#8af6b0", fontWeight: 800 }}>
                          {row.expectedLandedGain.toFixed(3)}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{row.fish}</td>
                        <td style={tdStyle}>{row.fishLevel}</td>
                        <td style={tdStyle}>+{row.levelDifference}</td>
                        <td style={tdStyle}>{row.skillupChancePct.toFixed(1)}%</td>
                        <td style={{ ...tdStyle, ...shareColor(row.sharePct) }}>{row.sharePct}%</td>
                        <td style={tdStyle}>{row.landPct.toFixed(1)}%</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{row.rod}</td>
                        <td style={tdStyle}>{row.effectiveSkill}</td>
                        <td style={tdStyle}>{row.zone}</td>
                        <td style={tdStyle}>{row.area}</td>
                        <td style={tdStyle}>{row.bait}</td>
                        <td style={{ ...tdStyle, opacity: 0.85 }}>
                          Escape {row.escapePct}% / Snap {row.snapPct}% / Break {row.breakPct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
