import { BladeburnerSkillName, NS } from '@ns';

// smaller weight is better
const SKILLS = [
  { name: "Blade's Intuition" as BladeburnerSkillName, weight: 3 },
  { name: 'Digital Observer' as BladeburnerSkillName, weight: 4 },
  { name: 'Overclock' as BladeburnerSkillName, weight: 10 },
];

export async function main(ns: NS): Promise<void> {
  while (true) {
    const skills = SKILLS.map((s) => {
      return {
        name: s.name,
        cost: ns.bladeburner.getSkillUpgradeCost(s.name),
        level: ns.bladeburner.getSkillLevel(s.name) / s.weight,
      };
    }).sort((a, b) => a.level - b.level);

    // Overclock maxes out at 90
    if (skills[0].name === 'Overclock' && ns.bladeburner.getSkillLevel('Overclock') >= 90) skills.shift();

    // Buy the skill, if possible
    ns.bladeburner.upgradeSkill(skills[0].name);

    await ns.bladeburner.nextUpdate();
  }
}
