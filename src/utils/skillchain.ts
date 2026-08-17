export const SKILLCHAIN_PROPERTIES = [
  "Transfixion",
  "Compression",
  "Liquefaction",
  "Scission",
  "Reverberation",
  "Detonation",
  "Induration",
  "Impaction",
  "Gravitation",
  "Distortion",
  "Fusion",
  "Fragmentation",
  "Light",
  "Darkness",
] as const;

export type SkillchainProperty = (typeof SKILLCHAIN_PROPERTIES)[number];

export type WeaponSkill = {
  id: string;
  name: string;
  weapon: string;
  jobs: string[];
  skillRanks: Record<string, number>;
  skill: number | null;
  level: number | null;
  acquisition: "Skill" | "Quest" | "Relic" | "Mythic" | "Blood Pact";
  properties: SkillchainProperty[];
};

export type ChainResult = {
  property: SkillchainProperty;
  level: 1 | 2 | 3 | 4;
  closingProperty: SkillchainProperty;
};

export type SkillchainCombination = {
  opener: WeaponSkill;
  closer: WeaponSkill;
  finisher?: WeaponSkill;
  intermediate?: ChainResult;
  result: ChainResult;
};

const RESULTS: Partial<Record<SkillchainProperty, Partial<Record<SkillchainProperty, SkillchainProperty>>>> = {
  Liquefaction: { Scission: "Scission", Impaction: "Fusion" },
  Scission: { Liquefaction: "Liquefaction", Reverberation: "Reverberation", Detonation: "Detonation" },
  Reverberation: { Induration: "Induration", Impaction: "Impaction" },
  Induration: { Compression: "Compression", Reverberation: "Fragmentation", Impaction: "Impaction" },
  Impaction: { Liquefaction: "Liquefaction", Detonation: "Detonation" },
  Detonation: { Scission: "Scission", Compression: "Compression" },
  Compression: { Transfixion: "Transfixion", Detonation: "Gravitation" },
  Transfixion: { Reverberation: "Reverberation", Compression: "Compression", Scission: "Distortion" },
  Fusion: { Fragmentation: "Light", Gravitation: "Gravitation" },
  Fragmentation: { Fusion: "Light", Distortion: "Distortion" },
  Distortion: { Gravitation: "Darkness", Fusion: "Fusion" },
  Gravitation: { Distortion: "Darkness", Fragmentation: "Fragmentation" },
  Light: { Light: "Light" },
  Darkness: { Darkness: "Darkness" },
};

const LEVEL: Record<SkillchainProperty, 1 | 2 | 3> = {
  Transfixion: 1,
  Compression: 1,
  Liquefaction: 1,
  Scission: 1,
  Reverberation: 1,
  Detonation: 1,
  Induration: 1,
  Impaction: 1,
  Gravitation: 2,
  Distortion: 2,
  Fusion: 2,
  Fragmentation: 2,
  Light: 3,
  Darkness: 3,
};

export function resolveSkillchain(
  activeProperties: SkillchainProperty[],
  closerProperties: SkillchainProperty[]
): ChainResult | null {
  for (const closer of closerProperties) {
    for (const active of activeProperties) {
      const property = RESULTS[active]?.[closer];
      if (property) {
        const level = active === property && LEVEL[property] === 3 ? 4 : LEVEL[property];
        return { property, level, closingProperty: closer };
      }
    }
  }
  return null;
}

export function enumerateSkillchains(
  skills: WeaponSkill[],
  targetProperty?: SkillchainProperty,
  maxSteps: 2 | 3 = 3
): SkillchainCombination[] {
  const combinations: SkillchainCombination[] = [];

  for (const opener of skills) {
    if (opener.properties.length === 0) continue;
    for (const closer of skills) {
      if (closer.properties.length === 0) continue;
      const intermediate = resolveSkillchain(opener.properties, closer.properties);
      if (!intermediate) continue;
      if (!targetProperty || intermediate.property === targetProperty) {
        combinations.push({ opener, closer, result: intermediate });
      }
      if (maxSteps === 2) continue;
      for (const finisher of skills) {
        if (finisher.properties.length === 0) continue;
        const result = resolveSkillchain([intermediate.property], finisher.properties);
        if (!result || (targetProperty && result.property !== targetProperty)) continue;
        combinations.push({ opener, closer, finisher, intermediate, result });
      }
    }
  }

  return combinations.sort(
    (a, b) =>
      b.result.level - a.result.level ||
      a.result.property.localeCompare(b.result.property) ||
      Number(Boolean(a.finisher)) - Number(Boolean(b.finisher)) ||
      a.opener.name.localeCompare(b.opener.name) ||
      a.closer.name.localeCompare(b.closer.name) ||
      (a.finisher?.name ?? "").localeCompare(b.finisher?.name ?? "")
  );
}