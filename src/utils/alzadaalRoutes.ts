export type RuinsNode = {
  id: string;
  mapNo: number;
  name: string;
  neighbors: string[];
  zone?: string;
};

export const RUINS_NODES: RuinsNode[] = [
  { id: "F", mapNo: 7, name: "Bhaflau Thickets (Al Zahbi entrance)", neighbors: ["A"] },
  { id: "A", mapNo: 10, name: "Bhaflau Remnants", neighbors: ["F", "E"] },
  { id: "E", mapNo: 8, name: "Main floor / Nyzul Isle Staging Point", neighbors: ["A", "B", "C", "D"] },
  { id: "B", mapNo: 12, name: "Zhayolm Remnants", neighbors: ["E", "G"] },
  { id: "G", mapNo: 5, name: "Bhaflau Thickets (merit camp)", neighbors: ["B"] },
  { id: "C", mapNo: 9, name: "Arrapago Remnants", neighbors: ["E", "H"] },
  { id: "H", mapNo: 4, name: "Caedarva Mire (Dvucca Isle)", neighbors: ["C", "dvucca"] },
  { id: "D", mapNo: 11, name: "Silver Sea Remnants", neighbors: ["E", "J"] },
  { id: "J", mapNo: 6, name: "Caedarva Mire (Khimaira)", neighbors: ["D", "K"] },
  { id: "K", mapNo: 3, name: "Caedarva Mire (Azouph Isle)", neighbors: ["J", "L"] },
  { id: "L", mapNo: 2, name: "Mount Zhayolm (behind gate)", neighbors: ["K"] },
  { id: "passage", mapNo: 1, name: "Nashmau / Dvucca Isle Staging Point passage", neighbors: ["dvucca"] },
  { id: "dvucca", mapNo: 2, zone: "Caedarva Mire", name: "Dvucca Isle (outside)", neighbors: ["passage", "H"] },
];

export type RouteMap = { zone: string; mapNo: number; point?: [number, number] };
export type RouteEndpoint = {
  id: string;
  node: string;
  label: string;
  group: "Zone exits" | "Staging points" | "Remnants";
  outside?: RouteMap;
  arrival: string;
};

export const ROUTE_ENDPOINTS: RouteEndpoint[] = [
  { id: "alzahbi", node: "F", label: "Bhaflau Thickets (Al Zahbi)", group: "Zone exits", outside: { zone: "Bhaflau Thickets", mapNo: 1, point: [203, 188] }, arrival: "Exit to Bhaflau Thickets, then head southeast toward Al Zahbi." },
  { id: "merit", node: "G", label: "Bhaflau Thickets (merit camp / Tandjana Islet)", group: "Zone exits", outside: { zone: "Bhaflau Thickets", mapNo: 2, point: [206, 169] }, arrival: "Exit to Tandjana Islet in Bhaflau Thickets for the merit camp." },
  { id: "khimaira", node: "J", label: "Caedarva Mire (Khimaira / Hediva Isle)", group: "Zone exits", outside: { zone: "Caedarva Mire", mapNo: 4, point: [252, 289] }, arrival: "Exit north to Hediva Isle in Caedarva Mire for Khimaira." },
  { id: "azouph", node: "K", label: "Caedarva Mire (Azouph Isle / Deadmist Marsh)", group: "Zone exits", outside: { zone: "Caedarva Mire", mapNo: 1, point: [322, 332] }, arrival: "Exit to Deadmist Marsh in the Azouph Isle area of Caedarva Mire." },
  { id: "dvucca", node: "dvucca", label: "Caedarva Mire (Dvucca Isle)", group: "Zone exits", arrival: "Dvucca Isle in Caedarva Mire, outside Alzadaal map 4." },
  { id: "zhayolm", node: "L", label: "Mount Zhayolm (behind gate)", group: "Zone exits", outside: { zone: "Mount Zhayolm", mapNo: 1, point: [222, 193] }, arrival: "Exit to Mount Zhayolm, behind the gate." },
  { id: "nashmau", node: "passage", label: "Caedarva Mire (Nashmau / near Hazhalm)", group: "Zone exits", outside: { zone: "Caedarva Mire", mapNo: 1, point: [160, 350] }, arrival: "Take the passage's internal pad to the southeastern chamber, then exit toward Nashmau, near Hazhalm Testing Grounds." },
  { id: "nyzul", node: "E", label: "Nyzul Isle Staging Point (main floor)", group: "Staging points", arrival: "The Nyzul Isle Staging Point runic portals are on the east side of the main floor." },
  { id: "dvucca-staging", node: "dvucca", label: "Dvucca Isle Staging Point", group: "Staging points", arrival: "Walk to the Dvucca Isle Staging Point on this outside map." },
  { id: "bhaflau", node: "A", label: "Bhaflau Remnants", group: "Remnants", arrival: "Follow the north exit to Bhaflau Remnants." },
  { id: "zhayolm-remnants", node: "B", label: "Zhayolm Remnants", group: "Remnants", arrival: "Follow the north exit to Zhayolm Remnants." },
  { id: "arrapago", node: "C", label: "Arrapago Remnants", group: "Remnants", arrival: "Follow the south exit to Arrapago Remnants." },
  { id: "silver-sea", node: "D", label: "Silver Sea Remnants", group: "Remnants", arrival: "Follow the south exit to Silver Sea Remnants." },
];

const PORTALS: Record<string, Record<string, [number, number]>> = {
  F: { A: [267, 244] },
  A: { F: [266, 278], E: [248, 278] },
  E: { A: [257, 305], B: [225, 292], C: [216, 252], D: [259, 253] },
  B: { E: [266, 277], G: [248, 277] },
  G: { B: [248, 244] },
  C: { E: [264, 237], H: [247, 237] },
  H: { C: [246, 245] },
  D: { E: [248, 238], J: [267, 238] },
  J: { D: [268, 269], K: [244, 269] },
  K: { J: [268, 269], L: [244, 269] },
  L: { K: [246, 246] },
};

const RUINS_ZONE = "Alzadaal Undersea Ruins";

export function nodeMap(node: RuinsNode, point?: [number, number]): RouteMap {
  return { zone: node.zone ?? RUINS_ZONE, mapNo: node.mapNo, point };
}

export function nodeLabel(node: RuinsNode): string {
  if (node.id === "dvucca") return "Caedarva Mire - Dvucca Isle";
  return `Map ${node.mapNo}${node.id === "passage" ? " (passage)" : ` (${node.id})`}`;
}

export type RouteStep = {
  kind: "entry" | "teleport" | "walk" | "arrival";
  title: string;
  detail: string;
  map: RouteMap;
  nextMap?: RouteMap;
};

export function findRuinsRoute(start: string, end: string): RuinsNode[] | null {
  const nodes = new Map(RUINS_NODES.map(node => [node.id, node]));
  if (!nodes.has(start) || !nodes.has(end)) return null;
  const queue: string[][] = [[start]];
  const visited = new Set([start]);
  for (let index = 0; index < queue.length; index++) {
    const path = queue[index];
    const current = path[path.length - 1];
    if (current === end) return path.map(id => nodes.get(id)!);
    for (const neighbor of nodes.get(current)!.neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
  return null;
}

export function buildRuinsJourney(startId: string, endId: string): { path: RuinsNode[]; steps: RouteStep[] } | null {
  const start = ROUTE_ENDPOINTS.find(endpoint => endpoint.id === startId);
  const end = ROUTE_ENDPOINTS.find(endpoint => endpoint.id === endId);
  if (!start || !end) return null;
  const path = findRuinsRoute(start.node, end.node);
  if (!path) return null;
  if (start.id === end.id) {
    return { path, steps: [{ kind: "arrival", title: "Already at your destination", detail: end.label, map: end.outside ?? nodeMap(path[0]) }] };
  }
  const steps: RouteStep[] = [];
  if (start.outside) {
    steps.push({
      kind: "entry", title: `Enter Alzadaal: ${nodeLabel(path[0])}`,
      detail: `From ${start.label}, enter the ruins at the marked connection.`,
      map: start.outside, nextMap: nodeMap(path[0]),
    });
  }
  for (let index = 0; index < path.length - 1; index++) {
    const current = path[index];
    const next = path[index + 1];
    const portal = PORTALS[current.id]?.[next.id];
    if (portal) {
      steps.push({ kind: "teleport", title: `Take teleporter ${next.id}`, detail: `${nodeLabel(current)} to ${nodeLabel(next)}: ${next.name}.`, map: nodeMap(current, portal), nextMap: nodeMap(next) });
    } else if (current.id === "dvucca") {
      const toPassage = next.id === "passage";
      steps.push({
        kind: "walk", title: `Walk outside to ${nodeLabel(next)}`,
        detail: `On Dvucca Isle, walk to the Alzadaal entrance marked ${toPassage ? "2 (east)" : "1 (south)"} on the outside map. This is an outdoor connection, not a lettered teleporter.`,
        map: nodeMap(current, toPassage ? [287, 327] : [234, 336]), nextMap: nodeMap(next),
      });
    } else {
      const fromPassage = current.id === "passage";
      steps.push({
        kind: "walk", title: "Exit to Dvucca Isle",
        detail: fromPassage ? "Use the passage's internal pad to reach the northwestern chamber, then take the exit near Dvucca Isle Staging Point." : "Leave map 4 through the Caedarva Mire (Dvucca Isle) exit.",
        map: nodeMap(current, fromPassage ? [296, 280] : [272, 233]), nextMap: nodeMap(next, fromPassage ? [287, 327] : [234, 336]),
      });
    }
  }
  const final = path[path.length - 1];
  const destinationPoints: Record<string, [number, number]> = {
    nyzul: [338, 282], "dvucca-staging": [316, 280], bhaflau: [257, 197],
    "zhayolm-remnants": [257, 216], arrapago: [257, 308], "silver-sea": [256, 300],
    alzahbi: [208, 273], merit: [274, 280], khimaira: [287, 224],
    azouph: [224, 218], dvucca: [234, 336], zhayolm: [241, 321], nashmau: [237, 215],
  };
  steps.push({ kind: "arrival", title: end.label, detail: end.arrival, map: nodeMap(final, destinationPoints[end.id]), nextMap: end.outside });
  return { path, steps };
}