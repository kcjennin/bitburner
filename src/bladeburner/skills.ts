import { NS } from '@ns';

const SKILL_A = "Blade's Intuition";
const SKILL_B = 'Digital Observer';

export async function main(ns: NS): Promise<void> {
  while (true) {
    const costA = ns.bladeburner.getSkillUpgradeCost(SKILL_A);
    const costB = ns.bladeburner.getSkillUpgradeCost(SKILL_B);
    const levelA = ns.bladeburner.getSkillLevel(SKILL_A);
    const levelB = ns.bladeburner.getSkillLevel(SKILL_B);
    const points = ns.bladeburner.getSkillPoints();

    if (levelA / 3 < levelB / 4 && points >= costA) {
      ns.bladeburner.upgradeSkill(SKILL_A);
    } else if (points >= costB) {
      ns.bladeburner.upgradeSkill(SKILL_B);
    }

    await ns.bladeburner.nextUpdate();
  }
}
