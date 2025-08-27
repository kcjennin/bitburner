import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  ns.stock.getSymbols().forEach((sym) => {
    const [l, , s] = ns.stock.getPosition(sym);

    if (l > 0) ns.stock.sellStock(sym, l);
    if (s > 0) ns.stock.sellShort(sym, s);
  });
}
