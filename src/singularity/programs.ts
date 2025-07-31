import { NS } from '@ns';

const PROGRAMS = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];

export async function main(ns: NS): Promise<void> {
  let numPrograms = -1;

  while (numPrograms < PROGRAMS.length) {
    if (ns.getServerMoneyAvailable('home') > 200000) ns.singularity.purchaseTor();
    const newPrograms = PROGRAMS.filter(
      (program) => ns.fileExists(program) || ns.singularity.purchaseProgram(program),
    ).length;

    if (newPrograms > numPrograms) {
      const pid = ns.run('/hacking/crawler.js', { preventDuplicates: true }, '--single');
      if (pid === 0) throw 'Failed to run crawler.';
      numPrograms = newPrograms;
    }

    await ns.sleep(1000);
  }
}
