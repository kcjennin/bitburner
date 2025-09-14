import { AugmentPair, Multipliers, NS } from '@ns';

type Multiplier = keyof Multipliers;

interface Target {
  rep: Multiplier[];
  hack: Multiplier[];
  combat: Multiplier[];
  charisma: Multiplier[];
  crime: Multiplier[];
  bladeburner: Multiplier[];
}

type TargetType = keyof Target;

const TARGET: Target = {
  rep: ['company_rep', 'faction_rep'],
  hack: ['hacking', 'hacking_exp'],
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

function onTarget(ns: NS, augment: string, targets: TargetType[]) {
  const stats = ns.singularity.getAugmentationStats(augment);
  const multTargets = targets.flatMap((t) => TARGET[t]);
  return multTargets.some((t) => stats[t] > 1);
}

export async function main(ns: NS): Promise<void> {
  const { _: targets } = ns.flags([]) as { _: TargetType[] };
  if (!targets.includes('rep')) targets.push('rep');

  let money = ns.getServerMoneyAvailable('home');
  const sleeveNumbers = [0, 1, 2, 3, 4, 5, 6, 7];
  const augs = Array.from(
    new Set(sleeveNumbers.flatMap((si) => ns.sleeve.getSleevePurchasableAugs(si)).map((ap) => JSON.stringify(ap))),
  )
    .map((ap) => JSON.parse(ap) as AugmentPair)
    .filter(({ name }) => onTarget(ns, name, targets))
    .sort((a, b) => a.cost - b.cost);

  augs.forEach(({ name, cost }) => {
    if (cost * sleeveNumbers.length <= money) {
      const purchases = sleeveNumbers.map((sn) => {
        try {
          return ns.sleeve.purchaseSleeveAug(sn, name);
        } catch {
          return false;
        }
      });
      money -= purchases.filter((p) => p).length * cost;
    }
  });
}
