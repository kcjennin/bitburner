import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const augs = ns.singularity.getOwnedAugmentations(true);
  ns.getPortHandle(ns.pid).write(JSON.stringify(augs));
}
