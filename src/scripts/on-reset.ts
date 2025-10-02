import { NS, ScriptArg } from '@ns';

interface RunScript {
  sn: string;
  arguments?: ScriptArg[];
  ram: number;
}

export async function main(ns: NS): Promise<void> {
  const scripts: Omit<RunScript, 'ram'>[] = [];

  scripts.push({ sn: '/hacking/crawler.js' });
  // scripts.push({ sn: '/stocks/manager.js' });
  scripts.push({ sn: '/bladeburner/rank.js' });
  // scripts.push({ sn: '/bladeburner/skills.js' });
  scripts.push({ sn: '/gang/gang.js', arguments: ['--noGui'] });
  // scripts.push({ sn: '/gang/equipment.js' });
  scripts.push({ sn: '/ipvgo/ipvgo.js' });
  scripts.push({ sn: '/sleeves/do-crime.js', arguments: ['Grand Theft Auto'] });

  let availableRam = ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
  scripts
    .map((s) => ({ ...s, ram: ns.getScriptRam(s.sn) } as RunScript))
    .forEach((s) => {
      if (availableRam - s.ram > 0) {
        ns.run(s.sn, undefined, ...(s.arguments ?? []));
        availableRam -= s.ram;
      }
    });
}
