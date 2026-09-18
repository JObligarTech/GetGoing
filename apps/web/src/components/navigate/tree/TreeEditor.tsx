"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, GitFork, GitMerge, Home as HomeIcon, ListChecks, Plus, Bike, Car, Footprints, TrainFront } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  addBranch, addStop, assignTraveler, branchAt, formatClock, formatDuration, mergeAt, moveStop, removeStop, treeSections, trunkStops, updateBranch, updateStop,
  type RouteTree, type TravelMode, type TreePlan, type TreeSection, type TreeStop,
} from "@voya/core";
import { Map as TripMap } from "@/components/map/Map";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip, Dot } from "@/components/ui/primitives";
import { cx } from "@/lib/utils";
import { Avatars } from "./Avatars";
import { CompareView } from "./CompareView";
import { PlacePicker } from "./PlacePicker";
import { SegmentPanel } from "./SegmentPanel";
import type { TreeEditorProps } from "./types";

const MODE_ICON: Record<TravelMode, typeof Footprints> = { walk: Footprints, transit: TrainFront, drive: Car, cycle: Bike };
type PickerTarget = { kind: "after"; stopId: string } | { kind: "lane"; branchId: string | null } | { kind: "merge"; afterStopId: string };

function subscribeLg(cb: () => void) { const mq = window.matchMedia("(min-width: 1024px)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); }
const isLg = () => window.matchMedia("(min-width: 1024px)").matches;

/**
 * Navigation tree editor. State is the pure RouteTree from core; every edit re-plans
 * through the server (routing provider) after a short debounce. The tree itself is a
 * list of trunk stops and split sections rendered as lanes; nodes are toggle buttons,
 * the selected node's segment sheet opens as a dialog on phones and inline on desktop.
 */
export function TreeEditor({ tripId, tripName, currency, initialTree, initialPlan, places, travelers, planAction, saveAction, legModesAction }: TreeEditorProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const lg = useSyncExternalStore(subscribeLg, isLg, () => false);
  const [tree, setTree] = useState<RouteTree>(initialTree);
  const [plan, setPlan] = useState<TreePlan | null>(initialPlan);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<"tree" | "map" | "compare">("tree");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [announce, setAnnounce] = useState("");
  const [saveState, setSaveState] = useState<{ error?: string; ok?: string }>({});
  const [planning, startPlanning] = useTransition();
  const [saving, startSaving] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetId = useId();
  const placeMap = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const travelerMap = useMemo(() => new Map(travelers.map((t) => [t.id, t])), [travelers]);

  // Re-plan after edits (debounced). The first plan comes from the server page.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => startPlanning(async () => {
      const p = await planAction({ ...tree, tripId });
      if (!("error" in p)) setPlan(p);
    }), 250);
    return () => clearTimeout(t);
  }, [tree, tripId, planAction]);

  const edit = useCallback((next: RouteTree, message: string) => { setTree(next); setDirty(true); setAnnounce(message); }, []);
  const sections = useMemo(() => treeSections(tree), [tree]);
  const trunk = useMemo(() => trunkStops(tree), [tree]);
  const selectedStop = tree.stops.find((s) => s.id === selected) ?? null;
  const name = (s: TreeStop) => placeMap.get(s.placeId)?.name ?? "Stop";

  // Segment sheet: dialog on phones, inline panel on desktop.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const shouldOpen = sheetOpen && !lg && !!selectedStop;
    if (shouldOpen && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input, button")?.focus(); }
    if (!shouldOpen && d.open) d.close();
  }, [sheetOpen, lg, selectedStop]);

  const legFor = (stopId: string, branchId: string | null) => plan?.legs.find((l) => l.to.id === stopId && l.branchId === branchId) ?? null;
  const prevOf = (s: TreeStop): TreeStop | null => {
    if (s.branchId) {
      const lane = tree.stops.filter((x) => x.branchId === s.branchId).sort((a, b) => a.sortOrder - b.sortOrder);
      const i = lane.findIndex((x) => x.id === s.id);
      return i > 0 ? lane[i - 1]! : tree.stops.find((x) => x.id === tree.branches.find((b) => b.id === s.branchId)?.splitAfterStopId) ?? null;
    }
    const i = trunk.findIndex((x) => x.id === s.id);
    if (i <= 0) return null;
    // A merge stop is reached from the lanes, not from the previous trunk stop.
    return tree.branches.some((b) => b.splitAfterStopId === trunk[i - 1]!.id) ? null : trunk[i - 1]!;
  };
  const laneOf = (s: TreeStop) => tree.stops.filter((x) => x.branchId === s.branchId).sort((a, b) => a.sortOrder - b.sortOrder);

  const select = (s: TreeStop) => { setSelected(s.id); setSheetOpen(true); };
  const onBranch = () => {
    const s = selectedStop ?? trunk[0];
    if (!s || s.branchId !== null) return;
    const next = branchAt(tree, s.id, travelers);
    const names = next.branches.filter((b) => b.splitAfterStopId === s.id).map((b) => b.name);
    edit(next, `Branched after ${name(s)} into ${names.join(" and ")}. Assign travelers from a branch stop.`);
    setView("tree");
  };
  const onMerge = () => {
    const s = selectedStop && selectedStop.branchId === null ? selectedStop : trunk.find((t) => tree.branches.some((b) => b.splitAfterStopId === t.id));
    if (!s) return;
    setPicker({ kind: "merge", afterStopId: s.id });
  };
  const onPick = (placeId: string) => {
    if (!picker) return;
    const p = placeMap.get(placeId)!;
    let next = tree;
    if (picker.kind === "merge") { next = mergeAt(tree, picker.afterStopId, placeId); edit(next, `Everyone meets at ${p.name}.`); }
    else if (picker.kind === "after") { next = addStop(tree, placeId, { afterStopId: picker.stopId }); edit(next, `Added ${p.name}.`); }
    else { next = addStop(tree, placeId, { branchId: picker.branchId }); edit(next, `Added ${p.name}${picker.branchId ? ` to ${tree.branches.find((b) => b.id === picker.branchId)?.name}` : ""}.`); }
    setPicker(null);
  };
  const applyAlternative = (branchId: string, legIndex: number, mode: "walk" | "drive") => {
    const lane = tree.stops.filter((s) => s.branchId === branchId).sort((a, b) => a.sortOrder - b.sortOrder);
    const target = lane[legIndex];
    const b = tree.branches.find((x) => x.id === branchId)!;
    const next = target ? updateStop(tree, target.id, { mode }) : updateBranch(tree, branchId, { mergeMode: mode });
    edit(next, `${b.name} now ${mode === "walk" ? "walks" : "drives"} that segment.`);
  };
  const save = () => startSaving(async () => {
    setSaveState({});
    const r = await saveAction({ ...tree, tripId });
    if ("error" in r) { setSaveState({ error: r.error }); return; }
    setDirty(false);
    setSaveState({ ok: `Saved "${tree.name}".` });
    if (tree.routeId !== r.routeId) { setTree((t) => ({ ...t, routeId: r.routeId })); router.replace(`/navigate/tree?route=${r.routeId}` as Route); }
  });

  const meetFor = (s: TreeStop | null) => {
    if (!s) return null;
    const branchId = s.branchId ?? tree.branches.find((b) => b.splitAfterStopId === s.id)?.id ?? null;
    const sec = sections.find((x): x is Extract<TreeSection, { kind: "split" }> => x.kind === "split" && x.lanes.some((l) => l.branch.id === branchId));
    return sec?.to ?? null;
  };
  const firstSplit = sections.find((x): x is Extract<TreeSection, { kind: "split" }> => x.kind === "split") ?? null;
  const mapPins = useMemo(() => tree.stops.map((s) => { const p = placeMap.get(s.placeId); const b = tree.branches.find((x) => x.id === s.branchId); return p ? { id: s.id, lat: p.lat, lng: p.lng, label: p.isHotel ? "Hotel" : p.name, color: b?.color ?? p.color, dark: p.isHotel } : null; }).filter((x): x is NonNullable<typeof x> => !!x), [tree, placeMap]);
  const mapPaths = useMemo(() => (plan?.legs ?? []).map((l) => ({ points: l.route.geometry, color: tree.branches.find((b) => b.id === l.branchId)?.color ?? "#2F5D3A" })), [plan, tree.branches]);

  // ─── Rendering helpers ────────────────────────────────────────────────────
  const modePill = (stopId: string, branchId: string | null, color: string) => {
    const leg = legFor(stopId, branchId);
    const Icon = MODE_ICON[leg?.mode ?? tree.mode];
    return (
      <div aria-hidden="true" className="flex h-14 flex-col items-center justify-center gap-1">
        <span className="w-0.5 flex-1" style={{ background: color }} />
        <span className="flex h-6 items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-[11px] font-bold"><Icon size={12} style={{ color }} />{leg ? `${leg.mode === "transit" ? "Train" : leg.mode[0]!.toUpperCase() + leg.mode.slice(1)} · ${formatDuration(leg.route.durationSec)}` : "…"}</span>
        <span className="w-0.5 flex-1" style={{ background: color }} />
      </div>
    );
  };
  const node = (s: TreeStop, opts: { lane?: { color: string; index: number } }) => {
    const p = placeMap.get(s.placeId);
    const t = plan?.times[s.id];
    const isFirst = trunk[0]?.id === s.id;
    const isLast = trunk.at(-1)?.id === s.id && trunk.length > 1;
    const on = selected === s.id;
    const subtitle = isFirst ? `Everyone · leave ${t ? formatClock(t.leave) : "—"}` : s.branchId ? `${t?.arrive ? `Arrive ${formatClock(t.arrive)}` : "…"}${s.dwellMin ? ` · ${formatDuration(s.dwellMin * 60)} there` : ""}` : `Everyone meets · ${t?.arrive ? formatClock(s.plannedTime && s.plannedTime > t.arrive ? s.plannedTime : t.arrive) : "—"}`;
    const dark = !s.branchId && !isFirst;
    const legText = legFor(s.id, s.branchId);
    return (
      <motion.button
        key={s.id}
        type="button"
        layout={reduce ? false : "position"}
        onClick={() => select(s)}
        aria-pressed={on}
        aria-label={`${p?.name ?? "Stop"}: ${subtitle}${legText ? ` · by ${legText.mode}, ${formatDuration(legText.route.durationSec)}` : ""}`}
        className={cx("flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[box-shadow,border-color] duration-(--dur-fast)", dark ? "border-transparent bg-button-ink text-on-button-ink" : "border-line bg-surface", on && "ring-2 ring-primary ring-offset-2 ring-offset-canvas")}
        style={opts.lane && on ? { borderColor: opts.lane.color } : undefined}
      >
        {p?.isHotel && !s.branchId ? (
          <span aria-hidden="true" className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md", dark ? "bg-white/15" : "bg-button-ink text-on-button-ink")}><HomeIcon size={15} /></span>
        ) : (
          <Dot color={opts.lane?.color ?? p?.color ?? "#2F5D3A"} size={s.branchId ? 8 : 10} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{p?.name}</span>
          <span className={cx("block truncate text-[11.5px]", dark ? "text-on-button-ink/80" : "text-muted")}>{subtitle}</span>
        </span>
        {(isFirst || isLast || (!s.branchId && !isFirst)) && <Avatars travelers={travelers} ring={dark ? "#1B211C" : "var(--c-surface)"} />}
      </motion.button>
    );
  };
  const connector = (colors: string[], direction: "split" | "merge") => {
    const n = colors.length;
    return (
      <svg aria-hidden="true" viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full">
        {colors.map((c, i) => {
          const x = ((i + 0.5) * 100) / n;
          const d = direction === "split" ? `M50 0 V10 C50 20 ${x} 20 ${x} 30 V40` : `M${x} 0 V10 C${x} 20 50 20 50 30 V40`;
          return <path key={i} d={d} fill="none" stroke={c} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
        })}
        <circle cx={50} cy={direction === "split" ? 8 : 32} r={4} fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };

  const treeView = (
    <LayoutGroup>
      <ol aria-label="Route tree" className="flex flex-col items-stretch">
        {sections.map((sec, idx) => {
          if (sec.kind === "stop") {
            const prevSec = sections[idx - 1];
            return (
              <li key={sec.stop.id} className="flex flex-col items-center">
                {idx > 0 && prevSec?.kind === "stop" && modePill(sec.stop.id, null, "var(--c-primary)")}
                <div className="w-full max-w-[300px]">{node(sec.stop, {})}</div>
              </li>
            );
          }
          const colors = sec.lanes.map((l) => l.branch.color);
          return (
            <li key={`split-${sec.from.id}`} className="flex flex-col">
              {connector(colors, "split")}
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${sec.lanes.length}, minmax(0, 1fr))` }}>
                {sec.lanes.map((lane, li) => {
                  const people = travelers.filter((t) => lane.branch.travelerIds.includes(t.id)); // trip order, like the avatars
                  return (
                    <section key={lane.branch.id} aria-label={`${lane.branch.name}: ${people.length ? people.map((t) => t.name.split(" ")[0]).join(", ") : "no travelers yet"}`} className="flex min-w-0 flex-col items-center">
                      <span className="mb-2 inline-flex h-[26px] items-center gap-1.5 rounded-pill bg-tint px-2.5 text-[11.5px] font-extrabold uppercase text-on-tint" style={{ boxShadow: `inset 0 0 0 1.5px ${lane.branch.color}` }}>
                        <Dot color={lane.branch.color} size={8} />{lane.branch.name}<Avatars travelers={people} size={18} ring="var(--c-surface-tint)" />
                      </span>
                      <ol aria-label={`${lane.branch.name} stops`} className="flex w-full flex-col items-stretch">
                        {lane.stops.map((s, si) => (
                          <li key={s.id} className="flex flex-col items-center">
                            {modePill(s.id, lane.branch.id, lane.branch.color)}
                            <div className="w-full">{node(s, { lane: { color: lane.branch.color, index: si } })}</div>
                          </li>
                        ))}
                      </ol>
                      <div className="flex h-10 flex-col items-center" aria-hidden="true"><span className="w-0.5 flex-1" style={{ background: lane.branch.color }} /></div>
                      <button type="button" onClick={() => setPicker({ kind: "lane", branchId: lane.branch.id })} aria-label={`Add stop to ${lane.branch.name}`} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-strong px-2 text-[12.5px] font-bold text-muted hover:bg-tint/60">
                        <Plus size={14} aria-hidden="true" />Add stop
                      </button>
                      {li === sec.lanes.length - 1 && sec.lanes.length < 4 && (
                        <button type="button" onClick={() => edit(addBranch(tree, sec.from.id), "Added a branch.")} className="mt-2 text-[12px] font-bold text-primary underline-offset-2 hover:underline">+ another group</button>
                      )}
                    </section>
                  );
                })}
              </div>
              {sec.to ? connector(colors, "merge") : (
                <div className="mt-2 flex justify-center">
                  <Button variant="secondary" size="sm" icon={<GitMerge size={16} />} onClick={() => setPicker({ kind: "merge", afterStopId: sec.from.id })}>Meet again at…</Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </LayoutGroup>
  );

  const canBranch = !!selectedStop && selectedStop.branchId === null && selectedStop.id !== trunk.at(-1)?.id;
  const canMerge = tree.branches.length > 0 && (!selectedStop || selectedStop.branchId === null);
  const panelProps = selectedStop && {
    tree, plan, stop: selectedStop, from: prevOf(selectedStop), places: placeMap, travelers, tripId, legModesAction,
    onToggleTraveler: (branchId: string, tid: string, on: boolean) => edit(assignTraveler(tree, branchId, tid, on), `${travelerMap.get(tid)?.name.split(" ")[0]} ${on ? "joins" : "leaves"} ${tree.branches.find((b) => b.id === branchId)?.name}.`),
    onMode: (m: TravelMode | null, forBranchId?: string) => edit(forBranchId ? updateBranch(tree, forBranchId, { mergeMode: m }) : updateStop(tree, selectedStop.id, { mode: m }), `Mode set to ${m ?? "default"}.`),
    onPatch: (patch: { plannedTime?: string | null; dwellMin?: number | null }) => edit(updateStop(tree, selectedStop.id, patch), ""),
    onMove: (delta: -1 | 1) => { const lane = laneOf(selectedStop); const i = lane.findIndex((x) => x.id === selectedStop.id); edit(moveStop(tree, selectedStop.id, delta), `${name(selectedStop)} moved to stop ${i + delta + 1} of ${lane.length}`); },
    onRemove: () => { edit(removeStop(tree, selectedStop.id), `Removed ${name(selectedStop)}.`); setSelected(null); setSheetOpen(false); },
    onDone: () => setSheetOpen(false),
    canMove: (() => { const lane = laneOf(selectedStop); const i = lane.findIndex((x) => x.id === selectedStop.id); return { up: i > 0, down: i < lane.length - 1 }; })(),
  };

  const editorColumn = (
    <div className="flex flex-col gap-3.5">
      <header className="flex items-center gap-2">
        <Button href="/navigate" variant="secondary" size="sm" aria-label="Back to Navigate" icon={<ArrowLeft size={18} />}><span className="sr-only">Back</span></Button>
        <div className="min-w-0 flex-1">
          <h1 className="sr-only">Tree route: {tree.name}</h1>
          <p className="text-[13px] font-medium text-muted">{tripName} · Tree route{tree.day ? ` · ${tree.day}` : ""}</p>
          <label className="block">
            <span className="sr-only">Route name</span>
            <input value={tree.name} onChange={(e) => edit({ ...tree, name: e.target.value }, "")} maxLength={120} className="w-full truncate rounded-sm bg-transparent text-[20px] font-extrabold tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
        </div>
        <SegmentedControl label="View" size="sm" value={lg && view === "map" ? "tree" : view} onChange={(v) => setView(v)} options={lg ? [{ value: "tree", label: "Tree" }, { value: "compare", label: "Compare" }] : [{ value: "tree", label: "Tree" }, { value: "map", label: "Map" }, { value: "compare", label: "Compare" }]} />
      </header>
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
      {plan?.endsAt && <p className="text-[12.5px] text-muted">{planning ? "Re-routing…" : `Everyone back together by ${formatClock(plan.endsAt)}${plan.estimated ? " · times are estimates" : ""}`}</p>}

      {view === "compare" ? (
        <CompareView tree={tree} plan={plan} places={placeMap} travelers={travelers} currency={currency} meet={meetFor(selectedStop) ?? firstSplit?.to ?? null} onApplyAlternative={applyAlternative} />
      ) : view === "map" && !lg ? (
        <div className="relative h-[60dvh] overflow-hidden rounded-2xl border border-line">
          <TripMap center={{ lat: 35.672, lng: 139.702 }} zoom={13} pins={mapPins} paths={mapPaths} label={`Map of ${tree.name}: ${tree.stops.map((s) => name(s)).join(", ")}`} className="absolute inset-0" />
        </div>
      ) : (
        <div className="px-1 pt-1">{treeView}</div>
      )}

      {lg && selectedStop && panelProps && view === "tree" && (
        <section aria-label="Selected segment" className="card p-4">
          <SegmentPanel {...panelProps} />
        </section>
      )}

      <div role="toolbar" aria-label="Edit tree" className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 -mx-4 grid grid-cols-4 gap-2 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:-mx-7 md:px-7 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <Button variant="secondary" icon={<GitFork size={16} />} onClick={onBranch} disabled={!canBranch} aria-describedby={`${sheetId}-branch-hint`} className="min-w-0 px-2">Branch</Button>
        <Button variant="secondary" icon={<GitMerge size={16} />} onClick={onMerge} disabled={!canMerge} className="min-w-0 px-2">Merge</Button>
        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setPicker(selectedStop ? { kind: "after", stopId: selectedStop.id } : { kind: "lane", branchId: null })} aria-label="Add stop" className="min-w-0 px-2">Add</Button>
        <Button icon={<ListChecks size={16} />} onClick={() => setView(view === "compare" ? "tree" : "compare")} aria-pressed={view === "compare"} className="min-w-0 px-2">Compare</Button>
      </div>
      <p id={`${sheetId}-branch-hint`} className="sr-only">Select a shared stop first; the groups split after it.</p>

      <div className="card flex flex-col gap-2 p-3.5">
        {saveState.error && <p role="alert" className="text-[13px] font-semibold text-danger">{saveState.error}</p>}
        {saveState.ok && <p role="status" className="text-[13px] font-semibold text-primary">{saveState.ok}</p>}
        <div className="flex items-center gap-2">
          <Button size="cta" full onClick={save} loading={saving} disabled={!dirty && !!tree.routeId}>{tree.routeId ? "Save changes" : "Save tree route"}</Button>
          {dirty && <Chip tone="plain">Unsaved</Chip>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[520px_1fr] lg:overflow-hidden">
      <div className="px-4 pt-3.5 pb-6 md:px-7 lg:overflow-y-auto lg:pt-7">{editorColumn}</div>
      <div className="relative hidden lg:block">
        <TripMap center={{ lat: 35.672, lng: 139.702 }} zoom={13} pins={mapPins} paths={mapPaths} label={`Map of ${tree.name}: ${tree.stops.map((s) => name(s)).join(", ")}`} className="absolute inset-0" />
        {plan && plan.lanes.length > 0 && (
          <ul aria-label="Lane travel times" className="raised absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg px-3 py-2 text-[12px] font-bold">
            {plan.lanes.map((l) => <li key={l.branch.id} className="flex items-center gap-2"><Dot color={l.branch.color} size={8} />{l.branch.name} · {formatDuration(l.travelSec)}</li>)}
          </ul>
        )}
      </div>

      <dialog ref={dialogRef} onClose={() => setSheetOpen(false)} aria-labelledby={`${sheetId}-title`} className="m-auto w-[min(94vw,480px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
        <div className="max-h-[85dvh] overflow-y-auto p-4">
          <span id={`${sheetId}-title`} className="sr-only">Segment</span>
          {!lg && panelProps && <SegmentPanel {...panelProps} />}
        </div>
      </dialog>
      <PlacePicker open={!!picker} title={picker?.kind === "merge" ? "Where does everyone meet?" : "Add a stop"} places={places} onPick={onPick} onClose={() => setPicker(null)} />
    </div>
  );
}
