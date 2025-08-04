import { NS, ScriptArg } from '@ns';

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ['a', false],
    ['c', false],
  ]);
  const checkOnly = args.c;
  const buyAll = args.a;
  let ram = ((args._ as ScriptArg[]).at(0) ?? 0) as number;
  const servers = ns.getPurchasedServers();

  if (ram === 0 && servers.length === 0) {
    ram = 8;
  } else if (ram === 0) {
    ram = servers.map(ns.getServerMaxRam).reduce((min, s) => Math.min(min, s)) * 2;
  }

  let i = 0;
  let cost = 0;
  while (i < ns.getPurchasedServerLimit()) {
    const hostname = `pserv-${i}`;

    // Skip if it exists already and isn't being upgraded
    if (servers.includes(hostname) && ns.getServerMaxRam(hostname) >= ram) {
      ++i;
      continue;
    }

    if (
      servers.includes(hostname) &&
      ns.getPurchasedServerUpgradeCost(hostname, ram) < ns.getServerMoneyAvailable('home')
    ) {
      // Exists and can upgrade
      cost += ns.getPurchasedServerUpgradeCost(hostname, ram);
      if (!checkOnly) {
        ns.upgradePurchasedServer(hostname, ram);
        ns.tprint(`Upgraded ${hostname}.`);
      }
    } else if (!servers.includes(hostname) && ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      // Does not exist and can purcase
      cost += ns.getPurchasedServerCost(ram);
      if (!checkOnly) {
        ns.purchaseServer(hostname, ram);
        ns.tprint(`Purchased ${hostname}.`);
      }
    } else if (checkOnly) {
      // Didn't have enough money, but we're just checking
      cost += servers.includes(hostname)
        ? ns.getPurchasedServerUpgradeCost(hostname, ram)
        : ns.getPurchasedServerCost(ram);
    } else if (!buyAll) {
      ns.tprint(`ERROR: Need ${ns.formatNumber(ns.getPurchasedServerCost(ram))}`);
      return;
    } else {
      await ns.sleep(1000);
      continue;
    }

    if (!buyAll) break;

    i++;
  }

  ns.tprint(`Total cost: $${ns.formatNumber(cost)}`);
}
