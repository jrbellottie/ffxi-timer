import { synthSuccessPct } from "./craftingSkillup";

export const PRINT_CRAFTS = ["Woodworking", "Smithing", "Goldsmithing", "Clothcraft", "Leathercraft", "Bonecraft", "Alchemy", "Cooking"];
export const HQ_GAPS = [0, 11, 31, 51];
export const DEFAULT_HQ_RATES = [1.5625, 6.25, 25, 50];
export type PrintRecipe = { id: number; craft: string; lvl: number; crystal: string; era: string; ing: { n: string; q: number }[]; res: { n: string; q: number }; hq: { n: string; q: number }[]; subs?: { c: string; l: number }[]; d?: number; ki?: boolean };
export type PrintSettings = { skills: Record<string, number>; bonuses: Record<string, number>; hqRates: number[]; lossPct: number; seconds: number; overhead: number; sellMultiplier: number; successBonus: number };
export const DEFAULT_PRINT_SETTINGS: PrintSettings = { skills: {}, bonuses: {}, hqRates: DEFAULT_HQ_RATES, lossPct: 100, seconds: 21, overhead: 0, sellMultiplier: 100, successBonus: 0 };
export type PricedInput = { name: string; quantity: number; price: number | null; crystal: boolean };
export const validPrice = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function printingChances(recipe: PrintRecipe, settings: PrintSettings, tierOverride?: number) {
  const required = [{ c: recipe.craft, l: recipe.lvl }, ...(recipe.subs ?? [])];
  const requirements = required.map(({ c, l }) => {
    const skill = Math.floor(clamp(settings.skills[c] ?? 0, 0, 110));
    const effective = skill + clamp(settings.bonuses[c] ?? 0, 0, 30);
    return { craft: c, cap: l, skill, effective, gap: effective - l, eligible: skill >= l - 15 };
  });
  const eligible = recipe.d !== 1 && requirements.every((requirement) => requirement.eligible);
  const limitingGap = Math.min(...requirements.map((requirement) => requirement.gap));
  const actualTier = limitingGap < 0 ? -1 : limitingGap < 11 ? 0 : limitingGap < 31 ? 1 : limitingGap < 51 ? 2 : 3;
  const tier = tierOverride ?? actualTier;
  const success = tierOverride === undefined
    ? requirements.reduce((chance, requirement) => {
      const difficulty = -requirement.gap;
      const base = difficulty >= 4 ? 80 - 10 * (difficulty - 3) : synthSuccessPct(difficulty);
      return chance * clamp(base + settings.successBonus, 0, 99) / 100;
    }, 1)
    : Math.pow(clamp(95 + settings.successBonus, 0, 99) / 100, requirements.length);
  const hq = tier < 0 ? 0 : clamp(settings.hqRates[tier] ?? DEFAULT_HQ_RATES[tier], 0, 80) / 100;
  const distribution = tier <= 0 ? [1 - hq, hq, 0, 0] : tier === 1 ? [1 - hq, hq * 0.75, hq * 0.25, 0] : [1 - hq, hq * 0.75, hq * 0.1875, hq * 0.0625];
  return { eligible, requirements, limitingGap, tier, success, hq, distribution };
}

export function printingEstimate(recipe: PrintRecipe, settings: PrintSettings, buy: (name: string) => number | null, sell: (name: string) => number | null, tierOverride?: number) {
  const chances = printingChances(recipe, settings, tierOverride);
  const outcomes = [recipe.res, ...Array.from({ length: 3 }, (_, index) => recipe.hq[index] ?? recipe.res)].map((item, index) => {
    const price = sell(item.n);
    const payout = validPrice(price) ? Math.floor(price * clamp(settings.sellMultiplier, 0, 1000) / 100) : null;
    return { ...item, price: payout, probability: chances.success * chances.distribution[index], conditional: chances.distribution[index] };
  });
  const missingSales = outcomes.filter((item) => item.probability > 0 && item.price === null).map((item) => item.n);
  const revenue = missingSales.length ? null : outcomes.reduce((total, item) => total + item.probability * item.q * (item.price ?? 0), 0);
  const consumption = chances.success + (1 - chances.success) * (recipe.d === 2 ? 0 : clamp(settings.lossPct, 0, 100) / 100);
  const inputs: PricedInput[] = [
    ...recipe.ing.map((item) => ({ name: item.n, quantity: item.q, price: buy(item.n), crystal: false })),
    { name: `${recipe.crystal} Crystal`, quantity: 1, price: buy(`${recipe.crystal} Crystal`), crystal: true },
  ];
  const missing = inputs.filter((input) => !validPrice(input.price)).map((input) => input.name);
  const knownCost = inputs.reduce((total, input) => total + (input.price ?? 0) * input.quantity * (input.crystal ? 1 : consumption), 0);
  const cost = missing.length ? null : knownCost;
  const upfront = missing.length ? null : inputs.reduce((total, input) => total + (input.price ?? 0) * input.quantity, 0);
  const profit = revenue !== null && cost !== null ? revenue - cost : null;
  const attemptsPerHour = 3600 / (clamp(settings.seconds, 1, 3600) + clamp(settings.overhead, 0, 3600));
  const ceilings = inputs.map((input, index) => {
    const others = inputs.filter((_, otherIndex) => otherIndex !== index);
    const otherCost = others.reduce((total, other) => total + (other.price ?? 0) * other.quantity * (other.crystal ? 1 : consumption), 0);
    const factor = input.quantity * (input.crystal ? 1 : consumption);
    const maximum = revenue !== null && factor > 0 && others.every((other) => validPrice(other.price)) ? (revenue - otherCost) / factor : null;
    return { ...input, maximum };
  });
  const crystalPrice = inputs[inputs.length - 1].price;
  const materialBudget = revenue !== null && validPrice(crystalPrice) && consumption > 0 ? (revenue - crystalPrice) / consumption : null;
  return { ...chances, outcomes, inputs, missing, missingSales, revenue, cost, upfront, knownCost, profit, gilPerHour: profit === null ? null : profit * attemptsPerHour, attemptsPerHour, consumption, ceilings, materialBudget };
}