import {
  BladeburnerActionName,
  BladeburnerActionType,
  BladeburnerBlackOpName,
  BladeburnerContractName,
  BladeburnerCurAction,
  CityName,
  NS,
  SleeveBladeburnerTask,
  SleeveClassTask,
  SleeveInfiltrateTask,
} from '@ns';
import { improveSleeve } from '@/sleeve/improve-sleeve';
import { dodge } from '@/lib/dodge';

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

function initializeHUD(ns: NS) {
  const d = eval('document') as Document;
  const theme = ns.ui.getTheme();

  let staminaHtmlDisplay = d.getElementById('stamina-display-1');
  let rankHtmlDisplay = d.getElementById('rank-display-1');
  if (staminaHtmlDisplay !== null && rankHtmlDisplay !== null) {
    return { stamina: staminaHtmlDisplay, rank: rankHtmlDisplay };
  }

  const hpTableRow = d.getElementById('overview-hp-hook')?.parentElement?.parentElement;
  const extraTableRow = d.getElementById('overview-extra-hook-0')?.parentElement?.parentElement;
  if (!hpTableRow || !extraTableRow) throw 'Failed to get custom elements.';

  const staminaTableRow = hpTableRow.cloneNode(true) as HTMLElement;
  staminaTableRow.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  staminaTableRow.querySelectorAll('p').forEach((el, i) => (el.id = `stamina-display-${i}`));

  staminaHtmlDisplay = staminaTableRow.querySelector('#stamina-display-1') as HTMLElement;
  staminaTableRow.querySelectorAll('p')[0].innerText = 'Stamina';
  staminaTableRow.querySelectorAll('p')[0].style.color = theme['hp'];
  staminaHtmlDisplay.innerText = '0.000 / 0.000';
  staminaHtmlDisplay.style.color = theme['hp'];

  const rankTableRow = extraTableRow.cloneNode(true) as HTMLElement;
  rankTableRow.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  rankTableRow.querySelectorAll('p').forEach((el, i) => (el.id = `rank-display-${i}`));

  rankHtmlDisplay = rankTableRow.querySelector('#rank-display-1') as HTMLElement;
  rankTableRow.querySelectorAll('p')[0].innerText = 'Rank';
  rankHtmlDisplay.innerText = '0.000';

  hpTableRow.after(staminaTableRow);
  extraTableRow.before(rankTableRow);

  return { stamina: staminaHtmlDisplay, rank: rankHtmlDisplay };
}

async function trySleevesContracts(ns: NS): Promise<number[]> {
  const contracts = ['Tracking', 'Bounty Hunter', 'Retirement'] as BladeburnerContractName[];
  const contractSleeves: number[] = [];
  const runningContracts: string[] = [];
  for (const sn of SLEEVES) {
    const task = await dodge({ ns, command: `ns.sleeve.getTask(${sn})` });
    const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'other';
    if (contracts.includes(actionName as BladeburnerContractName)) {
      const chance = (await dodge({
        ns,
        command: `ns.bladeburner.getActionEstimatedSuccessChance('Contracts', '${actionName}', ${sn})`,
      })) as [number, number];
      if (chance[0] > 0.99) contractSleeves.push(sn);
      runningContracts.push(actionName);
    }
  }

  for (const c of contracts) {
    if (runningContracts.includes(c)) continue;
    for (const sn of SLEEVES) {
      // we've already started this sleeve on a contract
      if (contractSleeves.includes(sn)) continue;

      // not previously running a contract, start it
      const chance = (await dodge({
        ns,
        command: `ns.bladeburner.getActionEstimatedSuccessChance('Contracts', '${c}', ${sn})`,
      })) as [number, number];
      if (chance[0] > 0.99) {
        // if there aren't a lot of remaining tasks infiltrate instead of doing the contract
        const remaining = (await dodge({
          ns,
          command: `ns.bladeburner.getActionCountRemaining('Contracts', '${c}')`,
        })) as number;
        if (remaining < 200) {
          const task = await dodge({ ns, command: `ns.sleeve.getTask(${sn})` });
          if (task?.type !== 'INFILTRATE')
            await dodge({ ns, command: `ns.sleeve.setToBladeburnerAction(${sn}, 'Infiltrate Synthoids')` });
        } else {
          await dodge({ ns, command: `ns.sleeve.setToBladeburnerAction(${sn}, 'Take on contracts', '${c}')` });
        }
        contractSleeves.push(sn);
        break;
      }
    }
  }

  return contractSleeves;
}

async function setSleeves(
  ns: NS,
  action: 'Field Analysis' | 'Infiltrate Synthoids' | 'Diplomacy' | 'Hyperbolic Regeneration Chamber' | 'improve',
  excludes: number[] = [],
): Promise<void> {
  const skills = ['Algorithms', 'str', 'def', 'dex', 'agi', 'Leadership'];

  for (const sn of SLEEVES) {
    if (excludes.includes(sn)) continue;
    const task = (await dodge({ ns, command: `ns.sleeve.getTask(${sn})` })) as
      | SleeveBladeburnerTask
      | SleeveInfiltrateTask
      | SleeveClassTask
      | null;

    if (action === 'improve') {
      if (ns.getServerMoneyAvailable('home') < 100e6) {
        const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'class';
        if (actionName !== 'Training')
          await dodge({ ns, command: `ns.sleeve.setToBladeburnerAction(${sn}, 'Training')` });
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
          await improveSleeve(ns, sn, 'hack');
        } else if (skills[sIdx] === 'Leadership') {
          await improveSleeve(ns, sn, 'cha');
        } else {
          await improveSleeve(ns, sn, skills[sIdx]);
        }
      }
    } else if (action === 'Infiltrate Synthoids') {
      if (task?.type !== 'INFILTRATE')
        await dodge({ ns, command: `ns.sleeve.setToBladeburnerAction(${sn}, 'Infiltrate Synthoids')` });
    } else {
      const actionName = task?.type === 'BLADEBURNER' ? (task as SleeveBladeburnerTask).actionName : 'class';
      if (actionName !== action) await dodge({ ns, command: `ns.sleeve.setToBladeburnerAction(${sn}, '${action}')` });
    }
  }
}

async function doSleeves(ns: NS, tasks: TaskStats[], rested: boolean) {
  const city = (await dodge({ ns, command: `ns.bladeburner.getCity()` })) as CityName;
  const chaos = (await dodge({ ns, command: `ns.bladeburner.getCityChaos('${city}')` })) as number;
  if (
    tasks.some(({ name, chance: [low, high] }) => {
      if (low < high - 1e-4) {
        ns.print(`Contract ${name} is not guaranteed.`);
        return true;
      }
      return false;
    })
  ) {
    await setSleeves(ns, 'Field Analysis');
  } else if (
    tasks.some(({ type, name, remaining }) => type !== 'Black Operations' && name !== 'Training' && remaining < 100)
  ) {
    await setSleeves(ns, 'Infiltrate Synthoids');
  } else if (chaos > 50) {
    await setSleeves(ns, 'Diplomacy');
  } else if (!rested) {
    await setSleeves(ns, 'Hyperbolic Regeneration Chamber');
  } else {
    const contractSleeves = await trySleevesContracts(ns);
    await setSleeves(ns, 'improve', contractSleeves);
  }
}

async function doPlayer(ns: NS, tasks: TaskStats[], rested: boolean, endTime: number) {
  let task = REST_TASK;
  if (Date.now() >= endTime) {
    const action = (await dodge({ ns, command: `ns.bladeburner.getCurrentAction()` })) as BladeburnerCurAction | null;
    task.time = (await dodge({
      ns,
      command: `ns.bladeburner.getActionTime('${task.type}', '${task.name}')`,
    })) as number;

    if (rested) {
      const filteredTasks = tasks
        .filter(({ type, remaining, chance }) => remaining >= 1 && chance[0] > 0.3 && type !== 'Black Operations')
        .sort(({ rank: aR, time: aT }, { rank: bR, time: bT }) => bR / bT - aR / aT);

      if (filteredTasks[0]) task = filteredTasks[0];
    }

    if (action?.name !== task.name) {
      await dodge({ ns, command: `ns.bladeburner.startAction('${task.type}', '${task.name}')` });
      endTime = Date.now() + task.time + 20;
    } else {
      endTime += task.time;
    }
  }

  return { endTime, name: task.name };
}

async function createTask(ns: NS, type: BladeburnerActionType, name: BladeburnerActionName): Promise<TaskStats> {
  const time = (await dodge({ ns, command: `ns.bladeburner.getActionTime('${type}', '${name}')` })) as number;
  const remaining = (await dodge({
    ns,
    command: `ns.bladeburner.getActionCountRemaining('${type}', '${name}')`,
  })) as number;
  const repGain = (await dodge({ ns, command: `ns.bladeburner.getActionRepGain('${type}', '${name}')` })) as number;
  const chance = (await dodge({
    ns,
    command: `ns.bladeburner.getActionEstimatedSuccessChance('${type}', '${name}')`,
  })) as [number, number];
  return {
    name,
    type,
    time,
    remaining,
    rank: repGain * chance[0],
    chance,
  };
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

  const hud = initializeHUD(ns);
  ns.atExit(() => {
    hud.stamina.parentElement?.parentElement?.parentElement?.removeChild(hud.stamina.parentElement?.parentElement);
    hud.rank.parentElement?.parentElement?.parentElement?.removeChild(hud.rank.parentElement?.parentElement);
  });

  let rested = false,
    endTime = 0,
    name: string;
  while (true) {
    // choose the best task for rank
    const tasks: TaskStats[] = [];
    for (const [type, name] of TASKS) {
      tasks.push(await createTask(ns, type, name));
    }

    const { name: boName } = ((await dodge({ ns, command: `ns.bladeburner.getNextBlackOp()` })) as {
      name: BladeburnerBlackOpName;
      rank: number;
    } | null) ?? { name: '' };
    if (boName !== '') tasks.push(await createTask(ns, 'Black Operations' as BladeburnerActionType, boName));

    const [current, max] = (await dodge({ ns, command: `ns.bladeburner.getStamina()` })) as [number, number];
    const staminaPct = current / max;
    if (rested && staminaPct < 0.6) rested = false;
    else if (!rested && staminaPct > 0.95) rested = true;

    hud.stamina.innerText = `${ns.formatNumber(Math.round(current), 3, 1000, true)} / ${ns.formatNumber(
      Math.round(max),
      3,
      1000,
      true,
    )}`;

    const rank = (await dodge({ ns, command: `ns.bladeburner.getRank()` })) as number;
    hud.rank.innerText = `${ns.formatNumber(rank)}`;

    if (!noSleeves) await doSleeves(ns, tasks, rested);
    if (!noPlayer) {
      ({ endTime, name } = await doPlayer(ns, tasks, rested, endTime));
      if (name === 'Hyperbolic Regeneration Chamber' && rested) endTime = Date.now();
    }

    await ns.bladeburner.nextUpdate();
  }
}
