import {
  BladeburnerActionName,
  BladeburnerActionType,
  BladeburnerContractName,
  BladeburnerCurAction,
  NS,
  SleeveBladeburnerTask,
  SleeveClassTask,
  SleeveInfiltrateTask,
} from '@ns';
import { improveSleeve } from '@/sleeve/improve-sleeve';

type TaskStats = {
  name: BladeburnerActionName;
  type: BladeburnerActionType;
  time: number;
  remaining: number;
  rank: number;
  chance: [number, number];
};

const SLEEVES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

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

function trySleevesContracts(ns: NS): number[] {
  const contracts = ['Tracking', 'Bounty Hunter', 'Retirement'] as BladeburnerContractName[];
  const contractSleeves: number[] = [];
  const runningContracts = SLEEVES.map((sn) => {
    const task = ns.sleeve.getTask(sn);
    const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'other';
    if (
      contracts.includes(actionName as BladeburnerContractName) &&
      ns.bladeburner.getActionEstimatedSuccessChance('Contracts', actionName as BladeburnerContractName, sn)[0] > 0.99
    )
      contractSleeves.push(sn);
    return actionName;
  }).filter((an) => contracts.includes(an as BladeburnerContractName));

  contracts
    .filter((c) => !runningContracts.includes(c))
    .forEach((c) => {
      for (const sn of SLEEVES) {
        // we've already started this sleeve on a contract
        if (contractSleeves.includes(sn)) continue;

        // not previously running a contract, start it
        if (ns.bladeburner.getActionEstimatedSuccessChance('Contracts', c, sn)[0] > 0.99) {
          // if there aren't a lot of remaining tasks infiltrate instead of doing the contract
          if (ns.bladeburner.getActionCountRemaining('Contracts', c) < 200) {
            const task = ns.sleeve.getTask(sn);
            if (task?.type !== 'INFILTRATE') ns.sleeve.setToBladeburnerAction(sn, 'Infiltrate Synthoids');
          } else {
            ns.sleeve.setToBladeburnerAction(sn, 'Take on contracts', c);
          }
          contractSleeves.push(sn);
          break;
        }
      }
    });

  return contractSleeves;
}

function setSleeves(
  ns: NS,
  action: 'Field Analysis' | 'Infiltrate Synthoids' | 'Diplomacy' | 'Hyperbolic Regeneration Chamber' | 'improve',
  excludes: number[] = [],
): void {
  const skills = ['Algorithms', 'str', 'def', 'dex', 'agi', 'Leadership'];

  for (const sn of SLEEVES) {
    if (excludes.includes(sn)) continue;
    const task = ns.sleeve.getTask(sn) as SleeveBladeburnerTask | SleeveInfiltrateTask | SleeveClassTask | null;

    if (action === 'improve') {
      if (ns.getServerMoneyAvailable('home') < 100e6) {
        const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'class';
        if (actionName !== 'Training') ns.sleeve.setToBladeburnerAction(sn, 'Training');
      } else {
        const classType = task?.type === 'CLASS' ? (task as SleeveClassTask).classType : 'bladeburner';
        let sIdx = skills.indexOf(classType);

        // if we're alreadying improving go to the next skill
        if (sIdx > -1) {
          sIdx = (sIdx + 1) % skills.length;
        } else {
          // not improving yet, start from a random index
          sIdx = Math.floor(Math.random() * skills.length);
        }

        if (skills[sIdx] === 'Algorithms') {
          improveSleeve(ns, sn, 'hack');
        } else if (skills[sIdx] === 'Leadership') {
          improveSleeve(ns, sn, 'cha');
        } else {
          improveSleeve(ns, sn, skills[sIdx]);
        }
      }
    } else if (action === 'Infiltrate Synthoids') {
      if (task?.type !== 'INFILTRATE') ns.sleeve.setToBladeburnerAction(sn, 'Infiltrate Synthoids');
    } else {
      const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'class';
      if (actionName !== action) ns.sleeve.setToBladeburnerAction(sn, action);
    }
  }
}

function doSleeves(ns: NS, tasks: TaskStats[], rested: boolean) {
  if (
    tasks.some(({ name, chance: [low, high] }) => {
      if (low < high - 1e-4) {
        ns.print(`Contract ${name} is not guaranteed.`);
        return true;
      }
      return false;
    })
  ) {
    setSleeves(ns, 'Field Analysis');
  } else if (tasks.some(({ remaining }) => remaining < 100)) {
    setSleeves(ns, 'Infiltrate Synthoids');
  } else if (ns.bladeburner.getCityChaos(ns.bladeburner.getCity()) > 50) {
    setSleeves(ns, 'Diplomacy');
  } else if (!rested) {
    setSleeves(ns, 'Hyperbolic Regeneration Chamber');
  } else {
    const contractSleeves = trySleevesContracts(ns);
    setSleeves(ns, 'improve', contractSleeves);
  }
}

function doPlayer(ns: NS, tasks: TaskStats[], rested: boolean, endTime: number) {
  if (Date.now() >= endTime) {
    const action = ns.bladeburner.getCurrentAction();
    let task = REST_TASK;
    task.time = ns.bladeburner.getActionTime(task.type, task.name);

    if (rested) {
      const filteredTasks = tasks
        .filter(({ remaining, chance }) => remaining >= 1 && chance[0] > 0.3)
        .sort(({ rank: aR, time: aT }, { rank: bR, time: bT }) => bR / bT - aR / aT);

      if (filteredTasks[0]) task = filteredTasks[0];
    }

    if (action?.name !== task.name) {
      ns.bladeburner.startAction(task.type, task.name);
      endTime = Date.now() + task.time + 20;
    } else {
      endTime += task.time;
    }
  }

  return endTime;
}

export async function main(ns: NS): Promise<void> {
  const { noSleeves, noPlayer } = ns.flags([
    ['noSleeves', false], // 27.6 GB
    ['noPlayer', false], //  44.6 GB
  ]) as {
    noSleeves: boolean;
    noPlayer: boolean;
  };
  if (noSleeves && noPlayer) {
    ns.tprint('Cannot combine arguments: --noSleeves, --noPlayer');
    ns.exit();
  }

  // if (noSleeves) {
  //   ns.ramOverride(27.6);
  // } else if (noPlayer) {
  //   ns.ramOverride(44.6);
  // }

  ns.disableLog('ALL');
  ns.clearLog();

  let rested = false,
    endTime = 0;
  while (true) {
    // choose the best task for rank
    const tasks: TaskStats[] = TASKS.map(([type, name]) => {
      return {
        name,
        type,
        time: ns.bladeburner.getActionTime(type, name),
        remaining: ns.bladeburner.getActionCountRemaining(type, name),
        rank:
          ns.bladeburner.getActionRepGain(type, name, 1) *
          ns.bladeburner.getActionEstimatedSuccessChance(type, name)[0],
        chance: ns.bladeburner.getActionEstimatedSuccessChance(type, name),
      };
    });

    const [current, max] = ns.bladeburner.getStamina();
    const staminaPct = current / max;
    if (rested && staminaPct < 0.6) rested = false;
    else if (!rested && staminaPct > 0.95) rested = true;

    if (!noSleeves) doSleeves(ns, tasks, rested);
    if (!noPlayer) endTime = doPlayer(ns, tasks, rested, endTime);

    await ns.bladeburner.nextUpdate();
  }
}
