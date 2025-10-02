import { CrimeStats, NS, SleevePerson } from '@ns';
import { improveSleeve } from '@/sleeve/improve-sleeve';
import { dodge } from '@/lib/dodge';

type ExtendedCrimeStats = CrimeStats & { income: number; realIncome: number; chance: number };

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

      const p = (await dodge({ ns, command: `ns.sleeve.getSleeve(${sleeveNumber})` })) as SleevePerson;
      const {
        skills: { hacking, strength, defense, dexterity, agility, charisma },
      } = p;
      const crimeStats: ExtendedCrimeStats[] = [];
      for (const c of CRIMES) {
        const stats = (await dodge({ ns, command: `ns.singularity.getCrimeStats("${c}")` })) as CrimeStats;
        const income = stats.money / stats.time;
        const chance = successRate(stats, p);
        const realIncome = income * chance;
        crimeStats.push({ income, realIncome, chance, ...stats });
      }
      crimeStats.sort((a, b) => b.realIncome - a.realIncome);

      // current best crime to run
      let current;
      const eligibleCrimes = crimeStats.filter((cs) => cs.chance > 0.8);
      if (eligibleCrimes.length > 0) {
        current = eligibleCrimes.reduce((maxIncome, cs) => (cs.realIncome > maxIncome.realIncome ? cs : maxIncome));

        if (current.realIncome < 1) {
          // no profitable crimes, train
          if (agility > dexterity) await improveSleeve(ns, sleeveNumber, 'dex');
          else await improveSleeve(ns, sleeveNumber, 'agi');
          setNext(10000, 'Training');
          continue;
        }
      } else {
        // no crimes at all, train
        if (agility > dexterity) await improveSleeve(ns, sleeveNumber, 'dex');
        else await improveSleeve(ns, sleeveNumber, 'agi');
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
        await improveSleeve(ns, sleeveNumber, name);
        setNext(10000, 'Stepping Up');
      } else {
        // nothing to step up to, commit crime
        if (task !== current.type)
          await dodge({ ns, command: `ns.sleeve.setToCommitCrime(${sleeveNumber}, "${current.type}")` });
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
