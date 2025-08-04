import { GymType, NS } from '@ns';

function improve(ns: NS, sleeve: number, skill: string) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    ns.sleeve.travel(sleeve, 'Sector-12');
    if (!ns.sleeve.setToGymWorkout(sleeve, 'Powerhouse Gym', skill as GymType)) {
      ns.sleeve.setToGymWorkout(sleeve, 'Millenium Fitness Gym', skill as GymType);
    }
  } else if (skill === 'hack') {
    // hacking
    ns.sleeve.travel(sleeve, 'Volhaven');
    if (!ns.sleeve.setToUniversityCourse(sleeve, 'ZB Institute of Technology', 'Algorithms')) {
      ns.sleeve.setToUniversityCourse(sleeve, 'Rothman University', 'Algorithms');
    }
  } else if (skill === 'cha') {
    // charisma
    ns.sleeve.travel(sleeve, 'Volhaven');
    if (!ns.sleeve.setToUniversityCourse(sleeve, 'ZB Institute of Technology', 'Management')) {
      ns.sleeve.setToUniversityCourse(sleeve, 'Rothman University', 'Management');
    }
  } else {
    throw `Invalid skill: ${skill}`;
  }
}

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags([
    ['skills', 'str,def,dex,agi'],
    ['sleeves', '0,1,2,3,4,5'],
    ['duration', 10000],
  ]);
  const sleeveNumbers = String(flags.sleeves)
    .split(',')
    .map((sn) => Number(sn));
  const skills = String(flags.skills).split(',');

  while (true) {
    for (const skill of skills) {
      for (const sn of sleeveNumbers) {
        improve(ns, sn, skill);
      }

      if (skills.length > 1) await ns.sleep(flags.duration as number);
      else return;
    }
  }
}
