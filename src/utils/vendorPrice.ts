import vendorPricesData from "../data/vendorPrices.json";
import { catalogData } from "./phoenixData";

type VendorPriceEntry = {
  fish: string;
  itemId: number;
  stackSize: number;
  vendorPriceEach: number;
  vendorPriceStack: number;
};

const VENDOR_PRICES: VendorPriceEntry[] = vendorPricesData as VendorPriceEntry[];

function normalizeFishName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const exactPriceByFish = new Map<string, number>();
const normalizedPriceByFish = new Map<string, number>();

for (const row of VENDOR_PRICES) {
  const item = catalogData.items[String(row.itemId)];
  const price = item ? (item.flags & 4096 ? 0 : item.sell) : row.vendorPriceEach;
  exactPriceByFish.set(row.fish, price);
  normalizedPriceByFish.set(normalizeFishName(row.fish), price);
}

export function getVendorPriceEach(fishName: string): number | null {
  const exact = exactPriceByFish.get(fishName);
  if (exact !== undefined) return exact;

  const normalized = normalizedPriceByFish.get(normalizeFishName(fishName));
  return normalized ?? null;
}

export function formatVendorPrice(price: number | null): string {
  return price === null ? "-" : price.toLocaleString();
}
