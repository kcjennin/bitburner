import { AugmentPair, NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  let money = ns.getServerMoneyAvailable('home');
  const sleeveNumbers = [0, 1, 2, 3, 4, 5, 6, 7];
  const augs = Array.from(
    new Set(sleeveNumbers.flatMap((si) => ns.sleeve.getSleevePurchasableAugs(si)).map((ap) => JSON.stringify(ap))),
  )
    .map((ap) => JSON.parse(ap) as AugmentPair)
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
