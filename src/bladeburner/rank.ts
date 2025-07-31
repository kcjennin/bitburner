import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns';

type TaskStats = {
  name: BladeburnerActionName;
  type: BladeburnerActionType;
  time: number;
  remaining: number;
  rank: number;
  chance: [number, number];
};

const TASKS: [BladeburnerActionType, BladeburnerActionName][] = [
  ['General' as BladeburnerActionType, 'Training' as BladeburnerActionName],
  ['Contracts' as BladeburnerActionType, 'Tracking' as BladeburnerActionName],
  ['Contracts' as BladeburnerActionType, 'Bounty Hunter' as BladeburnerActionName],
  ['Operations' as BladeburnerActionType, 'Investigation' as BladeburnerActionName],
  ['Operations' as BladeburnerActionType, 'Undercover Operation' as BladeburnerActionName],
  ['Operations' as BladeburnerActionType, 'Assassination' as BladeburnerActionName],
];
const REST_TASK: TaskStats = {
  name: 'Hyperbolic Regeneration Chamber' as BladeburnerActionName,
  type: 'General' as BladeburnerActionType,
  time: 0,
  remaining: Infinity,
  rank: 0,
  chance: [1, 1],
};

export async function main(ns: NS): Promise<void> {
  let action = undefined;
  let rested = false;
  while (true) {
    const [current, max] = ns.bladeburner.getStamina();
    const staminaPct = current / max;
    if (rested && staminaPct < 0.6) rested = false;
    else if (!rested && staminaPct > 0.85) rested = true;

    let task = REST_TASK;
    task.time = ns.bladeburner.getActionTime(task.type, task.name);

    if (rested) {
      const tasks = TASKS.map(([type, name]) => {
        return {
          name,
          type,
          time: ns.bladeburner.getActionTime(type, name),
          remaining: ns.bladeburner.getActionCountRemaining(type, name),
          rank: ns.bladeburner.getActionRepGain(type, name, 1),
          chance: ns.bladeburner.getActionEstimatedSuccessChance(type, name),
        };
      })
        .filter(({ remaining, chance }) => remaining > 0 && (chance[0] > 0.6 || (chance[1] === 1 && chance[0] > 0.4)))
        .sort((a, b) => b.rank / b.time - a.rank / a.time);

      task = tasks[0];
    }

    if (action !== task.name) {
      ns.bladeburner.startAction(task.type, task.name);
      action = task.name;
    }

    await ns.sleep(task.time);
  }
}
