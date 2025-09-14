import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const augs = ns.singularity.getAugmentationsFromFaction(ns.args[0] as string);
  ns.getPortHandle(ns.pid).write(JSON.stringify(augs));
}
