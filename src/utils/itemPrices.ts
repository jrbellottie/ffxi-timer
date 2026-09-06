import { useMemo, useSyncExternalStore } from "react";
import { createItemPriceStore, ITEM_PRICES_KEY, resolvedPriceBooks } from "./itemPriceStore";
import { printItemKey, printBuyPrice, printSellPrice } from "./printingData";

export const itemPrices = createItemPriceStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, printItemKey);

const onStorage = (event: StorageEvent) => {
  if (event.key === ITEM_PRICES_KEY) itemPrices.reload();
};
if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener("storage", onStorage));

export function useItemPrices(vendors = true, modernGuilds = false) {
  const prices = useSyncExternalStore(itemPrices.subscribe, itemPrices.getSnapshot, itemPrices.getSnapshot);
  return useMemo(() => ({ ...prices, ...resolvedPriceBooks(prices,
    (key) => printBuyPrice(key, {}, vendors, modernGuilds), (key) => printSellPrice(key, {})) }), [prices, vendors, modernGuilds]);
}