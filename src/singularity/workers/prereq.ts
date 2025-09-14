import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const prereqs = ns.singularity.getAugmentationPrereq(ns.args[0] as string);
  ns.getPortHandle(ns.pid).write(JSON.stringify(prereqs));
}
