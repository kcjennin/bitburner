import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  if (typeof ns.args[0] !== 'number') return;
  const port = ns.args[0];
  const combatMin = 30;
  const ramUpgrade = ns.singularity.getUpgradeHomeRamCost();
  let action = 'none';

  while (true) {
    const {
      skills: { strength, defense, dexterity, agility },
      money,
    } = ns.getPlayer();

    if (strength < combatMin) {
      if (action !== 'str') {
        ns.singularity.gymWorkout('Powerhouse Gym', 'str', true);
        action = 'str';
      }
    } else if (defense < combatMin) {
      if (action !== 'def') {
        ns.singularity.gymWorkout('Powerhouse Gym', 'def', true);
        action = 'def';
      }
    } else if (dexterity < combatMin) {
      if (action !== 'dex') {
        ns.singularity.gymWorkout('Powerhouse Gym', 'dex', true);
        action = 'dex';
      }
    } else if (agility < combatMin) {
      if (action !== 'agi') {
        ns.singularity.gymWorkout('Powerhouse Gym', 'agi', true);
        action = 'agi';
      }
    } else if (money < ramUpgrade) {
      // skills are trained enough, make some money
      if (action !== 'rob') {
        ns.singularity.commitCrime('Rob Store');
        action = 'rob';
      }
    } else {
      break;
    }

    await ns.sleep(1000);
  }

  ns.singularity.stopAction();
  ns.writePort(port, 'hacking-mid');
}
