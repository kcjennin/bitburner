import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const stats = ns.singularity.getAugmentationStats(ns.args[0] as string);
  ns.getPortHandle(ns.pid).write(JSON.stringify(stats));
}
