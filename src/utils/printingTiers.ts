import { HQ_GAPS, type PrintRecipe } from "./printing";
import type { createPrintingChain } from "./printingChain";

export const PRINT_SKILL_CAP = 106;
type Chain = ReturnType<typeof createPrintingChain>;
type Estimate = ReturnType<Chain["estimate"]>;
const comparisons = new WeakMap<Chain, Map<PrintRecipe, Estimate[]>>();

export function reachablePrintTiers(recipe: PrintRecipe): number[] {
  return HQ_GAPS.flatMap((gap, tier) => [recipe.lvl, ...(recipe.subs ?? []).map((sub) => sub.l)].every((cap) => cap + gap <= PRINT_SKILL_CAP) ? [tier] : []);
}

export function printTierComparisons(chain: Chain, recipe: PrintRecipe): Estimate[] {
  let recipes = comparisons.get(chain);
  if (!recipes) {
    recipes = new Map();
    comparisons.set(chain, recipes);
  }
  let result = recipes.get(recipe);
  if (!result) {
    result = reachablePrintTiers(recipe).map((tier) => chain.estimate(recipe, tier));
    recipes.set(recipe, result);
  }
  return result;
}

export function selectPrintTier(comparisons: Estimate[], selectedTier?: number): Estimate | undefined {
  const selected = comparisons.find((comparison) => comparison.tier === selectedTier);
  if (selected) return selected;
  return comparisons.reduce<Estimate | undefined>((best, candidate) =>
    !best || (candidate.gilPerHour ?? -Infinity) > (best.gilPerHour ?? -Infinity) ? candidate : best, undefined);
}