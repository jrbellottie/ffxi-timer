import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import "./PriceInput.css";

type Props = { label: string; value: number | undefined; baseline: number | null; onChange: (value: number | null) => void; resetLabel?: string; quantity?: number };

export default function PriceInput({ label, value: override, baseline, onChange, resetLabel = `Reset ${label}`, quantity = 1 }: Props) {
  const display = override === undefined ? "" : String(Number((override * quantity).toFixed(4)));
  const [draft, setDraft] = useState(() => ({ display, text: display, dirty: false }));
  if (draft.display !== display) setDraft({ display, text: display, dirty: false });
  const value = draft.text === "" ? null : Number(draft.text) / quantity;
  const valid = value === null || (Number.isFinite(value) && value >= 0);
  useEffect(() => {
    if (!draft.dirty || !valid || value === (override ?? null)) return;
    const timer = setTimeout(() => onChange(value), 200);
    return () => clearTimeout(timer);
  }, [value, valid, override, onChange, draft.dirty]);
  const commit = () => { if (draft.dirty && valid && value !== (override ?? null)) onChange(value); };
  return <div className="item-price-input"><input type="number" min="0" step="any" aria-label={label} aria-invalid={!valid} value={draft.text} placeholder={baseline === null ? "Unknown" : String(Number((baseline * quantity).toFixed(4)))} onChange={(event) => setDraft({ display, text: event.target.value, dirty: true })} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} /><button type="button" disabled={override === undefined && draft.text === ""} aria-label={resetLabel} title={resetLabel} onClick={() => { setDraft({ display, text: "", dirty: false }); onChange(null); }}><RotateCcw size={14} /></button></div>;
}