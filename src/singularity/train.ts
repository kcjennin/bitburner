import { GymType, NS, ScriptArg } from '@ns';

interface Flags {
  str: boolean;
  def: boolean;
  dex: boolean;
  agi: boolean;
  f: boolean;
  period: number;
  step: number;
  _: ScriptArg[];
}

export async function train(
  ns: NS,
  final: number,
  flags: { str: boolean; def: boolean; dex: boolean; agi: boolean },
  period = 3000,
  step = 10,
) {
  let action = 'none';
  let target = step;
  while (true) {
    const focus = ns.singularity.isFocused;
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
        if (action !== name && ns.singularity.gymWorkout('Powerhouse Gym', name, focus())) {
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
    ['period', 3000],
    ['step', 10],
  ]) as unknown as Flags;
  let { str, def, dex, agi } = args;
  const {
    period,
    step,
    _: [final = 1200],
  } = args;
  if (!(str || def || dex || agi)) {
    str = true;
    def = true;
    dex = true;
    agi = true;
  }

  await train(ns, final as number, { str, def, dex, agi }, period, step);
}
