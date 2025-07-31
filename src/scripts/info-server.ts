import { getServers } from '@/lib/utils';
import { AutocompleteData, NS } from '@ns';

function getServerData(ns: NS, server: string) {
  const so = ns.getServer(server);
  const po = ns.getPlayer();

  const wTime = ns.formulas.hacking.weakenTime(so, po);
  const sec = so.hackDifficulty ?? 0;

  so.hackDifficulty = so.minDifficulty ?? 0;
  const wTime2 = ns.formulas.hacking.weakenTime(so, po);

  const moneyPct = (so.moneyAvailable ?? 0) / (so.moneyMax ?? 1);

  return (
    `\n${server}:\n` +
    `  money:       ${ns.formatPercent(moneyPct)} (${ns.formatNumber(so.moneyMax ?? 0)})\n` +
    `  security:    ${ns.formatNumber(sec, 2)} (${ns.formatNumber(so.hackDifficulty, 2)})\n` +
    `  RAM:         ${ns.formatRam(so.maxRam)}\n` +
    `  growth:      ${so.serverGrowth}\n` +
    `  weaken time: ${ns.tFormat(wTime)} (${ns.tFormat(wTime2)})`
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
