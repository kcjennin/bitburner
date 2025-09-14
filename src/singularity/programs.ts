import { NS } from '@ns';
import { hackServer } from '@/hacking/crawler';
import { getCacheData, ServersCache, setCacheData } from '@/lib/Cache';

const PROGRAMS = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];

export async function main(ns: NS): Promise<void> {
  let numPrograms = -1;

  while (numPrograms < PROGRAMS.length) {
    if (ns.getServerMoneyAvailable('home') > 200e3) ns.singularity.purchaseTor();

    // before trying to buy new programs, try to upgrade home ram
    const newPrograms = PROGRAMS.filter(
      (program) => ns.fileExists(program) || ns.singularity.purchaseProgram(program),
    ).length;

    if (newPrograms > numPrograms) {
      const newServers = getCacheData(ns, ServersCache);
      newServers.forEach((s) => hackServer(ns, s));
      setCacheData(ns, ServersCache, newServers);
    }

    numPrograms = newPrograms;
    if (numPrograms < PROGRAMS.length) await ns.sleep(1e3);
  }

  ns.toast('All programs purchased.');
}
