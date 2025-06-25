import { getAllServers } from '@/lib/server-utils';
import { NS } from '@ns';
import { PORT_MAP } from '@/lib/port-map';

const EXCLUDES = ['darkweb'];
const HOME_RESERVED = 64;
// const PREP_SCRIPTS = [
//   '/hacking/self-prep.js',
//   '/hacking/primitives/grow.js',
//   '/hacking/primitives/hack.js',
//   '/hacking/primitives/weak.js',
// ];
const PREP_EXCLUDES: string[] = [];

interface ServerInfo {
  name: string;
  root: boolean;
  ram: number;
  money: number;
  security: number;
  contract: boolean;
  growth: number;
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
    return false;
  }

  ns.nuke(server);
  ns.toast(`${server} has been hacked.`);
  return true;
}

// function startPrep(ns: NS, server: string): void {
//   if (!ns.isRunning('/hacking/self-prep.js', server) && ns.getServerMaxMoney(server) > 0) {
//     ns.scp(PREP_SCRIPTS, server, 'home');
//     ns.exec(PREP_SCRIPTS[0], server);
//   } else if (!PREP_EXCLUDES.includes(server)) {
//     PREP_EXCLUDES.push(server);
//   }
// }

export async function main(ns: NS): Promise<void> {
  // Make the logs quiet
  ns.disableLog('ALL');

  while (true) {
    const serverNames = getAllServers(ns);

    const servers = serverNames.map((name) => {
      const root = hackServer(ns, name);
      const ram = ns.getServerMaxRam(name);
      const money = ns.getServerMaxMoney(name);
      const security = ns.getServerMinSecurityLevel(name);
      const contract = ns.ls(name, '.cct').length > 0;
      const growth = ns.getServerGrowth(name);

      // this needs some more work to be helpful
      // if (root && name !== 'home' && !name.startsWith('pserv') && !PREP_EXCLUDES.includes(name)) startPrep(ns, name);

      return {
        name,
        root,
        ram: name === 'home' ? Math.min(0, ram - HOME_RESERVED) : ram,
        money,
        security,
        contract,
        growth,
      } as ServerInfo;
    });

    const portData = ns.readPort(PORT_MAP.prepPort);
    if (portData !== 'NULL PORT DATA') {
      PREP_EXCLUDES.push(portData);
      ns.print(`Adding ${portData} to excludes list.`);
    }

    // Write the server information to a json file
    const serverData = JSON.stringify(
      servers.filter((s) => !EXCLUDES.includes(s.name)),
      null,
      2,
    );
    ns.write('/data/servers.json', serverData, 'w');

    await ns.sleep(1000);
  }
}
