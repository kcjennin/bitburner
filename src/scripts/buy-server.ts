import { NS } from '@ns';

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  let checkOnly = false;
  if (ns.args.length === 2 && ns.args.includes('-c')) {
    checkOnly = true;
  } else if (ns.args.length !== 1) {
    ns.tprint('usage: buy-server.js <RAM>');
  }
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = parseInt(String(ns.args.filter((a) => a !== '-c')[0]));

  if (checkOnly) {
    ns.tprint(`Need ${ns.formatNumber(ns.getPurchasedServerCost(ram))}`);
    return;
  }

  // Get all the files from /hacking and /scripts
  const files = [ns.ls('home', '/hacking'), ns.ls('home', '/scripts')].flat();

  const servers = ns.getPurchasedServers();
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  let i = 0;
  while (i < ns.getPurchasedServerLimit() - 1) {
    const hostname = `pserv-${i}`;

    // Skip if it exists already
    if (servers.includes(hostname)) {
      ++i;
      continue;
    }

    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      ns.purchaseServer(hostname, ram);
      ns.scp(files, hostname, 'home');
      ns.tprint(`Purchased ${hostname}.`);
      return;
    } else {
      ns.tprint(`ERROR: Need ${ns.formatNumber(ns.getPurchasedServerCost(ram))}`);
      return;
    }
  }
}
