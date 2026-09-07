import { useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export default function HelmGatheringMap({ map }: { map: { name: string; file: string; width: number; height: number } }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  return <figure className="helm-gathering-map">
    <div className="helm-map-toolbar">
      <figcaption>{map.name}</figcaption>
      <div className="helm-map-zoom" role="group" aria-label="Map zoom">
        <button type="button" className="helm-reset" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(current => Math.max(1, current - 0.5))}><ZoomOut size={16} />Zoom out</button>
        <output aria-live="polite">{zoom * 100}%</output>
        <button type="button" className="helm-reset" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(current => Math.min(3, current + 0.5))}><ZoomIn size={16} />Zoom in</button>
        <button type="button" className="helm-reset" title="Reset map zoom to 100%" aria-label="Reset map zoom" disabled={zoom === 1} onClick={() => setZoom(1)}><RotateCcw size={16} />Reset zoom</button>
      </div>
    </div>
    {failed ? <p className="helm-warning" role="status">Gathering map unavailable.</p> : <div className="helm-map-viewport" tabIndex={0} role="region" aria-label={`${map.name} map`}>
      <div style={{ width: `${zoom * 100}%` }}>
        <img src={map.file} alt={`${map.name} gathering points from FFXIclopedia`} width={map.width} height={map.height} onError={() => setFailed(true)} />
      </div>
    </div>}
  </figure>;
}