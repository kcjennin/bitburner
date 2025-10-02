import { copyWorkers } from '@/hacking/crawler';
import { NodeStats, NS } from '@ns';

type UpgradeType = 'new' | 'level' | 'ram' | 'cores' | 'cache';
type UpgradeInfo = {
  type: UpgradeType;
  gain: number;
  cost: number;
  makePurchase: () => boolean;
};

const MONEY_PER_HASH = 1e6 / 4;
// max time the upgrade has to pay itself off (4 hours)
const MAX_PAYOFF = 8;
const MAX_SPEND = 250e9;
const RESERVE = 500e3;

function makeUpgradeInfos(ns: NS, nn: number, minCache: number): UpgradeInfo[] {
  const mult = ns.getPlayer().mults.hacknet_node_money;
  const stats = ns.hacknet.getNodeStats(nn);

  const levelProd = ns.formulas.hacknetServers.hashGainRate(stats.level + 1, 0, stats.ram, stats.cores, mult);
  const ramProd = ns.formulas.hacknetServers.hashGainRate(stats.level, 0, stats.ram * 2, stats.cores, mult);
  const coresProd = ns.formulas.hacknetServers.hashGainRate(stats.level, 0, stats.ram, stats.cores + 1, mult);
  const cacheProd =
    ((stats.cache ?? 0) > minCache ? 0 : stats.production / (Math.log((stats.cache ?? 0) + 1) + 1)) + stats.production;

  return [
    {
      type: 'new',
      gain: 0,
      cost: ns.hacknet.getPurchaseNodeCost(),
      makePurchase: () => ns.hacknet.purchaseNode() !== -1,
    },
    {
      type: 'level',
      gain: levelProd - stats.production,
      cost: ns.hacknet.getLevelUpgradeCost(nn),
      makePurchase: () => ns.hacknet.upgradeLevel(nn),
    },
    {
      type: 'ram',
      gain: ramProd - stats.production,
      cost: ns.hacknet.getRamUpgradeCost(nn),
      makePurchase: () => ns.hacknet.upgradeRam(nn),
    },
    {
      type: 'cores',
      gain: coresProd - stats.production,
      cost: ns.hacknet.getCoreUpgradeCost(nn),
      makePurchase: () => ns.hacknet.upgradeCore(nn),
    },
    {
      type: 'cache',
      gain: cacheProd - stats.production,
      cost: ns.hacknet.getCacheUpgradeCost(nn),
      makePurchase: () => ns.hacknet.upgradeCache(nn),
    },
  ];
}

export async function main(ns: NS): Promise<void> {
  const {
    maxSpend,
    maxPayoff: maxPayoffHours,
    runTime,
  } = ns.flags([
    ['maxSpend', MAX_SPEND],
    ['maxPayoff', MAX_PAYOFF],
    ['runTime', Infinity],
  ]) as { maxSpend: number; maxPayoff: number; runTime: number };
  ns.clearLog();
  ns.disableLog('ALL');
  const hn = ns.hacknet;
  const maxPayoff = maxPayoffHours * 3600;
  const endTime = Date.now() + runTime * 3600;

  while (Date.now() < endTime) {
    // current money minus a reserve
    const money = ns.getServerMoneyAvailable('home') - RESERVE;

    // if we don't have any, buy one
    if (hn.numNodes() === 0) {
      if (money >= hn.getPurchaseNodeCost()) {
        hn.purchaseNode();
        ns.print('Bought first node.');
      } else {
        ns.print(`Waiting to buy first node for ${ns.formatNumber(hn.getPurchaseNodeCost())}`);
        await ns.sleep(10e3);
      }
      continue;
    }

    // get stats (and index) for all nodes
    const nodes: { nn: number; stats: NodeStats }[] = [];
    for (let nn = 0; nn < hn.numNodes(); ++nn) nodes.push({ nn, stats: hn.getNodeStats(nn) });

    // get the worst cache and the worst producing node
    const minCache = nodes.reduce((min, { stats: { cache } }) => Math.min(min, cache ?? 0), Infinity);
    const { nn } = nodes.reduce((worstNode, node) =>
      node.stats.production < worstNode.stats.production ? node : worstNode,
    );

    // generate info for possible purchase decisions
    const [newNode, ...upgradesRaw] = makeUpgradeInfos(ns, nn, minCache === Infinity ? 0 : minCache);
    const upgrades = upgradesRaw.filter((up) => up.cost < maxSpend && up.cost / (up.gain * MONEY_PER_HASH) < maxPayoff);

    if (upgrades.length === 0 && newNode.cost < maxSpend && nodes.length < hn.maxNumNodes()) {
      // no upgrades but we can buy new
      if (money >= newNode.cost) {
        newNode.makePurchase();
        ns.print('Purchasing new node.');
        continue;
      } else {
        ns.print(`Waiting to purchase new node for $${ns.formatNumber(newNode.cost)}`);
      }
    } else if (upgrades.length > 0) {
      const bestUpgrade = upgrades.reduce((bestUp, up) =>
        up.gain / up.cost > bestUp.gain / bestUp.cost ? up : bestUp,
      );

      if (newNode.cost < bestUpgrade.cost && nodes.length < hn.maxNumNodes()) {
        // if buying a new node is cheaper, do that
        if (money >= newNode.cost) {
          newNode.makePurchase();
          ns.print('Purchasing new node (better than upgrades).');
          continue;
        } else {
          ns.print(`Waiting to purchase new node (better than upgrades) for $${ns.formatNumber(newNode.cost)}`);
        }
      } else {
        // new node is not cheaper, do the upgrade
        if (money >= bestUpgrade.cost) {
          bestUpgrade.makePurchase();
          ns.print(`Purchasing upgrade (${bestUpgrade.type}).`);
          continue;
        } else {
          ns.print(`Waiting to purchase upgrade (${bestUpgrade.type}) for $${ns.formatNumber(bestUpgrade.cost)}`);
        }
      }
    } else {
      // nothing to buy, done
      ns.toast('Finished buying Hacknet Servers.');
      break;
    }

    // try to copy to the new servers so they can be used as workers if needed
    copyWorkers(
      ns,
      [...Array(ns.hacknet.numNodes()).keys()].map((nn) => `hacknet-server-${nn}`),
    );
    await ns.sleep(10e3);
  }

  // try to copy to the new servers so they can be used as workers if needed
  copyWorkers(
    ns,
    [...Array(ns.hacknet.numNodes()).keys()].map((nn) => `hacknet-server-${nn}`),
  );
}
