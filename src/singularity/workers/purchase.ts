import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const didPurchase = ns.singularity.purchaseAugmentation(ns.args[0] as string, ns.args[1] as string);
  ns.getPortHandle(ns.pid).write(JSON.stringify(didPurchase));
}
