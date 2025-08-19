import { NS } from '@ns';
import { hackServer } from '@/hacking/crawler';
import { getServers } from '@/lib/utils';

const BASE_RAM = 6.3;
const PROGRAMS = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];

export async function main(ns: NS): Promise<void> {
  const upgradeRam = ns.args.includes('--ram');
  if (!upgradeRam) ns.ramOverride(BASE_RAM);
  let numPrograms = -1;

  while (numPrograms < PROGRAMS.length) {
    if (ns.getServerMoneyAvailable('home') > 200000) ns.singularity.purchaseTor();

    // before trying to buy new programs, try to upgrade home ram
    if (upgradeRam) ns.singularity.upgradeHomeRam();
    const newPrograms = PROGRAMS.filter(
      (program) => ns.fileExists(program) || ns.singularity.purchaseProgram(program),
    ).length;

    if (newPrograms > numPrograms) {
      getServers(ns).forEach((s) => hackServer(ns, s));
    }

    numPrograms = newPrograms;

    if (numPrograms < PROGRAMS.length) await ns.sleep(1000);
  }

  ns.toast('All programs purchased.');
}
