import { Multipliers, NS } from '@ns';

type Multiplier = keyof Multipliers;

interface Target {
  rep: Multiplier[];
  hack: Multiplier[];
  combat: Multiplier[];
  charisma: Multiplier[];
  crime: Multiplier[];
  bladeburner: Multiplier[];
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
} as const;

type TargetType = keyof Target;

function onTarget(ns: NS, augment: string, targets: TargetType[]) {
  const stats = ns.singularity.getAugmentationStats(augment);
  const multTargets = targets.flatMap((t) => TARGET[t]);
  return multTargets.some((t) => stats[t] > 1);
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
  const owned = ns.singularity.getOwnedAugmentations(true);

  const available: { name: string; faction: string; rep: number; cost: number; prereqs: string[] }[] = [];
  for (const faction of po.factions) {
    const totalRep = cliRep > 0 ? cliRep : ns.singularity.getFactionRep(faction);
    const factionAugs = ns.singularity
      .getAugmentationsFromFaction(faction)
      .filter(
        (a) =>
          a !== 'NeuroFlux Governor' &&
          !owned.includes(a) &&
          !available.find(({ name }) => name === a) &&
          onTarget(ns, a, skillTargets),
      )
      .map((a) => ({
        name: a,
        faction,
        rep: ns.singularity.getAugmentationRepReq(a),
        cost: ns.singularity.getAugmentationPrice(a),
        prereqs: ns.singularity.getAugmentationPrereq(a),
      }))
      .filter(({ rep, cost }) => rep <= totalRep && cost <= money);
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

      if (!n) ns.singularity.purchaseAugmentation(faction, name);
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
        const cost = ns.singularity.getAugmentationPrice('NeuroFlux Governor');
        ns.tprint(cost);
        if (cost > money) break;

        if (!n) ns.singularity.purchaseAugmentation(mostRep, 'NeuroFlux Governor');
        money -= cost;
        nfCount++;
        await ns.sleep(0);
      }

      if (nfCount > 0) output.push(`  - NeuroFlux Governor (${nfCount})`);
    }
  }

  output.push(`Spent $${ns.formatNumber(moneyBefore - (n ? money : ns.getServerMoneyAvailable('home')))}.`);
  ns.tprint(output.join('\n'));
}
