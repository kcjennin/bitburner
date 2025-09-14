import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const price = ns.singularity.getAugmentationPrice(ns.args[0] as string);
  ns.getPortHandle(ns.pid).write(JSON.stringify(price));
}
