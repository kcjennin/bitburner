import { CompanyPositionInfo, NS, Skills } from '@ns';

async function improve(ns: NS, skill: string, focus = false, duration = 10000) {
  if (['str', 'def', 'dex', 'agi'].includes(skill)) {
    // gym skills
    throw 'Not doing gym stuff';
    // ns.singularity.gymWorkout('Powerhouse Gym', skill as GymType, focus);
  } else if (skill === 'hacking') {
    // hacking
    ns.singularity.universityCourse('Rothman University', 'Algorithms', focus);
  } else if (skill === 'charisma') {
    // charisma
    ns.singularity.universityCourse('Rothman University', 'Management', focus);
  } else {
    throw `Invalid skill: ${skill}`;
  }

  await ns.sleep(duration);
}

export async function main(ns: NS): Promise<void> {
  // CLI arguments
  const args = ns.flags([['f', false]]);
  const focus = Boolean(args.f);
  const cnString = (args._ as string[]).at(0);
  if (cnString === undefined) throw 'usage: corp [-f] <company>';

  // Company Name verification
  const cnEntry = Object.entries(ns.enums.CompanyName).find(([, v]) => v === cnString);
  if (cnEntry === undefined) throw `Invalid company: ${cnString}`;
  const cn = cnEntry[1];

  let rep = ns.singularity.getCompanyRep(cn);
  const positions = ns.singularity
    .getCompanyPositions(cn)
    .map((pos) => ns.singularity.getCompanyPositionInfo(cn, pos))
    .sort((posA, posB) => posB.salary - posA.salary);

  while (rep <= 400000) {
    const p = ns.getPlayer();
    let job = p.jobs[cn];
    rep = ns.singularity.getCompanyRep(cn);

    // positions we have the stats and rep for, sorted by salary
    const qualified = positions.filter(
      (pos) =>
        rep >= pos.requiredReputation &&
        (Object.keys(p.skills) as (keyof Skills)[]).every((skill) => p.skills[skill] >= pos.requiredSkills[skill]),
    );

    // start log stuff
    ns.clearLog();
    ns.print(`Company:    ${cn}`);
    ns.print(`Reputation: ${rep}`);

    const current = qualified.at(0);
    if (current === undefined) {
      ns.print(`Field:      Training (Hack/Cha)`);
      await improve(ns, 'hack', focus);
      await improve(ns, 'cha', focus);
    } else {
      // work the current best job
      if (current.name !== job) {
        job = ns.singularity.applyToCompany(cn, current.field) ?? undefined;
      }
      ns.print(`Field:      ${job}`);

      // train for the next position
      const nextName = current.nextPosition ?? undefined;
      if (nextName !== undefined) {
        const next = positions.find((pos) => pos.name === nextName) as CompanyPositionInfo;
        for (const skill of Object.keys(p.skills) as (keyof Skills)[]) {
          if (p.skills[skill] < next.requiredSkills[skill]) {
            await improve(ns, skill, focus);
          }
        }
      }

      ns.singularity.workForCompany(cn, focus);
      await ns.sleep(10000);
    }
  }
}
