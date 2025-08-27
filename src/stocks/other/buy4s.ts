export async function main(ns: NS) {
  ns.writePort(ns.pid, ns.stock.purchase4SMarketData() && ns.stock.purchase4SMarketDataTixApi());
}
