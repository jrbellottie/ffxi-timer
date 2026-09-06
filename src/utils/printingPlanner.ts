import { createPrintingChain, type SourceChoices } from "./printingChain";
import type { PrintRecipe, PrintSettings } from "./printing";

type PriceBook = Record<string, number>;
type PlannerState = {
  settings: PrintSettings; buy: PriceBook; sell: PriceBook; sources: SourceChoices;
  vendors: boolean; modernGuilds: boolean; wotg: boolean; keyItems: boolean;
};
const changedPrices = (previous: PriceBook, next: PriceBook) => [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter((key) => previous[key] !== next[key]);

export function createPrintingPlanner(recipes: PrintRecipe[], itemKey: (name: string) => string,
  buyPrice: (name: string, book: PriceBook, vendors: boolean, modernGuilds: boolean) => number | null,
  sellPrice: (name: string, book: PriceBook) => number | null) {
  let cached: { configuration: string; buy: PriceBook; sell: PriceBook; available: PrintRecipe[]; chain: ReturnType<typeof createPrintingChain> } | undefined;
  return (state: PlannerState) => {
    const configuration = JSON.stringify([state.settings, state.sources, state.vendors, state.modernGuilds, state.wotg, state.keyItems]);
    const buy = (name: string) => buyPrice(name, state.buy, state.vendors, state.modernGuilds);
    const sell = (name: string) => sellPrice(name, state.sell);
    if (!cached || cached.configuration !== configuration) {
      const available = recipes.filter((recipe) => (state.wotg || recipe.era !== "WotG") && (state.keyItems || !recipe.ki));
      cached = { configuration, buy: state.buy, sell: state.sell, available, chain: createPrintingChain(available, state.settings, buy, sell, itemKey, state.sources) };
    } else if (cached.buy !== state.buy || cached.sell !== state.sell) {
      const changedBuy = changedPrices(cached.buy, state.buy);
      const changedSell = changedPrices(cached.sell, state.sell);
      if (changedBuy.length || changedSell.length) cached = { ...cached, buy: state.buy, sell: state.sell, chain: cached.chain.reprice(buy, sell, changedBuy, changedSell) };
    }
    return cached;
  };
}