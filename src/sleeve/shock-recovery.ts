import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const { script, _: args } = ns.flags([['script', '/sleeve/improve-sleeve.js']]) as { script: string; _: string[] };
  const sleeves = [0, 1, 2, 3, 4, 5, 6, 7];

  // wait for all sleeves to be recovered
  sleeves.forEach((sn) => ns.sleeve.setToShockRecovery(sn));
  while (sleeves.some((sn) => ns.sleeve.getSleeve(sn).shock > 0.96)) await ns.sleep(10000);

  const freeRam = ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
  const neededRam = Math.max(0, ns.getScriptRam(ns.getScriptName()) - ns.getScriptRam(script));

  const processedArgs = args.map((a) => '--' + a).flatMap((a) => a.split(','));
  if (freeRam >= neededRam) ns.spawn(script, { spawnDelay: 0 }, ...processedArgs);
  else ns.toast('Finished Shock Recovery.');
}
