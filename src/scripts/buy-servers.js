/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 1) {
    ns.tprint('usage: buy-servers.js <RAM>');
  }
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = ns.args[0];

  // Iterator we'll use for our loop
  let i = 0;

  const servers = JSON.parse(ns.read('/data/servers.json'));
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  while (i < ns.getPurchasedServerLimit() - 1) {
    let hostname = 'pserv-' + i.toString();

    // Skip if it exists already
    if (servers.find((srv) => srv.name == hostname) != null) {
      ++i;
      continue;
    }

    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      ns.purchaseServer(hostname, ram);
      ++i;
    }

    await ns.sleep(1000);
  }

  i = 0;
  while (i < ns.getPurchasedServerLimit() - 1) {
    let hostname = ns.getPurchasedServers()[i];

    if (ns.getServerMaxRam(hostname) < ram) {
      if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
        ns.upgradePurchasedServer(hostname, ram);
        ++i;
      }
    } else if (ns.getServerMaxRam(hostname) >= ram) {
      ++i;
    }

    await ns.sleep(1000);
  }
}
