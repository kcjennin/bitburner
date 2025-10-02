import { getServers } from '@/lib/utils';
import { NS } from '@ns';

const MAP_FILE = '/data/stock-map.js';

export async function main(ns: NS) {
  const organizationToServer = Object.fromEntries(
    getServers(ns)
      .map(ns.getServer)
      .map((s) => [s.organizationName, s])
      .filter(([on]) => on !== ''),
  );

  const serverToSym = Object.fromEntries(
    ns.stock
      .getSymbols()
      .map((sym) => [organizationToServer[ns.stock.getOrganization(sym)], sym])
      .filter(([on]) => on !== undefined),
  );

  ns.write(MAP_FILE, 'export const STOCK_MAP = ' + JSON.stringify(serverToSym, undefined, '  '), 'w');
}
