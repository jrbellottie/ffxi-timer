export type SkillupRod = {
  rodId: number;
  rod: string;
  era: string;
  size: string;
  legendary: boolean;
  breakable: boolean;
  minRank: number;
  maxRank: number;
  rating: number;
  fishAttack: number;
  lgdBonusAttack: number;
  fishRecovery: number;
  fishTime: number;
  lgdBonusTime: number;
  multiplier: number;
};

export type SkillupFish = {
  fish: string;
  skillCap: number;
  ranking: number;
  size: string;
  legendary: boolean;
};

export type RodRisk = {
  snapPct: number;
  breakPct: number;
  escapePct: number;
  landPct: number;
};

const CITY_ZONES = new Set([
  "Aht Urhgan Whitegate",
  "Al Zahbi",
  "Bastok Markets",
  "Bastok Mines",
  "Port Bastok",
  "Heavens Tower",
  "Kazham",
  "Mhaura",
  "Nashmau",
  "Norg",
  "Southern San dOria",
  "Northern San dOria",
  "Port San dOria",
  "Rabao",
  "Selbina",
  "Tavnazian Safehold",
  "Windurst Walls",
  "Windurst Waters",
  "Windurst Woods",
  "Port Windurst",
  "Lower Jeuno",
  "Port Jeuno",
  "Upper Jeuno",
]);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const sizeRank = (size: string) => (size === "L" ? 1 : 0);

export function isCityFishingZone(zone: string): boolean {
  return CITY_ZONES.has(zone);
}

export function getRodHiddenSuccessBonus(rodName: string): number {
  if (rodName.startsWith("Ebisu Fishing Rod")) return 15;
  if (rodName.startsWith("Lu Shang's Fishing Rod")) return 10;
  return 0;
}

export function calculateRodRisk(effectiveSkill: number, fish: SkillupFish, rod: SkillupRod): RodRisk {
  const levelDifferenceBonus = effectiveSkill + 10 > fish.skillCap ? 2 : 0;

  let snapPenalty = !rod.legendary && sizeRank(fish.size) > sizeRank(rod.size) ? 2 : 0;
  let snapBonus = 0;
  if (fish.legendary) {
    if (rod.legendary) snapBonus = 1;
    else snapPenalty += 3;
  }
  const durability = rod.maxRank + levelDifferenceBonus + snapBonus - snapPenalty;
  const snapPct = fish.ranking > durability
    ? clamp(Math.floor((fish.ranking - durability) * 8.5), 0, 55)
    : 0;

  let breakPct = 0;
  if (rod.breakable) {
    let breakPenalty = 0;
    let breakBonus = 0;
    if (!rod.legendary && sizeRank(fish.size) > sizeRank(rod.size)) breakPenalty = 2;
    else if (rod.legendary && fish.size === "L") breakBonus = 1;
    if (!rod.legendary && fish.legendary) breakPenalty = 5;
    const threshold = rod.maxRank + levelDifferenceBonus + breakBonus;
    breakPct = fish.ranking > threshold
      ? clamp(Math.floor((fish.ranking - threshold + breakPenalty) * 1.3), 0, 55)
      : 0;
  }

  let escapePct = 0;
  if (!rod.legendary && sizeRank(fish.size) > sizeRank(rod.size) && fish.ranking > rod.maxRank) {
    escapePct = clamp(50 + (fish.skillCap - effectiveSkill), 0, 50);
  } else if (!rod.legendary && sizeRank(fish.size) < sizeRank(rod.size) && fish.ranking < rod.minRank) {
    escapePct = clamp(50 + (fish.skillCap - effectiveSkill), 0, 50);
  } else if (effectiveSkill + 7 < fish.skillCap) {
    escapePct = clamp(Math.floor((fish.skillCap - (effectiveSkill + 7)) * 0.8), 0, 55);
  }

  const landPct = 100 * (1 - escapePct / 100) * (1 - snapPct / 100) * (1 - breakPct / 100);
  return { snapPct, breakPct, escapePct, landPct };
}

/** Exact TOAU server formula under neutral moon. Equipment/support skill is deliberately excluded. */
export function calculateSkillup(baseSkill: number, fishLevel: number, zone: string, rodName: string) {
  const skill = clamp(Math.floor(baseSkill), 0, 200);
  const difference = fishLevel - skill;
  if (difference < 1 || difference > 50) {
    return { eligible: false, difference, chancePct: 0, expectedGainPerTargetHook: 0 };
  }

  const normalPdf = Math.exp(-0.5 * Math.pow((difference - 11) / 5, 2)) / (5 * Math.sqrt(2 * Math.PI));
  const distanceModifier = Math.floor(200 * normalPdf);
  const maxChance = Math.max(
    4,
    distanceModifier + Math.floor((100 - skill) / 10) - Math.floor(skill / 10)
  );

  let skillRoll = 90;
  if (!isCityFishingZone(zone)) skillRoll -= 10;
  if (skill < 50) skillRoll -= 20 - Math.floor(skill / 3);
  if (skill < 50 && rodName.startsWith("Lu Shang's Fishing Rod")) skillRoll += 20;
  skillRoll = Math.max(1, skillRoll);

  const chancePct = Math.min(100, (100 * maxChance) / skillRoll);
  const expectedGainWhenSuccessful = difference >= 10 ? 0.10625 : 0.1;
  return {
    eligible: true,
    difference,
    chancePct,
    expectedGainPerTargetHook: (chancePct / 100) * expectedGainWhenSuccessful,
  };
}
