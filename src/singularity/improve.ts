import { GymType, NS } from '@ns';

function improve(ns: NS, skill: string, focus: boolean) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    ns.singularity.travelToCity('Sector-12');
    if (!ns.singularity.gymWorkout('Powerhouse Gym', skill as GymType, focus)) {
      ns.singularity.gymWorkout('Millenium Fitness Gym', skill as GymType, focus);
    }
  } else if (skill === 'hack') {
    // hacking
    ns.singularity.travelToCity('Volhaven');
    if (!ns.singularity.universityCourse('ZB Institute of Technology', 'Algorithms', focus)) {
      ns.singularity.universityCourse('Rothman University', 'Algorithms', focus);
    }
  } else if (skill === 'cha') {
    // charisma
    ns.singularity.travelToCity('Volhaven');
    if (!ns.singularity.universityCourse('ZB Institute of Technology', 'Leadership', focus)) {
      ns.singularity.universityCourse('Rothman University', 'Leadership', focus);
    }
  } else {
    throw `Invalid skill: ${skill}`;
  }
}

export async function main(ns: NS): Promise<void> {
  const { skills, duration } = ns.flags([
    ['skills', 'str,def,dex,agi'],
    ['duration', 10000],
  ]) as { skills: string; duration: number };
  let skillsArray = skills.split(',');
  if (skillsArray.length === 1 && skillsArray[0] === 'all') skillsArray = ['hack', 'str', 'def', 'dex', 'agi', 'cha'];

  while (true) {
    for (const skill of skillsArray) {
      improve(ns, skill, ns.singularity.isFocused());

      if (skillsArray.length > 1) await ns.sleep(duration);
      else return;
    }
  }
}
