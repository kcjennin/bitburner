import { dodge } from '@/lib/dodge';
import { BladeburnerSkillName, NS } from '@ns';

// smaller weight is better
const SKILLS = [
  { name: "Blade's Intuition" as BladeburnerSkillName, weight: 3 },
  { name: 'Digital Observer' as BladeburnerSkillName, weight: 4 },
  { name: 'Overclock' as BladeburnerSkillName, weight: 10 },
];

export async function main(ns: NS): Promise<void> {
  while (true) {
    let didUpgrade = false;
    do {
      const skills: { name: BladeburnerSkillName; cost: number; level: number }[] = [];
      for (const s of SKILLS) {
        const cost = (await dodge({ ns, command: `ns.bladeburner.getSkillUpgradeCost("${s.name}")` })) as number;
        const level = (await dodge({
          ns,
          command: `ns.bladeburner.getSkillLevel("${s.name}") / ${s.weight}`,
        })) as number;
        skills.push({
          name: s.name,
          cost,
          level,
        });
      }
      skills.sort((a, b) => a.level - b.level);

      // Overclock maxes out at 90
      if (skills[0].name === 'Overclock' && skills[0].level === 90) skills.shift();

      // Buy the skill, if possible
      didUpgrade = (await dodge({ ns, command: `ns.bladeburner.upgradeSkill("${skills[0].name}")` })) as boolean;
    } while (didUpgrade);
    await ns.bladeburner.nextUpdate();
  }
}
