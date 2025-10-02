import { dodge } from '@/lib/dodge';
import { NS } from '@ns';

export async function improveSleeve(ns: NS, sleeve: number, skill: string) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    await dodge({ ns, command: `ns.sleeve.travel(${sleeve}, 'Sector-12')` });
    const result = (await dodge({
      ns,
      command: `ns.sleeve.setToGymWorkout(${sleeve}, 'Powerhouse Gym', '${skill}')`,
    })) as boolean;
    if (!result) {
      await dodge({
        ns,
        command: `ns.sleeve.setToGymWorkout(${sleeve}, 'Millenium Fitness Gym', '${skill}')`,
      });
    }
  } else if (skill === 'hack') {
    // hacking
    await dodge({ ns, command: `ns.sleeve.travel(${sleeve}, 'Volhaven')` });
    const result = (await dodge({
      ns,
      command: `ns.sleeve.setToUniversityCourse(${sleeve}, 'ZB Institute of Technology', 'Algorithms')`,
    })) as boolean;
    if (!result) {
      await dodge({
        ns,
        command: `ns.sleeve.setToUniversityCourse(${sleeve}, 'Rothman University', 'Algorithms')`,
      });
    }
  } else if (skill === 'cha') {
    // charisma
    await dodge({ ns, command: `ns.sleeve.travel(${sleeve}, 'Volhaven')` });
    const result = (await dodge({
      ns,
      command: `ns.sleeve.setToUniversityCourse(${sleeve}, 'ZB Institute of Technology', 'Leadership')`,
    })) as boolean;
    if (!result) {
      await dodge({
        ns,
        command: `ns.sleeve.setToUniversityCourse(${sleeve}, 'Rothman University', 'Leadership')`,
      });
    }
  } else {
    throw `Invalid skill: ${skill}`;
  }
}

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags([
    ['skills', 'str,def,dex,agi'],
    ['sleeves', '0,1,2,3,4,5,6,7'],
    ['duration', 10000],
  ]);
  const sleeveNumbers = String(flags.sleeves)
    .split(',')
    .map((sn) => Number(sn));
  let skills = String(flags.skills).split(',');
  if (skills.length === 1 && skills[0] === 'all') skills = ['hack', 'str', 'def', 'dex', 'agi', 'cha'];

  while (true) {
    for (const skill of skills) {
      for (const sn of sleeveNumbers) {
        await improveSleeve(ns, sn, skill);
      }

      if (skills.length > 1) await ns.sleep(flags.duration as number);
      else return;
    }
  }
}
