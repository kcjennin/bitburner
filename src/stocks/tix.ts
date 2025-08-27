import { NS } from '@ns';

const COMMISSION = 100000;
const MARKET_CYCLE = 75;
const MAX_HISTORY = 151;
const SHORT_WINDOW = 10;
const LONG_WINDOW = 51;
const INVERSION_TOL = 0.1;
const MIN_HISTORY = 21;
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
    this.ask = this.ns.stock.getAskPrice(this.sym);
    this.bid = this.ns.stock.getBidPrice(this.sym);

    [this.sharesLong, this.boughtPrice, this.sharesShort, this.boughtPriceShort] = this.ns.stock.getPosition(this.sym);

    if (this.ownedShares > 0) this.ticksHeld++;
    else this.ticksHeld = 0;
  }

  updateForecast(cycleTick: number) {
    this.priceHistory.unshift((this.ask + this.bid) / 2);
    if (this.priceHistory.length > MAX_HISTORY) this.priceHistory.pop();

    // assume volatility as the greatest price change (as % difference) in history
    this.vol = this.priceHistory.reduce(
      (m, p, i) => (i ? Math.max(m, Math.abs(this.priceHistory[i - 1] - p) / p) : 0),
      0,
    );

    const near = Stock.forecast(this.priceHistory.slice(0, SHORT_WINDOW));
    const prev = Stock.forecast(this.priceHistory.slice(SHORT_WINDOW, SHORT_WINDOW + MARKET_CYCLE));
    const inverted = Stock.detectInversion(prev, near);
    if (inverted && cycleTick >= SHORT_WINDOW / 2 && cycleTick <= SHORT_WINDOW + 5) {
      this.lastInversion = cycleTick;
    } else {
      this.lastInversion++;
    }

    const len = Math.min(LONG_WINDOW, this.lastInversion);
    this.prob = Stock.forecast(this.priceHistory.slice(0, len));
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

  static forecast(hist: number[]) {
    if (hist.length < 2) return 0.5;
    // get the percent of upticks in the history, [0, 1]
    return hist.reduce((u, p, i) => (i && hist[i - 1] > p ? u + 1 : u), 0) / (hist.length - 1);
  }

  static detectInversion(p1: number, p2: number) {
    const tol2 = INVERSION_TOL / 2;
    return (
      (p1 >= 0.5 + tol2 && p2 <= 0.5 - tol2 && p2 <= 1 - p1 + INVERSION_TOL) ||
      (p1 <= 0.5 - tol2 && p2 >= 0.5 + tol2 && p2 >= 1 - p1 - INVERSION_TOL)
    );
  }
}

class StockMaster {
  stocks: Stock[];
  owned: Stock[] = [];
  profit = 0;
  cycleTick = 0;
  cycleDetected = false;
  inversionThreshold = 0;

  constructor(private readonly ns: NS) {
    this.stocks = ns.stock.getSymbols().map((sym) => new Stock(ns, sym));
  }

  async smRun(): Promise<never> {
    while (true) {
      this.refreshAll();
      this.cycleTick = (this.cycleTick + 1) % MARKET_CYCLE;
      for (const s of this.stocks) s.updateForecast(this.cycleTick);
      this.detectCycle();

      if (this.stocks[0].priceHistory.length >= MIN_HISTORY) {
        await this.sellLosers();
        await this.buyWinners();
      } else {
        this.ns.print(`Building history... ${this.stocks[0].priceHistory.length} / ${MIN_HISTORY}`);
      }

      // const ranked = this.stocks
      //   .filter((s) => s.absReturn >= 0.0015 && Math.abs(s.prob - 0.5) >= 0.15)
      //   .sort((a, b) => a.blackoutWindow - b.blackoutWindow || b.absReturn - a.absReturn)
      //   .slice(0, 5);

      // this.ns.print('=== Top 5 Stocks (Pre-4S) ===');
      // for (const s of ranked) {
      //   this.ns.print(
      //     `${s.sym.padEnd(5)} | Prob ${(s.prob * 100).toFixed(1).padStart(5)}% | ` +
      //       `ER ${s.absReturn.toFixed(4).padStart(6)} bp | ` +
      //       `Spread ${((100 * (s.ask - s.bid)) / s.ask).toFixed(2).padStart(5)}% | ` +
      //       `ttProfit ${s.blackoutWindow} ticks | ` +
      //       `${s.bullish ? 'Bullish' : 'Bearish'} | ` +
      //       `LI ${String(s.lastInversion).padStart(2)}`,
      //   );
      // }

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

  detectCycle() {
    const inversions = this.stocks.filter((s) => s.lastInversion === this.cycleTick);
    if (inversions.length >= this.inversionThreshold) {
      this.cycleDetected = true;
      this.cycleTick = SHORT_WINDOW;
      this.inversionThreshold = Math.max(14, inversions.length);
      this.ns.print(`Cycle adjusted. ${inversions.length} inversions detected.`);
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

    for (const s of this.stocks.sort(order)) {
      // maxxed out on shares
      // too low of a return
      // too volatile
      // hasn't been long enough since the last inversion to predict bull/bear
      if (
        s.ownedShares === s.maxShares ||
        s.absReturn < 0.0015 ||
        Math.abs(s.prob - 0.5) < 0.15 ||
        s.lastInversion < MIN_HISTORY
      )
        continue;

      const budget = this.ns.getServerMoneyAvailable('home') * 0.4;
      const price = s.bullish ? s.ask : s.bid;
      const shares = Math.min(s.maxShares - s.ownedShares, Math.floor((budget - COMMISSION) / price));
      if (shares > 0) await this.buy(s, shares);
    }
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
