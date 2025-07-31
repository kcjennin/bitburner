import { GymType, NS } from '@ns';

export async function train(
  ns: NS,
  final: number,
  flags: { str: boolean; def: boolean; dex: boolean; agi: boolean },
  focus = false,
  period = 3000,
  step = 10,
) {
  let action = 'none';
  let target = step;
  while (true) {
    const {
      skills: { strength, defense, dexterity, agility },
    } = ns.getPlayer();

    const stats = [
      { stat: strength, doStat: flags.str, name: 'str' as GymType },
      { stat: defense, doStat: flags.def, name: 'def' as GymType },
      { stat: dexterity, doStat: flags.dex, name: 'dex' as GymType },
      { stat: agility, doStat: flags.agi, name: 'agi' as GymType },
    ];

    const isTraining = stats.some(({ stat, doStat, name }) => {
      if (doStat && stat < target) {
        if (action !== name && ns.singularity.gymWorkout('Powerhouse Gym', name, focus)) {
          action = name;
        }
        return true;
      }
      return false;
    });

    if (!isTraining) {
      if (target < final) {
        target += step;
        await ns.sleep(0);
        continue;
      }
      ns.toast('Finished training.');
      ns.singularity.stopAction();
      return;
    }

    await ns.sleep(period);
  }
}

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ['str', false],
    ['def', false],
    ['dex', false],
    ['agi', false],
    ['f', false],
    ['period', 3000],
    ['step', 10],
  ]);
  const final = Number((args._ as string[])[0] ?? 1200);
  let flags = {
    str: Boolean(args.str),
    def: Boolean(args.def),
    dex: Boolean(args.dex),
    agi: Boolean(args.agi),
  };
  if (!(flags.str || flags.def || flags.dex || flags.agi)) {
    flags = {
      str: true,
      def: true,
      dex: true,
      agi: true,
    };
  }
  const focus = Boolean(args.f);
  const period = Number(args.period);
  const step = Number(args.step);

  await train(ns, final, flags, focus, period, step);
}
