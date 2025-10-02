import { copyWorkers } from '@/hacking/crawler';
import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  while (true) {
    const nodes = [...Array(ns.hacknet.numNodes()).keys()].map((nn) => [nn, ns.hacknet.getRamUpgradeCost(nn)]);
    if (nodes.length === 0) {
      ns.tprint('No nodes to upgrade.');
      ns.exit();
    }

    const money = ns.getServerMoneyAvailable('home');
    const [nn, cost] = nodes.reduce(([minNn, minCost], [nn, cost]) => (cost < minCost ? [nn, cost] : [minNn, minCost]));
    const newCost = nodes.length < ns.hacknet.maxNumNodes() ? ns.hacknet.getPurchaseNodeCost() : Infinity;

    if (newCost < cost && newCost <= money) {
      ns.hacknet.purchaseNode();
    } else if (cost <= money) {
      ns.hacknet.upgradeRam(nn);
    } else break;
  }

  copyWorkers(
    ns,
    [...Array(ns.hacknet.numNodes()).keys()].map((nn) => `hacknet-server-${nn}`),
  );
  ns.toast('No more money to upgrade HackNet RAM');
}
