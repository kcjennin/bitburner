import { NS } from '@ns';

const FILES = [
  '/hacking/primitives/weak.js',
  '/hacking/primitives/grow.js',
  '/hacking/primitives/hack.js',
  '/scripts/prep.js',
  '/scripts/primitives/share.js',
  '/scripts/share-all.js',
  '/hacking/hwgw.js',
  '/hacking/hwgw-analyze.js',
  '/hacking/gw.js',
  '/hacking/gw-analyze.js',
];

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  if (ns.args.length != 1) {
    ns.tprint('usage: buy-server.js <RAM>');
  }
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = parseInt(String(ns.args[0]));

  const servers = ns.getPurchasedServers();
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  let i = 0;
  while (i < ns.getPurchasedServerLimit() - 1) {
    const hostname = `pserv=${i}`;

    // Skip if it exists already
    if (servers.includes(hostname)) {
      ++i;
      continue;
    }

    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      ns.purchaseServer(hostname, ram);
      ns.scp(FILES, hostname, 'home');
      ns.tprint(`Purchased ${hostname}.`);
      return;
    } else {
      ns.tprint(ns.getPurchasedServerCost(ram));
      return;
    }
  }
}
