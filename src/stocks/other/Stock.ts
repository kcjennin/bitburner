type TransactionType = 'buyStock' | 'buyShort' | 'sellStock' | 'sellShort';

export interface BuyRejection<T> {
    blackedOut: T;
    maxxed: T;
    goodReturn: T;
    validType: T;
    tixBlackedOut: T;
    tixRecentInversion: T;
    tixLowProbability: T;
}

export class Stock {
  private static ENABLE_SHORTS = false;

  private static HISTORY_SIZE = 151;
  private static FORECAST_WINDOW = 51;
  private static BLACKOUT_WINDOW = 10;
  private static MIN_HOLD = 10;
  private static INVERSION_TOLERANCE = 0.1;

  // 4S thresholds
  private static BUY_THRESHOLD = 1e-4;
  private static SELL_THRESHOLD = 0;

  // TIX thresholds
  private static TIX_BUY_THRESHOLD_PROB = 0.15
  private static TIX_BUY_THRESHOLD = 15e-4;
  private static TIX_SELL_THRESHOLD = 5e-4;

  public static MARKET_CYCLE = 75;
  public static INVERSION_WINDOW = 10;

  // constant from construction
  maxShares: number;
  has4s: boolean;

  // stock properties
  ask = 0;
  bid = 0;
  forecastShadow = 0.5;
  forecast = 0.5;
  stdev = 0;
  long = 0;
  longPrice = 0;
  short = 0;
  shortPrice = 0;
  volatility = 0;
  ticksHeld = 0;
  lastInversion = 0;

  // need price history for pre-4S calculations
  history: number[] = [];

  constructor(private readonly ns: NS, public sym: string) {
    if (!ns.stock.hasTIXAPIAccess()) {
      throw 'Cannot manage stocks without TIX API.';
    }

    this.maxShares = ns.stock.getMaxShares(sym);
    this.has4s = ns.stock.has4SDataTIXAPI();
  }

  refresh(): boolean {
    if (!this.has4s) {
      this.history.unshift((this.ask + this.bid) / 2);
      if (this.history.length > Stock.HISTORY_SIZE) this.history.pop();
    }

    let hasInverted = false;
    if (this.inversionDetected()) {
      this.lastInversion = this.has4s ? 0 : Stock.INVERSION_WINDOW;
      hasInverted = true;
    } else {
      this.lastInversion++;
    }

    this.ask = this.ns.stock.getAskPrice(this.sym);
    this.bid = this.ns.stock.getBidPrice(this.sym);
    this.forecastShadow = this.forecast;
    [this.forecast, this.stdev] = this.getForecast();
    [this.long, this.longPrice, this.short, this.shortPrice] = this.ns.stock.getPosition(this.sym);
    this.volatility = this.getVolatility();

    if (this.long > 0 || this.short > 0) this.ticksHeld++;
    else this.ticksHeld = 0;

    return hasInverted;
  }

  private getForecast(): [number, number] {
    // predict whether this stock is trending up or down
    if (this.has4s) {
      return [this.ns.stock.getForecast(this.sym), 0];
    }

    const forecastWindow = Math.min(Stock.FORECAST_WINDOW, this.lastInversion);
    const forecast = Stock.historyForecast(this.history.slice(0, forecastWindow));
    const stdev = Math.sqrt((forecast * (1 - forecast)) / forecastWindow);
    return [forecast, stdev];
  }

  private getVolatility(): number {
    // predict how much this stock can change in a single cycle
    if (this.has4s) {
      return this.ns.stock.getVolatility(this.sym);
    }

    // get the largest observed % movement in a single tick
    return this.history
      .reduce((max, price, idx) =>
        Math.max(max, idx == 0 ? 0 : Math.abs(this.history[idx - 1] - price) / price), 0);
  }

  get expectedReturn() {
    const normal = this.forecast - 0.5;
    const conservative = normal < 0 ? Math.min(0, normal + this.stdev) : Math.max(0, normal - this.stdev);
    return this.volatility * conservative;
  }

  get absoluteReturn() {
    return Math.abs(this.expectedReturn);
  }

  get bullish() {
    return this.forecast > 0.5;
  }

  get bearish() {
    return !this.bullish;
  }

  get shares() {
    return this.long + this.short;
  }

  get owned() {
    return this.shares > 0;
  }

  get longValue() {
    return this.long * this.bid;
  }

  get shortValue() {
    return this.short * (2 * this.shortPrice - this.ask);
  }

  get value() {
    return this.longValue + this.shortValue;
  }

  get spreadRecoverTime() {
    return Math.log(this.ask / this.bid) / Math.log(1 + this.absoluteReturn);
  }

  get blackoutWindow() {
    return Math.ceil(this.spreadRecoverTime);
  }

  shouldSell(): boolean {
    const threshold = this.has4s ? Stock.SELL_THRESHOLD : Stock.TIX_SELL_THRESHOLD;
    return (
      this.absoluteReturn <= threshold ||
      this.bullish && this.short > 0 ||
      this.bearish && this.long > 0
    ) && !(
      // pre4s we need to wait for the hold time
      !this.has4s && this.ticksHeld < Stock.MIN_HOLD
    );
  }

  shouldBuy(ticksToCycle: number): [boolean, BuyRejection<boolean>] {
    const threshold = this.has4s ? Stock.BUY_THRESHOLD : Stock.TIX_BUY_THRESHOLD;

    const reasons = {
      blackedOut: this.blackoutWindow >= ticksToCycle,
      maxxed: this.shares === this.maxShares,
      goodReturn: this.absoluteReturn > threshold,
      validType: Stock.ENABLE_SHORTS || this.bullish,
      tixBlackedOut: false,
      tixRecentInversion: false,
      tixLowProbability: false,
    };

    if (!this.has4s) {
      reasons.tixBlackedOut = Math.max(Stock.MIN_HOLD, Stock.BLACKOUT_WINDOW) >= ticksToCycle;
      reasons.tixRecentInversion = this.lastInversion < Stock.INVERSION_WINDOW;
      reasons.tixLowProbability = Math.abs(this.forecast - 0.5) < Stock.TIX_BUY_THRESHOLD_PROB;
    }

    const decision = !reasons.blackedOut
      && !reasons.maxxed
      && reasons.goodReturn
      && reasons.validType
      && !reasons.tixBlackedOut
      && !reasons.tixRecentInversion
      && !reasons.tixLowProbability;

    return [decision, reasons];
  }

  inversionDetected(): boolean {
    if (!this.has4s) {
      // try to predict inversions early
      const near = Stock.historyForecast(this.history.slice(0, Stock.INVERSION_WINDOW));
      // probability prior to potential inversion
      const prev = Stock.historyForecast(this.history.slice(Stock.INVERSION_WINDOW, Stock.INVERSION_WINDOW + Stock.MARKET_CYCLE))
      return Stock.detectInversion(prev, near);
    } else {
      return Stock.detectInversion(this.forecastShadow, this.forecast);
    }
  }

  async sellAll(): Promise<boolean> {
    let sold = {
      long: 0,
      short: 0,
    }
    if (this.long) {
      sold.long = await this.transaction('sellStock');
      this.ns.print(`Sold ${this.long} long shares of ${this.sym} @ ${this.ns.formatNumber(sold.long)}`)
    }
    if (this.short) {
      sold.short = await this.transaction('sellShort');
      this.ns.print(`Sold ${this.short} short shares of ${this.sym} @ ${this.ns.formatNumber(sold.short)}`)
    }
  
    return sold.long > 0 || sold.short > 0;
  }

  async transaction(action: TransactionType): Promise<number> {
    const shares = action === 'buyStock' || action === 'sellStock' ? this.long : this.short;
    const jobPid = this.ns.run(`/stocks/${action}.ts`, 1, this.sym, shares);
    const jobPort = this.ns.getPortHandle(jobPid);
  
    if (jobPort.empty()) await jobPort.nextWrite();
    return jobPort.read();
  }

  private static historyForecast(hist: number[]): number {
    // get the number of recorded price increases in the given history and scale to [0, 1]
    if (hist.length < 2) return 0.5;
    return hist.reduce((upticks, price, idx) => idx === 0 ? 0 : (hist[idx - 1] > price ? upticks + 1 : upticks)) / (hist.length - 1);
  }

  private static detectInversion(prev: number, curr: number): boolean {
    // an inversion is detected when the two probabilites are far enough apart and within tolerance of
    // curr = (1 - prev)
    const tol2 = Stock.INVERSION_TOLERANCE / 2;
    return ((prev >= 0.5 + tol2) && (curr <= 0.5 - tol2) && curr <= (1 - prev) + Stock.INVERSION_TOLERANCE)
      || ((prev <= 0.5 - tol2) && (curr >= 0.5 + tol2) && curr >= (1 - prev) - Stock.INVERSION_TOLERANCE);
  }
}
