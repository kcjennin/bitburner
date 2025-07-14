import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  let action = 'none';

  while (true) {
    const rank = ns.bladeburner.getRank();
    const next = ns.bladeburner.getNextBlackOp();
    if (next === null) return;
    const { name, rank: opRank } = next;

    if (rank >= opRank) {
      const opChance = ns.bladeburner.getActionEstimatedSuccessChance('Black Operations', name)[0];
      if (opChance >= 0.9) {
        if (action !== name) ns.bladeburner.startAction('Black Operations', name);
        action = name;
      }
    }

    await ns.bladeburner.nextUpdate();
  }
}
