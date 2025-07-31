import { CrimeStats, CrimeType, GymType, NS, Player } from '@ns';

const CRIMES = [
  'Shoplift',
  'Rob Store',
  'Mug',
  'Larceny',
  'Deal Drugs',
  'Bond Forgery',
  'Traffick Arms',
  'Homicide',
  'Grand Theft Auto',
  'Kidnap',
  'Assassination',
  'Heist',
];
const IntelligenceCrimeWeight = 0.025;
const MaxSkillLevel = 975;

async function improve(ns: NS, skill: string, focus = false, duration = 10000) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    ns.singularity.gymWorkout('Powerhouse Gym', skill as GymType, focus);
  } else if (skill === 'hack') {
    // hacking
    ns.singularity.universityCourse('Rothman University', 'Algorithms', focus);
  } else if (skill === 'cha') {
    // charisma
    ns.singularity.universityCourse('Rothman University', 'Management', focus);
  } else {
    throw `Invalid skill: ${skill}`;
  }

  await ns.sleep(duration);
}

function calculateIntelligenceBonus(intelligence: number, weight = 1): number {
  return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}

function successRate(cs: CrimeStats, p: Player): number {
  let chance: number =
    cs.hacking_success_weight * p.skills.hacking +
    cs.strength_success_weight * p.skills.strength +
    cs.defense_success_weight * p.skills.defense +
    cs.dexterity_success_weight * p.skills.dexterity +
    cs.agility_success_weight * p.skills.agility +
    cs.charisma_success_weight * p.skills.charisma +
    IntelligenceCrimeWeight * p.skills.intelligence;
  chance /= MaxSkillLevel;
  chance /= cs.difficulty;
  chance *= p.mults.crime_success;
  chance *= calculateIntelligenceBonus(p.skills.intelligence, 1);

  return Math.min(chance, 1);
}

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([['f', false]]);
  const focus = Boolean(args.f);

  while (true) {
    const p = ns.getPlayer();
    const {
      skills: { hacking, strength, defense, dexterity, agility, charisma },
    } = p;
    const crimeStats = CRIMES.map((c) => {
      const stats = ns.singularity.getCrimeStats(c as CrimeType);
      const income = stats.money / stats.time;
      const chance = successRate(stats, p);
      const realIncome = income * chance;
      return { income, realIncome, chance, ...stats };
    }).sort((a, b) => b.realIncome - a.realIncome);

    // crimeStats.forEach((cs) => ns.tprint(`$${ns.formatNumber(cs.realIncome * 1000)} - ${cs.type}`));
    // return;

    // current best crime to run
    let current;
    const eligibleCrimes = crimeStats.filter((cs) => cs.chance > 0.8);
    if (eligibleCrimes.length > 0) {
      current = eligibleCrimes.reduce((maxIncome, cs) => (cs.realIncome > maxIncome.realIncome ? cs : maxIncome));

      if (current.realIncome < 1) {
        // no profitable crimes, train
        await improve(ns, 'dex');
        await improve(ns, 'agi');
        continue;
      }
    } else {
      // no crimes at all, train
      await improve(ns, 'dex');
      await improve(ns, 'agi');
      continue;
    }

    // get the next crime that could be better money
    const stepUp = crimeStats.filter((cs) => cs.income > current.income && cs.chance > 0.5).at(0);
    if (stepUp !== undefined) {
      const weightedSkills: [string, number][] = [
        ['hack', hacking * stepUp.hacking_success_weight],
        ['str', strength * stepUp.strength_success_weight],
        ['def', defense * stepUp.defense_success_weight],
        ['dex', dexterity * stepUp.dexterity_success_weight],
        ['agi', agility * stepUp.agility_success_weight],
        ['cha', charisma * stepUp.charisma_success_weight],
      ];

      // get the worst skill and pull it up
      const [name] = weightedSkills
        .filter(([, s]) => s > 0)
        .reduce(([minN, minS], [n, s]) => (s < minS ? [n, s] : [minN, minS]));
      await improve(ns, name, focus);
    }

    // do the crime 5 times per cycle (will do 4 if unfocused)
    await ns.sleep(ns.singularity.commitCrime(current.type as CrimeType, focus) * 5);
  }
}
