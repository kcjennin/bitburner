import { getServers } from '@/lib/utils';
import { AutocompleteData, NS } from '@ns';

function getServerData(ns: NS, server: string) {
  const moneyMax = ns.getServerMaxMoney(server);
  const moneyPct = ns.getServerMoneyAvailable(server) / moneyMax;
  const securityLvl = ns.getServerSecurityLevel(server);
  const securityMin = ns.getServerMinSecurityLevel(server);
  const ram = ns.getServerMaxRam(server);
  const growthRate = ns.getServerGrowth(server);

  return (
    `\n${server}:\n` +
    `  money: ${ns.formatPercent(moneyPct)} of ${ns.formatNumber(moneyMax, 3, 1000, true)}\n` +
    `  security: ${ns.formatNumber(securityLvl, 2)} (${securityMin})\n` +
    `  RAM: ${ram}\n` +
    `  growth: ${growthRate}`
  );
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

export async function main(ns: NS): Promise<void> {
  let servers;
  if (ns.args.length >= 1) {
    servers = ns.args.map(String);
  } else {
    servers = getServers(ns);
  }
  servers.forEach((server) => ns.tprint(getServerData(ns, server)));
}
