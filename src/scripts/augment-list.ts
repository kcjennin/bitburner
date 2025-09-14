import { Multipliers, NS, ScriptArg } from '@ns';

type Multiplier = keyof Multipliers;
type TargetType = keyof Target;
type OperationType = 'stats' | 'owned' | 'faction' | 'prereq' | 'purchase' | 'repReq' | 'price';

interface Target {
  rep: Multiplier[];
  hack: Multiplier[];
  combat: Multiplier[];
  charisma: Multiplier[];
  crime: Multiplier[];
  bladeburner: Multiplier[];
  hacknet: Multiplier[];
}

const TARGET: Target = {
  rep: ['company_rep', 'faction_rep'],
  hack: ['hacking_chance', 'hacking_speed', 'hacking_money', 'hacking_grow', 'hacking', 'hacking_exp'],
  combat: [
    'strength',
    'strength_exp',
    'defense',
    'defense_exp',
    'dexterity',
    'dexterity_exp',
    'agility',
    'agility_exp',
  ],
  charisma: ['charisma', 'charisma_exp'],
  crime: ['crime_success', 'crime_money'],
  bladeburner: [
    'bladeburner_max_stamina',
    'bladeburner_stamina_gain',
    'bladeburner_analysis',
    'bladeburner_success_chance',
  ],
  hacknet: [
    'hacknet_node_money',
    'hacknet_node_purchase_cost',
    'hacknet_node_ram_cost',
    'hacknet_node_core_cost',
    'hacknet_node_level_cost',
  ],
} as const;

const ALWAYS_BUY = ['CashRoot Starter Kit', 'Neuroreceptor Management Implant'];

async function onTarget(ns: NS, augment: string, targets: TargetType[]) {
  const stats = await operation(ns, 'stats', augment);
  const multTargets = targets.flatMap((t) => TARGET[t]);
  return multTargets.some((t) => stats[t] > 1) || ALWAYS_BUY.includes(augment);
}

async function operation(ns: NS, action: OperationType, ...args: ScriptArg[]) {
  const jobPid = ns.run(`/singularity/workers/${action}.js`, 1, ...args);
  if (jobPid === 0) throw 'Failed to make transaction. Not enough RAM?';
  const jobPort = ns.getPortHandle(jobPid);

  if (jobPort.empty()) await jobPort.nextWrite();
  return JSON.parse(jobPort.read());
}

export async function main(ns: NS): Promise<void> {
  const {
    m: cliMoney,
    r: cliRep,
    n,
    _: skillTargets,
  } = ns.flags([
    ['m', -1],
    ['r', -1],
    ['n', false],
  ]) as { m: number; r: number; n: boolean; _: TargetType[] };
  if (!skillTargets.includes('rep')) skillTargets.push('rep');

  const po = ns.getPlayer();
  let money = cliMoney > 0 ? cliMoney : po.money;
  const owned = await operation(ns, 'owned');

  const available: { name: string; faction: string; rep: number; cost: number; prereqs: string[] }[] = [];
  for (const faction of po.factions) {
    const totalRep = cliRep > 0 ? cliRep : ns.singularity.getFactionRep(faction);
    const augsFromFaction = [];
    for (const a of await operation(ns, 'faction', faction)) {
      if (
        a !== 'NeuroFlux Governor' &&
        !owned.includes(a) &&
        !available.find(({ name }) => name === a) &&
        (await onTarget(ns, a, skillTargets))
      ) {
        augsFromFaction.push(a);
      }
    }

    const factionAugs: { name: string; faction: string; rep: number; cost: number; prereqs: string[] }[] = [];
    for (const a of augsFromFaction) {
      const aInfo = {
        name: a,
        faction,
        rep: (await operation(ns, 'repReq', a)) as number,
        cost: (await operation(ns, 'price', a)) as number,
        prereqs: (await operation(ns, 'prereq', a)) as string[],
      };

      if (aInfo.rep <= totalRep && aInfo.cost <= money) factionAugs.push(aInfo);
    }
    available.push(...factionAugs);
  }
  available.sort((a, b) => b.cost - a.cost);

  ns.tprint(`${available.length} augments available.`);

  const moneyBefore = money;
  const output = ['\nPurchased:'];

  let madePurchase;
  const neededPrereqs: string[] = [];
  do {
    madePurchase = false;
    for (let idx = 0; idx < available.length; ++idx) {
      const { name, faction, cost, prereqs } = available[idx];
      if (owned.includes(name)) continue;
      // skip for now if we don't have the prereqs
      if (prereqs.some((p) => !owned.includes(p))) {
        neededPrereqs.push(...prereqs.filter((p) => !owned.includes(p) && !neededPrereqs.includes(p)));
        continue;
      }
      if (cost > money) continue;

      if (!n) await operation(ns, 'purchase', faction, name);
      madePurchase = true;
      owned.push(name);
      output.push(`  - ${name}`);
      money -= cost;
      for (let jdx = idx + 1; jdx < available.length; ++jdx) {
        available[jdx].cost *= 1.9;
      }

      // if this was one of the prereqs we needed, break out and start from the top
      const npIdx = neededPrereqs.indexOf(name);
      if (npIdx > -1) {
        neededPrereqs.splice(npIdx, 1);
        break;
      }
    }
  } while (madePurchase);

  // too complicated to predict NFG purchases
  if (!n) {
    const mostRep = po.factions.sort((a, b) => ns.singularity.getFactionRep(a) - ns.singularity.getFactionRep(b)).at(0);
    if (mostRep !== undefined) {
      let nfCount = 0;
      while (true) {
        const cost = await operation(ns, 'price', 'NeuroFlux Governor');
        ns.tprint(cost);
        if (cost > money) break;

        if (!n) await operation(ns, 'purchase', mostRep, 'NeuroFlux Governor');
        money -= cost;
        nfCount++;
        await ns.sleep(0);
      }

      if (nfCount > 0) output.push(`  - NeuroFlux Governor (${nfCount})`);
    }
  }

  output.push(`Spent $${ns.formatNumber(moneyBefore - (n ? money : ns.getPlayer().money))}.`);
  ns.tprint(output.join('\n'));
}
