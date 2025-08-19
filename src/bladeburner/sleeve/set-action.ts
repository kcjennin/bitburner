import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const { a, i } = ns.flags([
    ['a', false],
    ['i', false],
  ]) as { a: boolean; i: boolean };
  const sleeves = [0, 1, 2, 4, 5, 6, 7];

  if (!(a || i)) {
    ns.tprint(`Must supply one of: -a, -i`);
    ns.exit();
  }

  sleeves.forEach((sn) => {
    if (a && i) {
      if (sn % 2 == 0) {
        ns.sleeve.setToBladeburnerAction(sn, 'Field Analysis');
      } else {
        ns.sleeve.setToBladeburnerAction(sn, 'Infiltrate Synthoids');
      }
    } else if (a) {
      ns.sleeve.setToBladeburnerAction(sn, 'Field Analysis');
    } else if (i) {
      ns.sleeve.setToBladeburnerAction(sn, 'Infiltrate Synthoids');
    }
  });
}
