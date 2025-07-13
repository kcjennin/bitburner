import { GangMemberInfo, NS } from '@ns';

const WARFARE_MULTIPLIER = 2;
const WARFARE_CHANCE = 0.2;
const RESPECT_GOAL = 2e6;

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  let nextTick = undefined;
  let shadowOgis = undefined;

  while (true) {
    const gi = ns.gang.getGangInformation();
    const focusMoney = gi.respect >= RESPECT_GOAL;

    // recruit
    ns.gang.recruitMember(Math.random().toString().slice(2, 4));
    const members = ns.gang.getMemberNames();

    // ascend
    members.forEach((m) => ascendMember(ns, m));

    // warfare
    const ogis = ns.gang.getOtherGangInformation();
    let newTick = false;
    for (const og in ogis) {
      if (og === gi.faction) continue;
      const ogiCurrent = ogis[og];
      const ogiPrev = shadowOgis?.[og] ?? ogiCurrent;

      const powerChanged = ogiCurrent.power != ogiPrev.power;
      const territoryChanged = ogiCurrent.territory != ogiPrev.territory;

      if (powerChanged || territoryChanged) {
        newTick = true;
      }
    }

    if (newTick) {
      if (nextTick) {
        members.forEach((m) => {
          const mi = ns.gang.getMemberInformation(m);
          const task = getTask(ns, m, focusMoney);
          if (mi.task !== task) ns.gang.setMemberTask(m, task);
        });
      }
      nextTick = Date.now() + 19000;
    }

    shadowOgis = ogis;

    if (gi.territory < 1) {
      if (nextTick && Date.now() + 1000 > nextTick) {
        members.forEach((m) => ns.gang.setMemberTask(m, 'Territory Warfare'));
      }

      const engage = gi.power > powerRequirement(ns, gi.faction);
      if (engage !== gi.territoryWarfareEngaged) ns.gang.setTerritoryWarfare(engage);
    } else if (gi.territoryWarfareEngaged) {
      ns.gang.setTerritoryWarfare(false);
    }

    ns.clearLog();
    ns.print(`Focus:           ${focusMoney ? 'Money' : 'Respect'}`);
    ns.print(`Respect:         ${ns.formatNumber(gi.respect)}/${ns.formatNumber(RESPECT_GOAL)}`);
    ns.print(`Power:           ${ns.formatNumber(gi.power)}/${ns.formatNumber(powerRequirement(ns, gi.faction))}`);
    ns.print(`Territory:       ${ns.formatPercent(gi.territory)}`);
    ns.print(`Warfare Enabled: ${gi.territoryWarfareEngaged ? 'Yes' : 'No'}`);
    ns.print(`Next Tick:       ${ns.tFormat((nextTick ?? Date.now()) - Date.now())}`);
    await ns.sleep(1000);
  }
}

function powerRequirement(ns: NS, faction: string, warfareMultiplier = WARFARE_MULTIPLIER): number {
  const others = ns.gang.getOtherGangInformation();
  let powerRequirement = 0;

  for (const other in others) {
    if (other === faction) continue;
    powerRequirement = Math.max(powerRequirement, others[other].power);
  }

  return warfareMultiplier * powerRequirement;
}

function ascendMember(ns: NS, member: string) {
  const info = ns.gang.getMemberInformation(member);
  const ar = ns.gang.getAscensionResult(member);
  if (!ar) return;

  const threshold = ascendThreshold(ns, info);
  if (ar.str >= threshold || ar.def >= threshold || ar.dex >= threshold || ar.agi >= threshold) {
    const respect = Math.max(info.earnedRespect, 1);
    const gRespect = Math.max(12, ns.gang.getGangInformation().respect);
    const ratio = respect / gRespect;
    if (ratio > 1 / 12 && gRespect - respect < RESPECT_GOAL) return;

    ns.gang.ascendMember(member);
  }
}

function ascendThreshold(ns: NS, info: GangMemberInfo): number {
  return 1.66 - 0.62 / Math.exp((2 / info.str_asc_mult) ** 2.24);
}

function getTask(ns: NS, member: string, focusMoney: boolean): string {
  const gi = ns.gang.getGangInformation();
  const mi = ns.gang.getMemberInformation(member);

  let TASKS = [
    'Mug People',
    'Deal Drugs',
    'Strongarm Civilians',
    'Run a Con',
    'Armed Robbery',
    'Traffick Illegal Arms',
    'Threaten & Blackmail',
    'Human Trafficking',
    'Terrorism',
  ];
  if (!focusMoney) TASKS = ['Terrorism'];

  const tasks = [];
  for (const task of TASKS) {
    const stats = ns.gang.getTaskStats(task);
    const money = ns.formulas.gang.moneyGain(gi, mi, stats);
    const respect = ns.formulas.gang.respectGain(gi, mi, stats);
    const wanted = ns.formulas.gang.wantedLevelGain(gi, mi, stats);

    if (!focusMoney && respect <= 0) continue;
    if (focusMoney && money <= 0) continue;
    if (wanted > respect / 2) continue;
    tasks.push({ task, money, respect });
  }

  if (tasks.length > 1) {
    const sortKey = focusMoney ? 'money' : 'respect';
    tasks.sort((a, b) => b[sortKey] - a[sortKey]);
  } else if (tasks.length === 0) {
    tasks.push({ task: 'Train Combat' });
  }

  return tasks[0].task;
}
