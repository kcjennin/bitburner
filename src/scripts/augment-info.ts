import { FactionName, NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const augments: Map<string, FactionName[]> = new Map();
  for (const faction of Object.values(ns.enums.FactionName)) {
    if (faction === ns.enums.FactionName.ChurchOfTheMachineGod) continue;
    ns.singularity.getAugmentationsFromFaction(faction).forEach((a) => {
      if (augments.has(a)) augments.get(a)?.push(faction);
      else augments.set(a, [faction]);
    });
  }

  const costMult = ns.getBitNodeMultipliers().AugmentationMoneyCost;
  const repMult = ns.getBitNodeMultipliers().AugmentationRepCost;

  const augInfos = augments
    .entries()
    .filter(([name]) => name !== 'NeuroFlux Governor')
    .map(([name, factions]) => {
      const cost = ns.singularity.getAugmentationBasePrice(name) / costMult;
      const rep = ns.singularity.getAugmentationRepReq(name) / repMult;
      const stats = ns.singularity.getAugmentationStats(name);
      const prereqs = ns.singularity.getAugmentationPrereq(name);
      return { name, factions, cost, rep, stats, prereqs };
    });
  ns.write('/data/augments.json', JSON.stringify(Array.from(augInfos), undefined, '    '), 'w');
}
