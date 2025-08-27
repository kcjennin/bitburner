import { Stock } from './Stock'

export async function main(ns: NS) {
  const stocks = ns.stock.getSymbols().map((sym) => {
    const stock = new Stock(ns, sym);
    stock.refresh();
    return stock;
  });

  for (const stock of stocks.filter((stock) => stock.owned)) {
    await stock.sellAll();
  }
}
