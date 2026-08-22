"use client";

import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { supabase } from "@/lib/supabase/client";
import type { SeoAreaRecord } from "@/lib/types";

type Props = {
  initialAreas: SeoAreaRecord[];
  conflictAreaIds: string[];
};

function AreaRegistryRow({
  area,
  areas,
  hasConflict,
  onUpdated
}: {
  area: SeoAreaRecord;
  areas: SeoAreaRecord[];
  hasConflict: boolean;
  onUpdated: (sourceId: string, updated: SeoAreaRecord, merged: boolean) => void;
}) {
  const [state, setState] = useState(area.state);
  const [city, setCity] = useState(area.city);
  const [mergeTarget, setMergeTarget] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(body: Record<string, string>, merged: boolean) {
    setSaving(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your admin session expired. Log in again.");
      const result = await apiRequest<{ area: SeoAreaRecord; updatedListings: number }>(
        "/api/admin/seo/areas",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body)
        }
      );
      onUpdated(area.id, result.area, merged);
      setMessage(`${result.updatedListings} listing${result.updatedListings === 1 ? "" : "s"} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this area.");
    } finally {
      setSaving(false);
    }
  }

  const targets = areas.filter((candidate) => candidate.id !== area.id && candidate.state === area.state);

  return (
    <tr className="border-b border-slate-300/70 align-top">
      <td className="p-3">
        <p className="font-black text-slate-950">{area.canonicalName}</p>
        <p className="text-xs text-slate-500">/{area.slug}</p>
        {area.aliases.length ? <p className="mt-1 max-w-xs text-xs text-slate-500">Aliases: {area.aliases.join(", ")}</p> : null}
        {hasConflict ? <span className="mt-2 inline-block rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">Cross-LGA conflict</span> : null}
      </td>
      <td className="min-w-56 space-y-2 p-3">
        <select className="input py-2" value={state} onChange={(event) => {
          const nextState = event.target.value;
          setState(nextState);
          setCity(getLgasForState(nextState)[0] ?? "");
        }} disabled={saving}>
          {NIGERIA_STATES.map((item) => <option key={item} value={item}>{item === "Federal Capital Territory" ? "Abuja (FCT)" : item}</option>)}
        </select>
        <select className="input py-2" value={city} onChange={(event) => setCity(event.target.value)} disabled={saving}>
          {getLgasForState(state).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="btn-secondary w-full py-2 text-xs" type="button" disabled={saving || (state === area.state && city === area.city)} onClick={() => void submit({ action: "move", areaId: area.id, state, city }, false)}>
          Move area
        </button>
      </td>
      <td className="min-w-56 space-y-2 p-3">
        <select className="input py-2" value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)} disabled={saving}>
          <option value="">Select canonical target</option>
          {targets.map((target) => <option key={target.id} value={target.id}>{target.canonicalName} - {target.city}</option>)}
        </select>
        <button className="btn-secondary w-full py-2 text-xs" type="button" disabled={saving || !mergeTarget} onClick={() => void submit({ action: "merge", sourceAreaId: area.id, targetAreaId: mergeTarget }, true)}>
          Merge duplicate
        </button>
        {message ? <p className="text-xs font-semibold text-slate-600">{message}</p> : null}
      </td>
    </tr>
  );
}

export function SeoAreaRegistry({ initialAreas, conflictAreaIds }: Props) {
  const [areas, setAreas] = useState(initialAreas);
  const [query, setQuery] = useState("");
  const conflicts = useMemo(() => new Set(conflictAreaIds), [conflictAreaIds]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return areas;
    return areas.filter((area) => [area.canonicalName, area.slug, area.city, area.state, ...area.aliases]
      .some((value) => value.toLowerCase().includes(needle)));
  }, [areas, query]);

  function handleUpdated(sourceId: string, updated: SeoAreaRecord, merged: boolean) {
    setAreas((current) => merged
      ? current.filter((area) => area.id !== sourceId).map((area) => area.id === updated.id ? updated : area)
      : current.map((area) => area.id === sourceId ? updated : area));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">SEO location registry</h2>
          <p className="text-sm text-slate-600">New areas register automatically. Moving or merging keeps the old market URL as a permanent redirect.</p>
        </div>
        <input className="input max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search area, LGA, state, or alias" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Area</th><th className="p-3">State and LGA / Area Council</th><th className="p-3">Merge</th></tr></thead>
          <tbody>{visible.map((area) => <AreaRegistryRow key={area.id} area={area} areas={areas} hasConflict={conflicts.has(area.id)} onUpdated={handleUpdated} />)}</tbody>
        </table>
        {!visible.length ? <p className="p-5 text-sm text-slate-600">No registered area matches this search.</p> : null}
      </div>
    </section>
  );
}
