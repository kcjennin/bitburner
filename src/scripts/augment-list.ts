import { FactionName, NS } from '@ns';

interface Augment {
  name: string;
  factions: FactionName[];
  cost: number;
  rep: number;
  stats: {
    hacking_chance: number;
    hacking_speed: number;
    hacking_money: number;
    hacking_grow: number;
    hacking: number;
    hacking_exp: number;
    strength: number;
    strength_exp: number;
    defense: number;
    defense_exp: number;
    dexterity: number;
    dexterity_exp: number;
    agility: number;
    agility_exp: number;
    charisma: number;
    charisma_exp: number;
    hacknet_node_money: number;
    hacknet_node_purchase_cost: number;
    hacknet_node_ram_cost: number;
    hacknet_node_core_cost: number;
    hacknet_node_level_cost: number;
    company_rep: number;
    faction_rep: number;
    work_money: number;
    crime_success: number;
    crime_money: number;
    bladeburner_max_stamina: number;
    bladeburner_stamina_gain: number;
    bladeburner_analysis: number;
    bladeburner_success_chance: number;
  };
  prereqs: string[];
}

export async function main(ns: NS): Promise<void> {
  const { money, names, buyPath } = ns.flags([
    ['money', ns.getServerMoneyAvailable('home')],
    ['names', false],
    ['buyPath', false],
  ]) as { money: number; names: boolean; buyPath: boolean };

  const augments = JSON.parse(ns.read('/data/augments.json')) as Augment[];
  const owned = ns.singularity.getOwnedAugmentations(true);

  const wanted = augments
    .filter((a) => {
      a.cost *= ns.getBitNodeMultipliers().AugmentationMoneyCost;
      a.rep *= ns.getBitNodeMultipliers().AugmentationRepCost;
      return (
        (a.stats.hacking > 1 ||
          a.stats.hacking_chance > 1 ||
          a.stats.hacking_exp > 1 ||
          a.stats.hacking_grow > 1 ||
          a.stats.hacking_money > 1 ||
          a.stats.hacking_speed > 1 ||
          a.stats.faction_rep > 1 ||
          a.name == 'CashRoot Starter Kit') &&
        a.cost <= money &&
        !owned.includes(a.name) &&
        a.prereqs.every((pr) => owned.includes(pr))
      );
    })
    .sort((a, b) => a.cost - b.cost);

  if (buyPath) {
    let totalCost = Infinity,
      ignore = 0;
    while (totalCost > money) {
      totalCost = 0;
      for (let i = wanted.length - ignore - 1, mult = 1; i >= 0; --i) {
        totalCost += wanted[i].cost * mult;
        mult *= 2;
      }

      ignore += 1;
      if (ignore === wanted.length) {
        ns.tprint(`Can't purchase any augments.`);
        ns.exit();
      }
    }

    ns.tprint(`Total cost of augments: $${ns.formatNumber(totalCost)}`);
    wanted
      .slice(0, -ignore)
      .reverse()
      .forEach((a) => {
        ns.tprint(`|-- ${a.name}`);
      });
  } else {
    wanted.forEach((a) => {
      ns.tprint(`${a.name}`);
      if (!names) {
        ns.tprint(`|-- ${a.factions.join(', ')}`);
        ns.tprint(`|-- $${ns.formatNumber(a.cost)}`);
        ns.tprint(`|-- ${ns.formatNumber(a.rep)} reputation`);
      }
    });
  }
}
