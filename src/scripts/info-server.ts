import { AutocompleteData, NS } from '@ns';

/** @param {NS} ns
 *  @param {boolean} all
 */
function getAllServers(ns: NS, all = false) {
  const servers = ['home'];
  const result: string[] = [];

  let idx = 0;
  while (idx < servers.length) {
    for (const newServer of ns.scan(servers[idx])) {
      if (servers.indexOf(newServer) < 0) {
        servers.push(newServer);
        if (all || (ns.hasRootAccess(newServer) && ns.getServerMaxMoney(newServer) > 0)) {
          result.push(newServer);
        }
      }
    }
    idx += 1;
  }

  return result;
}

function getServerData(ns: NS, server: string) {
  const money = ns.getServerMoneyAvailable(server);
  const moneyMax = ns.getServerMaxMoney(server);
  const securityLvl = ns.getServerSecurityLevel(server);
  const securityMin = ns.getServerMinSecurityLevel(server);
  const ram = ns.getServerMaxRam(server);
  const growthRate = ns.getServerGrowth(server);

  return (
    `\n${server}:\n` +
    `  money: ${money} / ${moneyMax}\n` +
    `  security: ${securityLvl} (${securityMin})\n` +
    `  RAM: ${ram}\n` +
    `  growth: ${growthRate}`
  );
}

/** @param {NS} ns */
function getServers(ns: NS): string[] {
  if (ns.args.length >= 1) {
    return ns.args.map(String);
  } else {
    return getAllServers(ns, false);
  }
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  getServers(ns).forEach((server) => ns.tprint(getServerData(ns, server)));
}
