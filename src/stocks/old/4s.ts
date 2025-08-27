import { NS } from '@ns';

const COMMISSION = 100000;
const MIN_HOLD = 10;

class Stock {
  maxShares: number;
  priceHistory: number[] = [];
  sharesLong = 0;
  sharesShort = 0;
  boughtPrice = 0;
  boughtPriceShort = 0;
  ask = 0;
  bid = 0;
  vol = 0;
  prob = 0.5;
  ticksHeld = 0;
  lastInversion = 0;

  constructor(private readonly ns: NS, public sym: string) {
    this.maxShares = ns.stock.getMaxShares(sym);
  }

  refresh() {
    const wasBullish = this.bullish;
    this.ask = this.ns.stock.getAskPrice(this.sym);
    this.bid = this.ns.stock.getBidPrice(this.sym);
    this.vol = this.ns.stock.getVolatility(this.sym);
    this.prob = this.ns.stock.getForecast(this.sym);

    if (wasBullish != this.bullish) {
      this.lastInversion = 0;
    } else {
      this.lastInversion++;
    }

    [this.sharesLong, this.boughtPrice, this.sharesShort, this.boughtPriceShort] = this.ns.stock.getPosition(this.sym);

    if (this.ownedShares > 0) this.ticksHeld++;
    else this.ticksHeld = 0;
  }

  get ownedShares() {
    return this.sharesLong + this.sharesShort;
  }

  get bullish() {
    return this.prob > 0.5;
  }

  get bearish() {
    return !this.bullish;
  }

  get expectedReturn() {
    return this.vol * (this.prob - 0.5);
  }

  get absReturn() {
    return Math.abs(this.expectedReturn);
  }

  get blackoutWindow() {
    return Math.ceil(Math.log(this.ask / this.bid / Math.log(1 + this.absReturn)));
  }

  get positionValue() {
    return this.sharesLong * this.bid + this.sharesShort * (2 * this.boughtPriceShort - this.ask);
  }
}

class StockMaster {
  stocks: Stock[];
  owned: Stock[] = [];
  profit = 0;

  constructor(private readonly ns: NS) {
    this.stocks = ns.stock.getSymbols().map((sym) => new Stock(ns, sym));
  }

  async smRun(): Promise<never> {
    while (true) {
      this.refreshAll();
      await this.sellLosers();
      await this.buyWinners();

      const ranked = this.stocks
        .filter((s) => s.absReturn >= 0.0015 && Math.abs(s.prob - 0.5) >= 0.05)
        .sort((a, b) => a.blackoutWindow - b.blackoutWindow || b.absReturn - a.absReturn)
        .slice(0, 5);

      // this.ns.clearLog();
      this.ns.print('=== Top 5 Stocks (Pre-4S) ===');
      for (const s of ranked) {
        this.ns.print(
          `${s.sym.padEnd(5)} | Prob ${(s.prob * 100).toFixed(1).padStart(5)}% | ` +
            `ER ${s.absReturn.toFixed(4).padStart(6)} bp | ` +
            `Spread ${((100 * (s.ask - s.bid)) / s.ask).toFixed(2).padStart(5)}% | ` +
            `ttProfit ${s.blackoutWindow} ticks | ` +
            `${s.bullish ? 'Bullish' : 'Bearish'} | ` +
            `LI ${String(s.lastInversion).padStart(2)}`,
        );
      }

      await this.ns.stock.nextUpdate();
    }
  }

  refreshAll() {
    this.owned.length = 0;
    for (const s of this.stocks) {
      s.refresh();
      if (s.ownedShares > 0) this.owned.push(s);
    }
  }

  async sellLosers() {
    for (const s of this.owned) {
      if (s.ticksHeld < MIN_HOLD) continue;
      if (s.absReturn < 0 || (s.bullish && s.sharesShort > 0) || (s.bearish && s.sharesLong > 0)) {
        await this.sellAll(s);
      }
    }
  }

  async sellAll(s: Stock) {
    const isLong = s.sharesLong > 0;
    const shares = isLong ? s.sharesLong : s.sharesShort;
    const price = isLong ? this.ns.stock.sellStock(s.sym, shares) : this.ns.stock.sellShort(s.sym, shares);
    const profit = (isLong ? shares * (price - s.boughtPrice) : shares * (s.boughtPriceShort - price)) - COMMISSION;
    this.profit += profit;
    this.ns.print(`Sold ${shares} ${isLong ? 'long' : 'short'} ${s.sym}, profit: ${this.ns.formatNumber(profit, 2)}`);
  }

  async buyWinners() {
    const order = (a: Stock, b: Stock) => a.blackoutWindow - b.blackoutWindow || b.absReturn - a.absReturn;

    const rej = {
      shares: 0,
      return: 0,
      risky: 0,
      history: 0,
    };
    for (const s of this.stocks.sort(order)) {
      // maxxed out on shares
      if (s.ownedShares === s.maxShares) {
        rej.shares++;
        continue;
      }
      // too low of a return
      if (s.absReturn < 0.0015) {
        rej.return++;
        continue;
      }
      // too risky
      if (Math.abs(s.prob - 0.5) < 0.05) {
        rej.risky++;
        continue;
      }
      // has been too long since an inversion, risky
      if (s.lastInversion > 30) {
        rej.history++;
        continue;
      }

      const budget = this.ns.getServerMoneyAvailable('home') * 0.05;
      const price = s.bullish ? s.ask : s.bid;
      const shares = Math.min(s.maxShares - s.ownedShares, Math.floor((budget - COMMISSION) / price));
      if (shares > 0) await this.buy(s, shares);
    }
    // this.ns.print(`SHR ${rej.shares} | RTN ${rej.return} | RSK ${rej.risky} | HST ${rej.history}`);
  }

  async buy(s: Stock, shares: number) {
    const isLong = s.bullish;
    const price = isLong ? this.ns.stock.buyStock(s.sym, shares) : this.ns.stock.buyShort(s.sym, shares);
    this.profit -= COMMISSION;
    this.ns.print(`Bought ${shares} ${isLong ? 'long' : 'short'} ${s.sym} @ ${this.ns.formatNumber(price, 2)}`);
  }
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  const master = new StockMaster(ns);
  await master.smRun();
}
