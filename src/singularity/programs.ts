import { NS } from '@ns';
import { hackServer } from '@/hacking/crawler';
import { getServers } from '@/lib/utils';

const PROGRAMS = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];

export async function main(ns: NS): Promise<void> {
  const { wait } = ns.flags([['wait', false]]) as { wait: boolean };
  let numPrograms = -1;

  while (numPrograms < PROGRAMS.length) {
    if (ns.getServerMoneyAvailable('home') > 200e3) ns.singularity.purchaseTor();

    const newPrograms = PROGRAMS.filter(
      (program) => ns.fileExists(program) || ns.singularity.purchaseProgram(program),
    ).length;

    if (newPrograms > numPrograms) {
      const newServers = getServers(ns);
      newServers.forEach((s) => hackServer(ns, s));
    }

    numPrograms = newPrograms;
    if (!wait) break;

    if (numPrograms < PROGRAMS.length) await ns.sleep(1e3);
  }

  if (numPrograms === PROGRAMS.length) {
    ns.toast('All programs purchased.');
  } else {
    ns.toast(`Purchased ${numPrograms} / ${PROGRAMS.length} programs.`);
  }
}
