import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  if (ns.args.length === 1) {
    await ns.weaken(target);
  } else if (ns.args.length === 2) {
    await ns.weaken(target, JSON.parse(String(ns.args[1])));
  }
}
