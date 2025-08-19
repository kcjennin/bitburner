import { GangMemberInfo, GangTaskStats, NS } from '@ns';

const CLASH_THRESHOLD = 0.55;
const BONUS_WARFARE_CHANCE = 0.4;
const RESPECT_GOAL = 2e6;

export async function main(ns: NS): Promise<void> {
  const { noGui } = ns.flags([['noGui', false]]) as { noGui: boolean };
  ns.disableLog('ALL');
  if (!noGui) ns.ui.openTail();

  let nextTick = undefined;
  let shadowOgis = undefined;

  while (true) {
    const gi = ns.gang.getGangInformation();

    // recruit
    ns.gang.recruitMember(Math.random().toString().slice(2, 4));
    const members = ns.gang.getMemberNames();

    const focusMoney = gi.respect > RESPECT_GOAL;

    // ascend
    members.forEach((m) => ascendMember(ns, m, members.length));

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
          const task = chooseTask(ns, m, focusMoney);
          if (mi.task !== task) ns.gang.setMemberTask(m, task);
        });
      }
      nextTick = Date.now() + 19000;
    }

    shadowOgis = ogis;

    if (gi.territory < 1) {
      if (nextTick && Date.now() + 1000 > nextTick) {
        members.forEach((m) => ns.gang.setMemberTask(m, 'Territory Warfare'));
      } else if (ns.gang.getBonusTime() > 10000) {
        members
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .filter((_) => Math.random() <= BONUS_WARFARE_CHANCE)
          .forEach((m) => ns.gang.setMemberTask(m, 'Territory Warfare'));
      }

      const engage = worstClash(ns, gi.faction) >= CLASH_THRESHOLD;
      if (engage !== gi.territoryWarfareEngaged) ns.gang.setTerritoryWarfare(engage);
    } else if (gi.territoryWarfareEngaged) {
      ns.gang.setTerritoryWarfare(false);
    }

    ns.clearLog();
    ns.print(`Focus:           ${focusMoney ? 'Money' : 'Respect'}`);
    ns.print(
      `Respect:         ${ns.formatNumber(gi.respect)}${!focusMoney ? '/' + ns.formatNumber(RESPECT_GOAL) : ''}`,
    );
    ns.print(`Worst Clash:     ${ns.formatPercent(worstClash(ns, gi.faction), 0)}`);
    ns.print(`Territory:       ${ns.formatPercent(gi.territory, 2)}`);
    ns.print(`Warfare Enabled: ${gi.territoryWarfareEngaged ? 'Yes' : 'No'}`);
    ns.print(`Next Tick:       ${ns.tFormat(Math.max(0, (nextTick ?? Date.now()) - Date.now()))}`);
    await ns.sleep(1000);
  }
}

function worstClash(ns: NS, faction: string): number {
  const others = ns.gang.getOtherGangInformation();
  let lowestChance = Infinity;

  for (const other in others) {
    if (other === faction) continue;
    lowestChance = Math.min(lowestChance, ns.gang.getChanceToWinClash(other));
  }

  return lowestChance;
}

function ascendMember(ns: NS, member: string, gangSize: number) {
  const info = ns.gang.getMemberInformation(member);
  const ar = ns.gang.getAscensionResult(member);
  if (!ar) return;

  const threshold = ascendThreshold(ns, info);
  if (ar.str >= threshold || ar.def >= threshold || ar.dex >= threshold || ar.agi >= threshold) {
    const respect = Math.max(info.earnedRespect, 1);
    const gRespect = Math.max(12, ns.gang.getGangInformation().respect);
    const ratio = respect / gRespect;
    // if we're between 6 and 11 members, don't reset if this member
    // is contributing most of our respect
    if (gangSize >= 6 && gangSize < 12 && ratio > 1 / 12) return;

    ns.gang.ascendMember(member);
  }
}

function ascendThreshold(ns: NS, info: GangMemberInfo): number {
  return 1.66 - 0.62 / Math.exp((2 / info.str_asc_mult) ** 2.24);
}

function chooseTask(ns: NS, member: string, focusMoney: boolean): string {
  const gi = ns.gang.getGangInformation();
  const mi = ns.gang.getMemberInformation(member);

  const taskInfos = [
    'Mug People',
    'Deal Drugs',
    'Strongarm Civilians',
    'Run a Con',
    'Armed Robbery',
    'Traffick Illegal Arms',
    'Threaten & Blackmail',
    'Human Trafficking',
    'Terrorism',
  ].map((task) => {
    const stats = ns.gang.getTaskStats(task);
    const money = ns.formulas.gang.moneyGain(gi, mi, stats);
    const respect = ns.formulas.gang.respectGain(gi, mi, stats);
    return { task, stats, money, respect };
  });

  // Terrorism and Human Trafficking are best, so either do them
  // or train for them.
  let respectTask: string, respectStats: GangTaskStats;
  if (ns.gang.getMemberNames().length >= 6) {
    respectTask = 'Terrorism';
    respectStats = ns.gang.getTaskStats(respectTask);
  } else {
    ({ task: respectTask, stats: respectStats } = taskInfos.reduce((bestT, t) =>
      t.respect > bestT.respect ? t : bestT,
    ));
  }
  const { task: moneyTask, stats: moneyStats } = taskInfos.reduce((bestT, t) => (t.money > bestT.money ? t : bestT));

  const task = focusMoney ? moneyTask : respectTask;
  const stats = focusMoney ? moneyStats : respectStats;
  const wanted = ns.formulas.gang.wantedLevelGain(gi, mi, stats);
  const respect = ns.formulas.gang.respectGain(gi, mi, stats);
  const money = ns.formulas.gang.moneyGain(gi, mi, stats);

  if ((focusMoney ? money : respect) > 0 && wanted <= respect / 2) {
    // If we can do best without getting too much wanted level, do it
    return task;
  } else {
    // If we have too much penalty, do VJ instead of training
    if (gi.wantedLevel > 2 && gi.wantedPenalty < 0.99) return 'Vigilante Justice';

    // Otherwise train for best
    const worstStat = Math.min(
      mi.hack * stats.hackWeight,
      mi.str * stats.strWeight,
      mi.def * stats.defWeight,
      mi.dex * stats.dexWeight,
      mi.agi * stats.agiWeight,
      mi.cha * stats.chaWeight,
    );

    if (mi.hack * stats.hackWeight === worstStat) {
      return 'Train Hacking';
    } else if (mi.cha * stats.chaWeight === worstStat) {
      return 'Train Charisma';
    } else {
      return 'Train Combat';
    }
  }
}
