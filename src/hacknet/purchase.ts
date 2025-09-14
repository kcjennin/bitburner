import { BitNodeMultiplersCache, getCacheData, PlayerCache } from '@/lib/Cache';
import { NS } from '@ns';

type Upgrades = 'core' | 'level' | 'ram';
type Best = {
  r: number;
  cost: number;
  type?: Upgrades;
};
type HashGainArgs = [number, number, number, number, number];

const MONEY_PER_HASH = 1e6 / 4;
// max time the upgrade has to pay itself off (1 hour)
const MAX_PAYOFF = 3600;

export async function main(ns: NS): Promise<void> {
  const hashGainMult =
    getCacheData(ns, BitNodeMultiplersCache).HacknetNodeMoney * getCacheData(ns, PlayerCache).mults.hacknet_node_money;
  const hn = ns.hacknet;
  const hnf = ns.formulas.hacknetServers;

  while (true) {
    let madePurchase = false;
    const bests: Best[] = [];
    for (let i = 0; i < ns.hacknet.numNodes(); ++i) {
      const stats = ns.hacknet.getNodeStats(i);
      const baseInfo: HashGainArgs = [stats.level, stats.ramUsed ?? 0, stats.ram, stats.cores, hashGainMult];
      const baseGain = hnf.hashGainRate(...baseInfo);

      const upgrades: [Upgrades, (n: number) => number, number][] = [
        ['core', hnf.coreUpgradeCost, 3],
        ['level', hnf.levelUpgradeCost, 0],
        ['ram', hnf.ramUpgradeCost, 2],
      ];

      const best: Best = { r: 0, cost: Infinity };
      for (const [type, costFn, idx] of upgrades) {
        const cost = costFn(baseInfo[idx]);

        if (type === 'ram') baseInfo[idx] *= 1;
        else baseInfo[idx] += 1;
        const gain = hnf.hashGainRate(...baseInfo);
        if (type === 'ram') baseInfo[idx] /= 1;
        else baseInfo[idx] -= 1;

        const r = gain / cost;
        if (r > best.r) {
          best.r = r;
          best.cost = cost;
          best.type = type;
        }
      }

      // check the time until payoff
      const gainIncrease = Math.max(0, best.r - baseGain);
      if (gainIncrease * MONEY_PER_HASH * MAX_PAYOFF > best.cost) bests.push(best);
    }

    const [upgradeBest, idx]: [Best, number] = bests.reduce(
      ([max, maxIdx], b, idx) => (b.r > max.r ? [b, idx] : [max, maxIdx]),
      [{ r: 0, cost: Infinity }, -1],
    );

    const newServerGain = hnf.hashGainRate(1, 0, 1, 1, hashGainMult);
    const newServerCost = hn.getPurchaseNodeCost();
    const newServerBest = newServerGain / newServerCost;

    if (newServerBest > upgradeBest.r && newServerBest * MONEY_PER_HASH * MAX_PAYOFF > newServerCost) {
      const newIdx = hn.purchaseNode();
      if (newIdx !== -1) {
        madePurchase = true;
        ns.print(`Bought hacknet-server-${newIdx}`);
      }
    } else {
      if (!(upgradeBest.r === 0 || upgradeBest.type === undefined)) {
        const purchases = {
          core: hn.upgradeCore,
          level: hn.upgradeLevel,
          ram: hn.upgradeRam,
        };

        if (purchases[upgradeBest.type](idx)) {
          madePurchase = true;
          ns.print(`Upgraded hacknet-server-${idx}: ${upgradeBest.type}`);
        }
      }
    }

    // keep trying to buy if we actually spent anything
    if (madePurchase) continue;
    await ns.sleep(10e3);
  }
}
