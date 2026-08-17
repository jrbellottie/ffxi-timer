import type { SkillchainProperty, WeaponSkill } from "../utils/skillchain";

type Acquisition = WeaponSkill["acquisition"];
type SkillRow = [string, number | null, SkillchainProperty[], Acquisition?, string[]?];

const JOB_CODES = [
  "WAR", "MNK", "WHM", "BLM", "RDM", "THF", "PLD", "DRK", "BST", "BRD",
  "RNG", "SAM", "NIN", "DRG", "SMN", "BLU", "COR", "PUP", "DNC", "SCH",
] as const;

const LEVEL_75_CAP_BY_RANK = [0, 276, 269, 256, 250, 240, 230, 225, 220, 210, 200, 189, 171];

// Job columns follow JOB_CODES; values are the retail combat-skill rank (0 = unavailable).
const SKILL_RANKS: Record<string, number[]> = {
  "Hand-to-Hand": [9, 1, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 1, 9, 0],
  Dagger: [5, 0, 0, 9, 4, 1, 8, 7, 6, 5, 5, 10, 6, 10, 10, 0, 3, 8, 1, 9],
  Sword: [4, 0, 0, 0, 4, 9, 1, 5, 10, 8, 9, 6, 7, 8, 0, 1, 5, 0, 9, 0],
  "Great Sword": [3, 0, 0, 0, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Axe: [2, 0, 0, 0, 0, 0, 0, 5, 1, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Great Axe": [1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Scythe: [3, 0, 0, 10, 0, 0, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Polearm: [5, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 5, 0, 1, 0, 0, 0, 0, 0, 0],
  Katana: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  "Great Katana": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 0, 0, 0, 0, 0, 0, 0],
  Club: [5, 6, 3, 6, 9, 10, 2, 8, 9, 9, 10, 10, 10, 10, 6, 5, 0, 9, 0, 6],
  Staff: [4, 4, 6, 5, 0, 0, 2, 0, 0, 6, 0, 0, 0, 5, 4, 0, 0, 0, 0, 6],
  Archery: [9, 0, 0, 0, 9, 8, 0, 0, 0, 0, 1, 6, 10, 0, 0, 0, 0, 0, 0, 0],
  Marksmanship: [9, 0, 0, 0, 0, 6, 0, 10, 0, 0, 1, 0, 7, 0, 0, 0, 4, 0, 0, 0],
};

function skillRanksAtLevel75(weapon: string, requiredSkill: number | null): Record<string, number> {
  if (requiredSkill === null) return {};
  return Object.fromEntries((SKILL_RANKS[weapon] ?? []).flatMap((rank, index) => {
    const job = JOB_CODES[index];
    return job && rank > 0 && (LEVEL_75_CAP_BY_RANK[rank] ?? 0) >= requiredSkill ? [[job, rank]] : [];
  }));
}

function rows(weapon: string, values: SkillRow[]): WeaponSkill[] {
  return values.map(([name, skill, properties, acquisition = "Skill", jobs]) => {
    const skillRanks = skillRanksAtLevel75(weapon, skill);
    return {
      id: `${weapon}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      weapon,
      jobs: jobs ?? Object.keys(skillRanks),
      skillRanks,
      skill,
      level: null,
      acquisition,
      properties,
    };
  });
}

function bloodPacts(avatar: string, values: Array<[string, number, SkillchainProperty[]]>): WeaponSkill[] {
  return values.map(([name, level, properties]) => ({
    id: `${avatar}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    weapon: `${avatar} Avatar`,
    jobs: ["SMN"],
    skillRanks: {},
    skill: null,
    level,
    acquisition: "Blood Pact",
    properties,
  }));
}

export const WEAPON_SKILLS: WeaponSkill[] = [
  ...rows("Hand-to-Hand", [
    ["Combo", 10, ["Impaction"]],
    ["Shoulder Tackle", 40, ["Impaction", "Reverberation"]],
    ["One Inch Punch", 75, ["Compression"]],
    ["Backhand Blow", 100, ["Detonation"]],
    ["Raging Fists", 125, ["Impaction"]],
    ["Spinning Attack", 150, ["Liquefaction", "Impaction"]],
    ["Howling Fist", 200, ["Transfixion", "Impaction"]],
    ["Dragon Kick", 225, ["Fragmentation"]],
    ["Asuran Fists", 250, ["Gravitation", "Liquefaction"]],
    ["Final Heaven", null, ["Light", "Fusion"], "Relic", ["MNK"]],
    ["Ascetic's Fury", null, ["Fusion", "Transfixion"], "Mythic", ["MNK"]],
    ["Stringing Pummel", null, ["Gravitation", "Liquefaction"], "Mythic", ["PUP"]],
  ]),
  ...rows("Dagger", [
    ["Wasp Sting", 10, ["Scission"]], ["Viper Bite", 40, ["Scission"]],
    ["Shadowstitch", 70, ["Reverberation"]], ["Gust Slash", 100, ["Detonation"]],
    ["Cyclone", 125, ["Detonation", "Impaction"]], ["Energy Steal", 150, []],
    ["Energy Drain", 175, []], ["Dancing Edge", 200, ["Scission", "Detonation"]],
    ["Shark Bite", 225, ["Fragmentation"]], ["Evisceration", 230, ["Gravitation", "Transfixion"], "Quest"],
    ["Mercy Stroke", null, ["Darkness", "Gravitation"], "Relic", ["THF", "BRD", "DNC"]],
    ["Mandalic Stab", null, ["Fusion", "Compression"], "Mythic", ["THF"]],
    ["Mordant Rime", null, ["Fragmentation", "Distortion"], "Mythic", ["BRD"]],
    ["Pyrrhic Kleos", null, ["Distortion", "Scission"], "Mythic", ["DNC"]],
  ]),
  ...rows("Sword", [
    ["Fast Blade", 10, ["Scission"]], ["Burning Blade", 30, ["Liquefaction"]],
    ["Red Lotus Blade", 50, ["Liquefaction", "Detonation"]], ["Flat Blade", 75, ["Impaction"]],
    ["Shining Blade", 100, ["Scission"]], ["Seraph Blade", 125, ["Scission"]],
    ["Circle Blade", 150, ["Reverberation", "Impaction"]], ["Spirits Within", 175, []],
    ["Vorpal Blade", 200, ["Scission", "Impaction"]], ["Swift Blade", 225, ["Gravitation"]],
    ["Savage Blade", 240, ["Fragmentation", "Scission"], "Quest"],
    ["Knights of Round", null, ["Light", "Fusion"], "Relic", ["RDM", "PLD"]],
    ["Death Blossom", null, ["Fragmentation", "Distortion"], "Mythic", ["RDM"]],
    ["Atonement", null, ["Fusion", "Reverberation"], "Mythic", ["PLD"]],
    ["Expiacion", null, ["Distortion", "Scission"], "Mythic", ["BLU"]],
  ]),
  ...rows("Great Sword", [
    ["Hard Slash", 10, ["Scission"]], ["Power Slash", 30, ["Transfixion"]],
    ["Frostbite", 70, ["Induration"]], ["Freezebite", 100, ["Induration", "Detonation"]],
    ["Shockwave", 125, ["Reverberation"]], ["Crescent Moon", 150, ["Scission"]],
    ["Sickle Moon", 175, ["Scission", "Impaction"]], ["Spinning Slash", 200, ["Fragmentation"]],
    ["Ground Strike", 250, ["Fragmentation", "Distortion"], "Quest"],
    ["Scourge", null, ["Light", "Fusion"], "Relic", ["WAR", "PLD", "DRK"]],
  ]),
  ...rows("Axe", [
    ["Raging Axe", 10, ["Detonation", "Impaction"]], ["Smash Axe", 40, ["Induration", "Reverberation"]],
    ["Gale Axe", 70, ["Detonation"]], ["Avalanche Axe", 100, ["Scission", "Impaction"]],
    ["Spinning Axe", 125, ["Liquefaction", "Scission", "Impaction"]], ["Rampage", 150, ["Scission"]],
    ["Calamity", 175, ["Scission", "Impaction"]], ["Mistral Axe", 200, ["Fusion"]],
    ["Decimation", 240, ["Fusion", "Reverberation"], "Quest"],
    ["Onslaught", null, ["Darkness", "Gravitation"], "Relic", ["WAR", "BST"]],
    ["Primal Rend", null, ["Gravitation", "Reverberation"], "Mythic", ["BST"]],
  ]),
  ...rows("Great Axe", [
    ["Shield Break", 10, ["Impaction"]], ["Iron Tempest", 40, ["Scission"]],
    ["Sturmwind", 70, ["Reverberation", "Scission"]], ["Armor Break", 100, ["Impaction"]],
    ["Keen Edge", 125, ["Compression"]], ["Weapon Break", 150, ["Impaction"]],
    ["Raging Rush", 175, ["Induration", "Reverberation"]], ["Full Break", 200, ["Distortion"]],
    ["Steel Cyclone", 240, ["Distortion", "Detonation"], "Quest"],
    ["Metatron Torment", null, ["Light", "Fusion"], "Relic", ["WAR"]],
    ["King's Justice", null, ["Fragmentation", "Scission"], "Mythic", ["WAR"]],
  ]),
  ...rows("Scythe", [
    ["Slice", 10, ["Scission"]], ["Dark Harvest", 30, ["Reverberation"]],
    ["Shadow of Death", 70, ["Induration", "Reverberation"]], ["Nightmare Scythe", 100, ["Compression", "Scission"]],
    ["Spinning Scythe", 125, ["Reverberation", "Scission"]], ["Vorpal Scythe", 150, ["Transfixion", "Scission"]],
    ["Guillotine", 200, ["Induration"]], ["Cross Reaper", 225, ["Distortion"]],
    ["Spiral Hell", 240, ["Distortion", "Scission"], "Quest"],
    ["Catastrophe", null, ["Darkness", "Gravitation"], "Relic", ["DRK"]],
    ["Insurgency", null, ["Fusion", "Compression"], "Mythic", ["DRK"]],
  ]),
  ...rows("Polearm", [
    ["Double Thrust", 10, ["Transfixion"]], ["Thunder Thrust", 30, ["Transfixion", "Impaction"]],
    ["Raiden Thrust", 70, ["Transfixion", "Impaction"]], ["Leg Sweep", 100, ["Impaction"]],
    ["Penta Thrust", 150, ["Compression"]], ["Vorpal Thrust", 175, ["Reverberation", "Transfixion"]],
    ["Skewer", 200, ["Transfixion", "Impaction"]], ["Wheeling Thrust", 225, ["Fusion"]],
    ["Impulse Drive", 240, ["Gravitation", "Induration"], "Quest"],
    ["Geirskogul", null, ["Light", "Distortion"], "Relic", ["DRG"]],
    ["Drakesbane", null, ["Fusion", "Transfixion"], "Mythic", ["DRG"]],
  ]),
  ...rows("Katana", [
    ["Blade: Rin", 10, ["Transfixion"]], ["Blade: Retsu", 30, ["Scission"]],
    ["Blade: Teki", 70, ["Reverberation"]], ["Blade: To", 100, ["Induration", "Detonation"]],
    ["Blade: Chi", 150, ["Impaction", "Transfixion"]], ["Blade: Ei", 175, ["Compression"]],
    ["Blade: Jin", 200, ["Impaction", "Detonation"]], ["Blade: Ten", 225, ["Gravitation"]],
    ["Blade: Ku", 250, ["Gravitation", "Transfixion"], "Quest"],
    ["Blade: Metsu", null, ["Darkness", "Fragmentation"], "Relic", ["NIN"]],
    ["Blade: Kamu", null, ["Fragmentation", "Compression"], "Mythic", ["NIN"]],
  ]),
  ...rows("Great Katana", [
    ["Tachi: Enpi", 10, ["Transfixion", "Scission"]], ["Tachi: Hobaku", 30, ["Induration"]],
    ["Tachi: Goten", 70, ["Transfixion", "Impaction"]], ["Tachi: Kagero", 100, ["Liquefaction"]],
    ["Tachi: Jinpu", 150, ["Scission", "Detonation"]], ["Tachi: Koki", 175, ["Reverberation", "Impaction"]],
    ["Tachi: Yukikaze", 200, ["Induration", "Detonation"]], ["Tachi: Gekko", 225, ["Distortion", "Reverberation"]],
    ["Tachi: Kasha", 250, ["Fusion", "Compression"], "Quest"],
    ["Tachi: Kaiten", null, ["Light", "Fragmentation"], "Relic", ["SAM"]],
    ["Tachi: Rana", null, ["Gravitation", "Induration"], "Mythic", ["SAM"]],
  ]),
  ...rows("Club", [
    ["Shining Strike", 10, ["Impaction"]], ["Seraph Strike", 40, ["Impaction"]],
    ["Brainshaker", 70, ["Reverberation"]], ["Starlight", 100, []], ["Moonlight", 125, []],
    ["Skullbreaker", 150, ["Induration", "Reverberation"]], ["True Strike", 175, ["Detonation", "Impaction"]],
    ["Judgment", 200, ["Impaction"]], ["Hexa Strike", 220, ["Fusion"]],
    ["Black Halo", 230, ["Fragmentation", "Compression"], "Quest"],
    ["Randgrith", null, ["Light", "Fragmentation"], "Relic", ["WHM"]],
    ["Mystic Boon", null, [], "Mythic", ["WHM"]],
  ]),
  ...rows("Staff", [
    ["Heavy Swing", 10, ["Impaction"]], ["Rock Crusher", 40, ["Impaction"]],
    ["Earth Crusher", 70, ["Detonation", "Impaction"]], ["Starburst", 100, ["Compression", "Reverberation"]],
    ["Sunburst", 150, ["Compression", "Reverberation"]], ["Shell Crusher", 175, ["Detonation"]],
    ["Full Swing", 200, ["Liquefaction", "Impaction"]], ["Spirit Taker", 215, []],
    ["Retribution", 230, ["Gravitation", "Reverberation"], "Quest"],
    ["Gate of Tartarus", null, ["Darkness", "Distortion"], "Relic", ["BLM"]],
    ["Vidohunir", null, ["Fragmentation", "Distortion"], "Mythic", ["BLM"]],
    ["Garland of Bliss", null, ["Fusion", "Reverberation"], "Mythic", ["SMN"]],
    ["Omniscience", null, ["Gravitation", "Transfixion"], "Mythic", ["SCH"]],
  ]),
  ...rows("Archery", [
    ["Flaming Arrow", 10, ["Liquefaction", "Transfixion"]], ["Piercing Arrow", 40, ["Reverberation", "Transfixion"]],
    ["Dulling Arrow", 80, ["Liquefaction", "Transfixion"]], ["Sidewinder", 175, ["Reverberation", "Transfixion", "Detonation"]],
    ["Blast Arrow", 200, ["Induration", "Transfixion"]], ["Arching Arrow", 225, ["Fusion"]],
    ["Empyreal Arrow", 250, ["Fusion", "Transfixion"], "Quest"],
    ["Namas Arrow", null, ["Light", "Distortion"], "Relic", ["RNG", "SAM"]],
  ]),
  ...rows("Marksmanship", [
    ["Hot Shot", 10, ["Reverberation", "Transfixion"]], ["Split Shot", 40, ["Reverberation", "Transfixion"]],
    ["Sniper Shot", 80, ["Liquefaction", "Transfixion"]], ["Slug Shot", 175, ["Reverberation", "Transfixion", "Detonation"]],
    ["Blast Shot", 200, ["Induration", "Transfixion"]], ["Heavy Shot", 225, ["Fusion"]],
    ["Detonator", 250, ["Fusion", "Transfixion"], "Quest"],
    ["Coronach", null, ["Darkness", "Fragmentation"], "Relic", ["RNG"]],
    ["Trueflight", null, ["Fragmentation", "Scission"], "Mythic", ["RNG"]],
    ["Leaden Salute", null, ["Gravitation", "Transfixion"], "Mythic", ["COR"]],
  ]),
  ...bloodPacts("Carbuncle", [
    ["Poison Nails", 5, ["Transfixion"]],
  ]),
  ...bloodPacts("Fenrir", [
    ["Moonlit Charge", 5, ["Compression"]],
    ["Crescent Fang", 10, ["Transfixion"]],
    ["Eclipse Bite", 65, ["Gravitation", "Scission"]],
  ]),
  ...bloodPacts("Diabolos", [
    ["Camisado", 1, ["Compression"]],
  ]),
  ...bloodPacts("Ifrit", [
    ["Punch", 1, ["Liquefaction"]],
    ["Burning Strike", 23, ["Impaction"]],
    ["Double Punch", 30, ["Compression"]],
    ["Flaming Crush", 70, ["Fusion", "Reverberation"]],
  ]),
  ...bloodPacts("Shiva", [
    ["Axe Kick", 1, ["Induration"]],
    ["Double Slap", 50, ["Scission"]],
    ["Rush", 70, ["Distortion", "Scission"]],
  ]),
  ...bloodPacts("Garuda", [
    ["Claw", 1, ["Detonation"]],
    ["Predator Claws", 70, ["Fragmentation", "Scission"]],
  ]),
  ...bloodPacts("Titan", [
    ["Rock Throw", 1, ["Scission"]],
    ["Rock Buster", 21, ["Reverberation"]],
    ["Megalith Throw", 35, ["Induration"]],
    ["Mountain Buster", 70, ["Gravitation", "Induration"]],
  ]),
  ...bloodPacts("Ramuh", [
    ["Shock Strike", 1, ["Impaction"]],
    ["Chaotic Strike", 70, ["Fragmentation", "Transfixion"]],
  ]),
  ...bloodPacts("Leviathan", [
    ["Barracuda Dive", 1, ["Reverberation"]],
    ["Tail Whip", 26, ["Detonation"]],
    ["Spinning Dive", 70, ["Distortion", "Detonation"]],
  ]),
];

export const WEAPONS = [...new Set(WEAPON_SKILLS.map((skill) => skill.weapon))];
export const JOBS_LIST = [...new Set(WEAPON_SKILLS.flatMap((skill) => skill.jobs))].sort();

const SKILL_CAPS_62_TO_75 = [
  [212, 211, 203, 202, 201, 195, 194, 194, 186, 174, 163],
  [217, 215, 207, 205, 204, 197, 196, 196, 188, 176, 165],
  [222, 219, 210, 208, 206, 200, 199, 198, 190, 178, 167],
  [227, 223, 214, 212, 209, 202, 201, 200, 192, 180, 169],
  [232, 227, 218, 215, 212, 205, 203, 202, 194, 182, 171],
  [236, 231, 221, 218, 214, 207, 205, 204, 195, 184, 173],
  [241, 235, 225, 221, 217, 210, 208, 206, 197, 186, 175],
  [246, 239, 229, 225, 220, 212, 210, 208, 199, 188, 177],
  [251, 244, 233, 228, 223, 215, 212, 210, 201, 190, 179],
  [256, 249, 237, 232, 226, 218, 214, 212, 203, 192, 181],
  [261, 254, 241, 236, 229, 221, 217, 214, 205, 194, 183],
  [266, 259, 246, 240, 232, 224, 219, 216, 207, 196, 185],
  [271, 264, 251, 245, 236, 227, 222, 218, 208, 198, 187],
  [276, 269, 256, 250, 240, 230, 225, 220, 210, 200, 189],
];

function combatSkillCap(rank: number, rawLevel: number): number {
  const level = Math.max(1, Math.min(75, Math.floor(rawLevel)));
  if (level >= 62) return SKILL_CAPS_62_TO_75[level - 62]?.[rank - 1] ?? 0;
  if (level === 61) return [207, 207, 199, 199, 198, 192, 192, 192, 184, 172, 161][rank - 1] ?? 0;
  if (level <= 50) {
    if (rank <= 2) return level * 3 + 3;
    if (rank <= 5) return Math.floor((level - 1) * 2.9) + 5;
    if (rank <= 8) return Math.floor((level - 1) * 2.8) + 5;
    if (rank === 9) return Math.floor((level - 1) * 2.7) + 4;
    if (rank === 10) return Math.floor((level - 1) * 2.5) + 4;
    return Math.floor((level - 1) * 2.3) + 4;
  }
  const levelsPast50 = level - 50;
  if (rank <= 2) return 153 + levelsPast50 * 5;
  if (rank <= 5) return 146 + levelsPast50 * 5;
  if (rank <= 8) return 141 + levelsPast50 * 5;
  if (rank === 9) return 136 + Math.floor(levelsPast50 * 4.7);
  if (rank === 10) return 126 + Math.floor(levelsPast50 * 4.5);
  return 116 + Math.floor(levelsPast50 * 4.3);
}

export function canUseWeaponSkillAtLevel(skill: WeaponSkill, level: number, job?: string): boolean {
  if (skill.acquisition === "Blood Pact") {
    return level >= (skill.level ?? 1) && (!job || skill.jobs.includes(job));
  }
  const minimumUnlockLevel = skill.acquisition === "Quest" ? 71 : skill.acquisition === "Skill" ? 1 : 75;
  if (level < minimumUnlockLevel) return false;
  if (skill.skill === null) return job ? skill.jobs.includes(job) : skill.jobs.length > 0;
  const eligibleJobs = job ? [job] : skill.jobs;
  return eligibleJobs.some((jobCode) => {
    const rank = skill.skillRanks[jobCode];
    return rank !== undefined && combatSkillCap(rank, level) >= skill.skill!;
  });
}