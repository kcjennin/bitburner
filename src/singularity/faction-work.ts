import { FactionWorkType, NS } from '@ns';

const EXCLUDES: string[] = [];
const PERIOD = 1000;

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  const task = { faction: 'none', action: 'none' };
  const lastRep = { name: 'none', rep: 0 };

  while (true) {
    const factions = ns
      .getPlayer()
      .factions.filter((f) => !EXCLUDES.includes(f))
      .map((f) => {
        const augs = ns.singularity
          .getAugmentationsFromFaction(f)
          .filter((aug) => !ns.singularity.getOwnedAugmentations(true).includes(aug));
        const maxRep = Math.min(
          475000,
          augs.reduce((max, aug) => Math.max(max, ns.singularity.getAugmentationRepReq(aug)), 0),
        );
        return { name: f, maxRep, curRep: ns.singularity.getFactionRep(f) };
      })
      .filter((f) => f.maxRep > 0 && f.curRep < f.maxRep)
      .sort((a, b) => a.maxRep - b.maxRep);

    const { name, curRep, maxRep } = factions.at(0) ?? {};

    // if there's no factions to work for, finish
    if (name === undefined || curRep === undefined || maxRep === undefined) {
      ns.toast('Finished faction work.');
      return;
    }

    // try to do some work for the faction if we aren't already
    if (task.faction !== name) {
      let result = false;
      for (const wt of ['hacking', 'field', 'security']) {
        result = ns.singularity.workForFaction(name, wt as FactionWorkType);
        if (result) {
          task.action = wt;
          break;
        }
      }

      // if we can't do any work for the faction just ignore them
      if (!result) {
        ns.toast(`Excluding ${name} from faction work.`);
        EXCLUDES.push(name);
        continue;
      }

      // mark the task as active
      ns.toast(`Working for ${name}`);
      task.faction = name;
    }

    ns.clearLog();
    ns.print(`${task.action} for ${task.faction}`);
    ns.print(`Reputation: ${ns.formatNumber(curRep)} / ${ns.formatNumber(maxRep)}`);
    if (lastRep.name === name) {
      const rate = (curRep - lastRep.rep) / PERIOD;
      ns.print(`Rate: ${ns.formatNumber(1000 * rate)}rep/s`);

      const eta = rate === 0 ? Infinity : (maxRep - curRep) / rate;
      ns.print(`ETA: ${ns.tFormat(eta)}`);
    }

    lastRep.name = name;
    lastRep.rep = curRep;
    await ns.sleep(PERIOD);
  }
}
