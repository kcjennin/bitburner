import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  let checkOnly = false;
  let buyAll = false;
  if (ns.args.length === 2 && ns.args.includes('-c')) {
    checkOnly = true;
  } else if (ns.args.length === 2 && ns.args.includes('-a')) {
    buyAll = true;
  } else if (ns.args.length !== 1) {
    ns.tprint('usage: buy-server.js <RAM>');
  }
  const ram = parseInt(String(ns.args.filter((a) => !a.toString().startsWith('-'))[0]));

  if (checkOnly) {
    ns.tprint(`Need ${ns.formatNumber(ns.getPurchasedServerCost(ram))}`);
    return;
  }

  const servers = ns.getPurchasedServers();
  let i = 0;
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
      ns.upgradePurchasedServer(hostname, ram);
      ns.tprint(`Upgraded ${hostname}.`);
      if (!buyAll) return;
    } else if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      ns.purchaseServer(hostname, ram);
      ns.tprint(`Purchased ${hostname}.`);
      if (!buyAll) return;
    } else if (!buyAll) {
      ns.tprint(`ERROR: Need ${ns.formatNumber(ns.getPurchasedServerCost(ram))}`);
      return;
    } else {
      await ns.sleep(1000);
      continue;
    }

    i++;
  }
}
