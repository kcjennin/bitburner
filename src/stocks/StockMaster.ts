import { NetscriptPort, NS } from '@ns';
import { Stock, BuyReasons } from './Stock';

export class StockMaster {
  private static COMMISSION = 100e3;
  private static MARKET_CYCLE = 75;

  private static RESERVE = 25e6;
  private static RATIO_LIQUID = 0.4;
  private static KEEP_CASH = 0.2;
  private static DIVERSIFICATION = 0.34;
  private static INVERSION_AGREEMENT_THRESHOLD = 6;

  private static PURCHASE_4S_EXPENDITURE = 0.8;
  private static COST_4S = 26e9;

  private static TIX_MIN_HISTORY = 21;

  has4s: boolean;
  port: NetscriptPort;

  constructor(private readonly ns: NS, private hudElement?: { stock: HTMLElement; total: HTMLElement }) {
    if (!ns.stock.hasTIXAPIAccess()) {
      throw 'TIX API is required to run StockMaster';
    }
    this.has4s = ns.stock.has4SDataTIXAPI();
    this.port = ns.getPortHandle(ns.pid);
  }

  async smRun(): Promise<never> {
    const symbols = this.ns.stock.getSymbols();
    const stocks = symbols.map((sym) => new Stock(this.ns, sym));

    let cycleTick = -1;

    while (true) {
      await this.ns.stock.nextUpdate();
      cycleTick = (cycleTick + 1) % StockMaster.MARKET_CYCLE;
      this.ns.print(`=== Cycle ${cycleTick} ===`);

      // update all the stocks and collect their total value
      let heldStocks: Stock[] = [];
      let inversions = 0;
      const holdings = stocks.reduce((total, stock) => {
        if (stock.refresh()) inversions++;
        if (stock.owned) heldStocks.push(stock);
        return total + stock.value;
      }, 0);

      const money = this.ns.getServerMoneyAvailable('home');
      const corpus = holdings + money;
      const maxHoldings = (1 - (this.has4s ? 0 : StockMaster.KEEP_CASH)) * corpus;

      const updateHUD = (doUpdate: boolean) => {
        if (this.hudElement) {
          if (doUpdate) heldStocks = stocks.filter((stock) => stock.owned);
          if (heldStocks.length > 0) {
            const liquidationValue = heldStocks.reduce(
              (sum, stock) => sum - (stock.owned ? StockMaster.COMMISSION : 0) + stock.value,
              0,
            );
            this.hudElement.stock.innerText = '$' + this.ns.formatNumber(liquidationValue);
            this.hudElement.total.innerText = '$' + this.ns.formatNumber(money + liquidationValue);
          } else {
            this.hudElement.stock.innerText = '$0.000';
            this.hudElement.total.innerText = '$' + this.ns.formatNumber(money);
          }
        }
      };

      updateHUD(false);

      // if our net worth is great enough to get the 4S data, do that
      if (!this.has4s && corpus * StockMaster.PURCHASE_4S_EXPENDITURE > StockMaster.COST_4S) {
        // liquidate everything
        for (const stock of heldStocks) {
          await stock.sellAll();
        }
        if (this.hudElement) {
          this.hudElement.stock.innerText = '$0.000';
          this.hudElement.total.innerText = '$' + this.ns.formatNumber(this.ns.getServerMoneyAvailable('home'));
        }

        this.has4s = await buy4s(this.ns);
        this.ns.print('Bought 4S Data API Access.');
        continue;
      }

      // if we're just using TIX we need to wait until sufficient history is gathered
      if (!this.has4s && stocks[0].history.length < StockMaster.TIX_MIN_HISTORY) {
        this.ns.print(`Building history... (${stocks[0].history.length} / ${StockMaster.TIX_MIN_HISTORY})`);
        continue;
      }

      // add the forecast data to the data port for other programs to use
      if (!this.port.empty()) this.port.clear();
      this.port.write(JSON.stringify(Object.fromEntries(stocks.map((stock) => [stock.sym, stock.bullish]))));

      if (inversions >= StockMaster.INVERSION_AGREEMENT_THRESHOLD) {
        cycleTick = this.has4s ? 0 : Stock.INVERSION_WINDOW;
        // if we've found the boundary don't adjust it unless we find an even more
        // certain agreement
        StockMaster.INVERSION_AGREEMENT_THRESHOLD = Math.max(14, inversions);
        this.ns.print('Detected inversion. Updating Market Cycle boundary.');
      }

      // try to sell appropriate stocks
      let didSale = false;
      for (const stock of heldStocks.filter((stock) => stock.shouldSell())) {
        didSale = didSale || (await stock.sellAll());
      }

      // don't buy after a sale
      if (didSale) {
        updateHUD(true);
        continue;
      }

      const sortedStocks = stocks.sort(StockMaster.purchaseOrder);
      this.ns.print(Stock.tableHeader());
      sortedStocks.slice(0, 5).forEach((stock) => {
        this.ns.print(stock.toTableRow());
      });

      // try to buy appropriate stocks
      if (money / corpus > StockMaster.RATIO_LIQUID) {
        let moneyAvailable = Math.min(money - StockMaster.RESERVE, maxHoldings - holdings);
        // GET ESTIMATED CYCLE TICK
        const ticksToCycle = StockMaster.MARKET_CYCLE - cycleTick;

        const allReasons: BuyReasons<number> = {
          notBlackedOut: 0,
          goodReturn: 0,
          notMaxxed: 0,
          validType: 0,
          tixNotBlackedOut: 0,
          tixNotRecentInversion: 0,
          tixHighProbability: 0,
        };

        const buyStocks = sortedStocks.filter((stock) => {
          const [decision, stockReasons] = stock.shouldBuy(ticksToCycle);

          // if the reason disqualified the stock log it
          for (const [reason, result] of Object.entries(stockReasons) as [keyof BuyReasons<boolean>, boolean][]) {
            if (!result) allReasons[reason] += 1;
          }

          return decision;
        });

        // top stocks display
        for (const stock of buyStocks) {
          if (moneyAvailable <= 0) break;

          const budget = Math.min(
            moneyAvailable,
            maxHoldings * (this.has4s ? 1 : StockMaster.DIVERSIFICATION) - stock.value,
          );
          const price = stock.bullish ? stock.ask : stock.bid;
          const canPurchaseShares = Math.floor((budget - StockMaster.COMMISSION) / price);
          const shares = Math.min(stock.maxShares - stock.shares, canPurchaseShares);
          if (shares <= 0) continue;
          const endValue = shares * price * (stock.absoluteReturn + 1) ** (ticksToCycle - 1);

          // only buy if we can actually work off the commission
          if (endValue > 2 * StockMaster.COMMISSION) {
            const bought = await (stock.bullish
              ? stock.transaction('buyStock', shares)
              : stock.transaction('buyShort', shares));
            if (bought > 0) {
              moneyAvailable -= bought * shares;
              this.ns.print(
                `Bought ${stock.bullish ? stock.long : stock.short} ${stock.bullish ? 'long' : 'short'} shares of ${
                  stock.sym
                } @ ${this.ns.formatNumber(bought)}`,
              );
            }
          }
        }

        this.ns.print(JSON.stringify(allReasons, undefined, '  '));
      } else {
        /* do nothing */
      }

      updateHUD(true);
    }
  }

  private static purchaseOrder(a: Stock, b: Stock): number {
    const threshold = 5;

    const aLow = a.blackoutWindow < threshold;
    const bLow = b.blackoutWindow < threshold;

    if (aLow && !bLow) return -1;
    if (!aLow && bLow) return 1;

    if (aLow && bLow) {
      // Both under threshold → sort by return
      return b.absoluteReturn - a.absoluteReturn;
    }

    // Both >= threshold → sort by window, then return
    return a.blackoutWindow - b.blackoutWindow || b.absoluteReturn - a.absoluteReturn;
  }
}

async function buy4s(ns: NS): Promise<boolean> {
  const jobPid = ns.run(`/stocks/buy4s.js`);
  const jobPort = ns.getPortHandle(jobPid);

  if (jobPort.empty()) await jobPort.nextWrite();
  return jobPort.read();
}
