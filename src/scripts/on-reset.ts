import { NS, ScriptArg } from '@ns';

interface RunScript {
  sn: string;
  arguments: ScriptArg[];
  ram: number;
}

export async function main(ns: NS): Promise<void> {
  const scripts: Omit<RunScript, 'ram'>[] = [];

  if (ns.gang.inGang()) {
    scripts.push({ sn: '/gang/gang.js', arguments: ['--noGui'] });
  }

  // scripts.push({
  //   sn: '/sleeve/shock-recovery.js',
  //   arguments: ['--script', '/sleeve/improve-sleeve.js', 'skills,hack'],
  // });

  scripts.push({
    sn: '/bladeburner/rank.js',
    arguments: [],
  });

  scripts.push({
    sn: '/bladeburner/skills.js',
    arguments: [],
  });

  scripts.push({
    sn: '/singularity/improve.js',
    arguments: [],
  });

  if (ns.gang.inGang()) {
    scripts.push({ sn: '/gang/equipment.js', arguments: [] });
  }

  scripts.push({
    sn: '/singularity/programs.js',
    arguments: ['--ram'],
  });

  let availableRam = ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
  scripts
    .map((s) => ({ ...s, ram: ns.getScriptRam(s.sn) } as RunScript))
    .forEach((s) => {
      if (availableRam - s.ram > 0) {
        ns.run(s.sn, undefined, ...s.arguments);
        availableRam -= s.ram;
      }
    });
}
