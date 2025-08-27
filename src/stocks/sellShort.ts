import { NS } from '@ns';

export async function main(ns: NS) {
  const [sym, shares] = ns.args as [string, number];

  ns.writePort(ns.pid, ns.stock.sellShort(sym, shares));
}
