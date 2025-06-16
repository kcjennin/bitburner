import { NS } from '@ns';

// Constants
const MONEY_KEEP = 1_000_000_000;
const BUFFER = 100_000;
const LONG_BUY_FORECAST = 0.6;
const SHORT_BUY_FORECAST = 0.4;
const SELL_LONG_THRESHOLD = 0.55;
const SELL_SHORT_THRESHOLD = 0.4;
const MAX_VOLATILITY = 0.05;
const MAX_SHARE_PERCENT = 1.0;
const MIN_SHARES_PURCHASE = 5;
const SHORT_ENABLED = false;
const SCRIPT_INTERVAL = 6000;

const TOAST_DURATION = 15_000;

export function maybeSell(ns: NS, sym: string, ownedLong: number, ownedShort: number): void {
  const forecast = ns.stock.getForecast(sym);

  if (ownedLong > 0 && forecast < SELL_LONG_THRESHOLD) {
    const stockPrice = ns.stock.sellStock(sym, ownedLong);

    ns.toast(`Sold ${ownedLong} Long shares of ${sym} for ${ns.formatNumber(stockPrice, 3, 1000, false)}`);
  }

  if (SHORT_ENABLED && ownedShort > 0 && forecast > SELL_SHORT_THRESHOLD) {
    const stockPrice = ns.stock.sellShort(sym, ownedShort);

    ns.toast(`Sold ${ownedShort} Short shares of ${sym} for ${ns.formatNumber(stockPrice, 3, 1000, false)}`);
  }
}

export function maybeBuy(ns: NS, sym: string, ownedLong: number, ownedShort: number): void {
  const forecast = ns.stock.getForecast(sym);
  const volatility = ns.stock.getVolatility(sym);
  const price = ns.stock.getAskPrice(sym);
  const money = ns.getServerMoneyAvailable('home');

  if (volatility <= MAX_VOLATILITY) {
    if (forecast >= LONG_BUY_FORECAST) {
      if (money - MONEY_KEEP >= ns.stock.getPurchaseCost(sym, MIN_SHARES_PURCHASE, 'Long')) {
        const maxShares = ns.stock.getMaxShares(sym) * MAX_SHARE_PERCENT - ownedLong;
        const shares = Math.min((money - MONEY_KEEP - BUFFER) / price, maxShares);
        const buyPrice = ns.stock.buyStock(sym, shares);

        if (buyPrice > 0) {
          ns.toast(
            `Bought ${Math.round(shares)} Long shares of ${sym} for ${ns.formatNumber(buyPrice, 3, 1000, false)}`,
            'success',
            TOAST_DURATION,
          );
        }
      }
    }

    if (SHORT_ENABLED && forecast <= SHORT_BUY_FORECAST) {
      if (money - MONEY_KEEP >= ns.stock.getPurchaseCost(sym, MIN_SHARES_PURCHASE, 'Short')) {
        const maxShares = ns.stock.getMaxShares(sym) * MAX_SHARE_PERCENT - ownedShort;
        const shares = Math.min((money - MONEY_KEEP - BUFFER) / price, maxShares);
        const buyPrice = ns.stock.buyShort(sym, shares);

        if (buyPrice > 0) {
          ns.toast(
            `Bought ${Math.round(shares)} Short shares of ${sym} for ${ns.formatNumber(buyPrice, 3, 1000, false)}`,
            'success',
            TOAST_DURATION,
          );
        }
      }
    }
  }
}

export function estimatedValue(
  ns: NS,
  sym: string,
  ownedLong: number,
  priceLong: number,
  ownedShort: number,
  priceShort: number,
): number {
  const bidPrice = ns.stock.getBidPrice(sym);
  const longProfit = ownedLong * (bidPrice - priceLong) - 2 * BUFFER;
  const shortProfit = ownedShort * Math.abs(bidPrice - priceShort) - 2 * BUFFER;

  return longProfit + shortProfit + ownedLong * priceLong + ownedShort * priceShort;
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.clearLog();
  ns.ui.openTail();

  while (true) {
    // sort stocks by |forecast - 0.5|, descending
    const stocks = ns.stock.getSymbols().sort((a, b) => {
      const forecastA = ns.stock.getForecast(a);
      const forecastB = ns.stock.getForecast(b);
      return Math.abs(forecastB - 0.5) - Math.abs(forecastA - 0.5);
    });

    let currentWorth = 0;

    for (const sym of stocks) {
      const [ownedLong, priceLong, ownedShort, priceShort] = ns.stock.getPosition(sym);

      if (ownedLong > 0 || ownedShort > 0) maybeSell(ns, sym, ownedLong, ownedShort);

      maybeBuy(ns, sym, ownedLong, ownedShort);

      currentWorth += estimatedValue(ns, sym, ownedLong, priceLong, ownedShort, priceShort);
    }

    ns.print('---------------------------------------------------');
    ns.print(`Current Stock Worth: ${ns.formatNumber(currentWorth, 3, 1000, false)}`);
    ns.print(`Current Net Worth: ${ns.formatNumber(currentWorth + ns.getPlayer().money, 3, 1000, false)}`);
    ns.print(new Date().toLocaleTimeString() + ' - Running ...');
    ns.print('---------------------------------------------------');

    await ns.sleep(SCRIPT_INTERVAL);
    ns.clearLog();
  }
}
