import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports = {};
const source = readFileSync(new URL("../src/utils/alzadaalRoutes.ts", import.meta.url), "utf8");
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { RUINS_NODES, ROUTE_ENDPOINTS, findRuinsRoute, buildRuinsJourney } = exports;

test("requested journeys follow the marked teleport destinations in both directions", () => {
  for (const expected of ["FAEBG", "KJDEBG", "GBEDJ", "HCEAF", "LKJDE", "AEC", "AEB", "AED"]) {
    const route = findRuinsRoute(expected[0], expected.at(-1));
    assert.equal(route.map(node => node.id).join(""), expected);
    assert.equal(findRuinsRoute(expected.at(-1), expected[0]).map(node => node.id).join(""), [...expected].reverse().join(""));
  }
});

test("all network links are reciprocal and resolve to bundled maps", () => {
  const { maps } = JSON.parse(readFileSync(new URL("../src/data/maps.json", import.meta.url), "utf8"));
  for (const node of RUINS_NODES) {
    assert.ok(maps.some(map => map.zone === (node.zone ?? "Alzadaal Undersea Ruins") && map.mapNo === node.mapNo));
    for (const neighbor of node.neighbors) {
      assert.ok(RUINS_NODES.find(candidate => candidate.id === neighbor)?.neighbors.includes(node.id));
    }
  }
});

test("same-floor routes, unknown endpoints and map 1's outdoor connection", () => {
  assert.equal(findRuinsRoute("E", "E").length, 1);
  assert.equal(findRuinsRoute("passage", "passage")[0].mapNo, 1);
  assert.equal(findRuinsRoute("passage", "E").map(node => node.id).join(","), "passage,dvucca,H,C,E");
  assert.equal(findRuinsRoute("E", "unknown"), null);
});

test("journeys show departure letters and both outside maps", () => {
  const journey = buildRuinsJourney("alzahbi", "merit");
  assert.equal(journey.steps[0].map.zone, "Bhaflau Thickets");
  assert.equal(journey.steps[0].map.mapNo, 1);
  assert.equal(journey.steps.filter(step => step.kind === "teleport").map(step => step.title).join(","), "Take teleporter A,Take teleporter E,Take teleporter B,Take teleporter G");
  assert.equal(journey.steps.at(-1).nextMap.mapNo, 2);
  assert.equal(buildRuinsJourney("khimaira", "khimaira").steps.length, 1);
  assert.equal(buildRuinsJourney("bad", "merit"), null);
});

test("map 1 journeys explicitly leave the ruins; staging point routes stop outside", () => {
  const journey = buildRuinsJourney("nashmau", "nyzul");
  assert.equal(journey.steps.filter(step => step.kind === "walk").length, 2);
  assert.equal(journey.steps.filter(step => step.kind === "teleport").map(step => step.title).join(","), "Take teleporter C,Take teleporter E");
  const staging = buildRuinsJourney("nashmau", "dvucca-staging");
  assert.equal(staging.steps.at(-1).map.zone, "Caedarva Mire");
  assert.equal(staging.steps.filter(step => step.kind === "teleport").length, 0);
  for (const [start, end] of [["dvucca", "dvucca-staging"], ["dvucca-staging", "dvucca"]]) {
    const outside = buildRuinsJourney(start, end);
    assert.equal(outside.steps.length, 1);
    assert.equal(outside.steps[0].map.zone, "Caedarva Mire");
  }
});

test("every endpoint pair has a journey with valid map assets and portal markers", () => {
  const { maps } = JSON.parse(readFileSync(new URL("../src/data/maps.json", import.meta.url), "utf8"));
  for (const start of ROUTE_ENDPOINTS) {
    for (const end of ROUTE_ENDPOINTS) {
      const journey = buildRuinsJourney(start.id, end.id);
      assert.ok(journey?.steps.length, `${start.id} to ${end.id}`);
      for (const step of journey.steps) {
        if (step.kind === "teleport") assert.ok(step.map.point);
        for (const reference of [step.map, step.nextMap].filter(Boolean)) {
          const map = maps.find(map => map.zone === reference.zone && map.mapNo === reference.mapNo);
          assert.ok(map, `${reference.zone} map ${reference.mapNo}`);
          assert.ok(readFileSync(new URL(`../public/${map.file}`, import.meta.url)).length);
          if (reference.point) assert.ok(reference.point.every(value => value >= 0 && value <= 512));
        }
      }
    }
  }
});