import { getServers } from '@/lib/utils';
import { NS } from '@ns';

const EXCLUDES = ['darkweb'];

async function hackServer(ns: NS, server: string): Promise<boolean> {
  let hacks = 0;
  if (ns.fileExists('BruteSSH.exe') && ns.brutessh(server)) hacks++;
  if (ns.fileExists('FTPCrack.exe') && ns.ftpcrack(server)) hacks++;
  if (ns.fileExists('HTTPWorm.exe') && ns.httpworm(server)) hacks++;
  if (ns.fileExists('SQLInject.exe') && ns.sqlinject(server)) hacks++;
  if (ns.fileExists('relaySMTP.exe') && ns.relaysmtp(server)) hacks++;

  const requiredPorts = ns.getServerNumPortsRequired(server);
  if (requiredPorts > 0 && hacks < requiredPorts) {
    return false;
  }

  ns.nuke(server);
  ns.toast(`${server} has been hacked.`);
  return true;
}

function programCount(ns: NS): number {
  return [
    () => ns.fileExists('BruteSSH.exe'),
    () => ns.fileExists('FTPCrack.exe'),
    () => ns.fileExists('HTTPWorm.exe'),
    () => ns.fileExists('SQLInject.exe'),
    () => ns.fileExists('relaySMTP.exe'),
  ].reduce((sum, fn) => sum + (fn() ? 1 : 0), 0);
}

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([['single', false]]);

  // Make the logs quiet
  ns.disableLog('ALL');
  let programsShadow = -1;

  while (true) {
    const programs = programCount(ns);
    if (programsShadow !== programs) {
      const servers = getServers(ns).filter((server) => !ns.hasRootAccess(server) && !EXCLUDES.includes(server));
      for (const server of servers) {
        ns.print(`Trying to hack ${server}`);
        await hackServer(ns, server);
      }
    }

    if (args.single) break;

    await ns.sleep(1000);
    programsShadow = programs;
  }

  ns.writePort(ns.pid, 0);
}
