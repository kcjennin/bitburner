import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const target = Number(ns.args[0] ?? 1200);
  const focus = ns.args[1] !== undefined;
  let action = 'none';

  while (true) {
    const {
      skills: { strength, defense, dexterity, agility },
    } = ns.getPlayer();

    if (strength < target) {
      if (action !== 'str') ns.singularity.gymWorkout('Powerhouse Gym', 'str', focus);
      action = 'str';
    } else if (defense < target) {
      if (action !== 'def') ns.singularity.gymWorkout('Powerhouse Gym', 'def', focus);
      action = 'def';
    } else if (dexterity < target) {
      if (action !== 'dex') ns.singularity.gymWorkout('Powerhouse Gym', 'dex', focus);
      action = 'dex';
    } else if (agility < target) {
      if (action !== 'agi') ns.singularity.gymWorkout('Powerhouse Gym', 'agi', focus);
      action = 'agi';
    } else {
      ns.tprint('Finished training.');
      return;
    }

    await ns.sleep(10000);
  }
}
