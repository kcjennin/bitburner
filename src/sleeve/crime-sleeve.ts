import { CrimeStats, CrimeType, GymType, NS, SleevePerson } from '@ns';

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

async function improve(ns: NS, sleeve: number, skill: string) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    ns.sleeve.setToGymWorkout(sleeve, 'Powerhouse Gym', skill as GymType);
  } else if (skill === 'hack') {
    // hacking
    ns.sleeve.setToUniversityCourse(sleeve, 'Rothman University', 'Algorithms');
  } else if (skill === 'cha') {
    // charisma
    ns.sleeve.setToUniversityCourse(sleeve, 'Rothman University', 'Management');
  } else {
    throw `Invalid skill: ${skill}`;
  }
}

function calculateIntelligenceBonus(intelligence: number, weight = 1): number {
  return 1 + (weight * Math.pow(intelligence, 0.8)) / 600;
}

function successRate(cs: CrimeStats, p: SleevePerson): number {
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
  ns.disableLog('ALL');
  ns.ui.openTail();

  const sleeveNumbers = ((ns.args.at(0) as string | undefined) ?? '0,1,2,3,4,5,6,7').split(',').map((sn) => Number(sn));
  const manager: [number, number, string][] = sleeveNumbers.map((sn) => [sn, 0, 'none']);
  while (true) {
    for (const sNnT of manager) {
      const [sleeveNumber, nextTime, task] = sNnT;
      if (nextTime > Date.now()) continue;
      const setNext = (nt: number, task: string) => {
        sNnT[1] = Date.now() + nt;
        sNnT[2] = task;
      };

      const p = ns.sleeve.getSleeve(sleeveNumber);
      if (p.city !== 'Sector-12') throw 'Must be in Sector-12';
      if (p.shock > 96) {
        // if the sleeve is shocked, wait 10 seconds then try again
        ns.sleeve.setToShockRecovery(sleeveNumber);
        setNext(10000, 'Shock Recovery');
        continue;
      }
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

      // current best crime to run
      let current;
      const eligibleCrimes = crimeStats.filter((cs) => cs.chance > 0.8);
      if (eligibleCrimes.length > 0) {
        current = eligibleCrimes.reduce((maxIncome, cs) => (cs.realIncome > maxIncome.realIncome ? cs : maxIncome));

        if (current.realIncome < 1) {
          // no profitable crimes, train
          if (agility > dexterity) await improve(ns, sleeveNumber, 'dex');
          else await improve(ns, sleeveNumber, 'agi');
          setNext(10000, 'Training');
          continue;
        }
      } else {
        // no crimes at all, train
        if (agility > dexterity) await improve(ns, sleeveNumber, 'dex');
        else await improve(ns, sleeveNumber, 'agi');
        setNext(10000, 'Training');
        continue;
      }

      // get the next crime that could be better money
      const stepUp = crimeStats.filter((cs) => cs.income > current.income && cs.chance > 0.5).at(0);
      if (stepUp !== undefined && Math.random() < 0.5) {
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
        await improve(ns, sleeveNumber, name);
        setNext(10000, 'Stepping Up');
      } else {
        // nothing to step up to, commit crime
        if (task !== current.type) ns.sleeve.setToCommitCrime(sleeveNumber, current.type as CrimeType);
        setNext(current.time, current.type);
      }
    }

    // find the nearest time
    const nt = Math.max(0, manager.reduce((min, [, time]) => Math.min(min, time), Infinity) - Date.now());
    ns.clearLog();
    for (const [sn, nextTime, task] of manager) {
      ns.print(`Sleeve ${sn}:`);
      ns.print(`  Task: ${task}`);
      ns.print(`  ETA:  ${ns.tFormat(nextTime - Date.now())}`);
    }
    await ns.sleep(nt);
  }
}
