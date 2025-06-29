import { AutocompleteData, NS } from '@ns';
import { getAllServers } from '@/lib/server-utils.js';

function getServerData(ns: NS, server: string) {
  const moneyMax = ns.getServerMaxMoney(server);
  const moneyPct = ns.getServerMoneyAvailable(server) / moneyMax;
  const securityLvl = ns.getServerSecurityLevel(server);
  const securityMin = ns.getServerMinSecurityLevel(server);
  const ram = ns.getServerMaxRam(server);
  const growthRate = ns.getServerGrowth(server);

  return (
    `\n${server}:\n` +
    `  money: ${ns.formatPercent(moneyPct, 0)} of ${ns.formatNumber(moneyMax, 0, 1000, true)}\n` +
    `  security: ${ns.formatNumber(securityLvl, 2)} (${securityMin})\n` +
    `  RAM: ${ram}\n` +
    `  growth: ${growthRate}`
  );
}

/** @param {NS} ns */
function getServers(ns: NS): string[] {
  if (ns.args.length >= 1) {
    return ns.args.map(String);
  } else {
    return getAllServers(ns);
  }
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  getServers(ns).forEach((server) => ns.tprint(getServerData(ns, server)));
}
