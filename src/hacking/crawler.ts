import { NS } from '@ns';

const DISABLED_LOGS = [
  'scan',
  'run',
  'getServerRequiredHackingLevel',
  'getHackingLevel',
  'getServerNumPortsRequired',
  'fileExists',
  'hasRootAccess',
];
const EXCLUDES = ['darkweb'];
const HOME_RESERVED = 64;

interface ServerInfo {
  name: string;
  root: boolean;
  ram: number;
  money: number;
  security: number;
  contract?: boolean;
}

function hackServer(ns: NS, server: string): boolean {
  if (ns.hasRootAccess(server)) {
    return true;
  }

  let hacks = 0;
  if (ns.fileExists('BruteSSH.exe') && ns.brutessh(server)) hacks += 1;
  if (ns.fileExists('FTPCrack.exe') && ns.ftpcrack(server)) hacks += 1;
  if (ns.fileExists('HTTPWorm.exe') && ns.httpworm(server)) hacks += 1;
  if (ns.fileExists('SQLInject.exe') && ns.sqlinject(server)) hacks += 1;
  if (ns.fileExists('relaySMTP.exe') && ns.relaysmtp(server)) hacks += 1;

  const requiredPorts = ns.getServerNumPortsRequired(server);
  if (requiredPorts > 0 && hacks < requiredPorts) {
    ns.print(`Not enough ports open: ${server}`);
    return false;
  }

  ns.nuke(server);
  ns.toast(`${server} has been hacked.`);
  return true;
}

export async function main(ns: NS): Promise<void> {
  // Make the logs quiet
  DISABLED_LOGS.forEach((func) => ns.disableLog(func));

  while (true) {
    const servers: ServerInfo[] = [];
    let idx = 0;

    // Start with the home server and purchased servers
    for (const server of ['home', ...ns.getPurchasedServers()]) {
      servers.push({
        name: server,
        root: true,
        ram: ns.getServerMaxRam(server),
        money: 0,
        security: 0,
        contract: false,
      });

      if (server === 'home') {
        servers[servers.length - 1].ram -= HOME_RESERVED; // Reserve some RAM for home
      }
    }

    // Scan for other servers
    while (idx < servers.length) {
      const current = servers[idx];
      idx += 1;

      if (EXCLUDES.includes(current.name)) continue;

      const scanResults = ns.scan(current.name);
      for (const server of scanResults) {
        if (servers.some((s) => s.name === server)) continue; // Already scanned

        const root = hackServer(ns, server);
        const ram = ns.getServerMaxRam(server);
        const money = ns.getServerMaxMoney(server);
        const security = ns.getServerMinSecurityLevel(server);
        const contract = ns.ls(server, '.cct').length > 0;

        servers.push({
          name: server,
          root,
          ram: server === 'home' ? ram - HOME_RESERVED : ram,
          money,
          security,
          contract,
        });
      }

      // sleep for 30 seconds to avoid overwhelming the server
      await ns.sleep(30000);
    }
  }
}
