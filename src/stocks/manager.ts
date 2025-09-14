import { NS } from '@ns';
import { StockMaster } from './StockMaster';

function initializeHUD() {
  const d = eval('document') as Document;

  let stockHtmlDisplay = d.getElementById('stock-display-1');
  let totalHtmlDisplay = d.getElementById('total-display-1');
  if (stockHtmlDisplay !== null && totalHtmlDisplay !== null) {
    return { stock: stockHtmlDisplay, total: totalHtmlDisplay };
  }

  const customElements = d.getElementById('overview-extra-hook-0')?.parentElement?.parentElement;
  if (!customElements) throw 'Failed to get custom elements.';

  const stockValueTracker = customElements.cloneNode(true) as HTMLElement;
  stockValueTracker.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  stockValueTracker.querySelectorAll('p').forEach((el, i) => (el.id = `stock-display-${i}`));

  stockHtmlDisplay = stockValueTracker.querySelector('#stock-display-1') as HTMLElement;
  stockValueTracker.querySelectorAll('p')[0].innerText = 'Stock';
  stockHtmlDisplay.innerText = '$0.000 ';

  // clone the stock display node to create total display
  const totalValueTracker = customElements.cloneNode(true) as HTMLElement;
  totalValueTracker.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  totalValueTracker.querySelectorAll('p').forEach((el, i) => (el.id = `total-display-${i}`));

  totalHtmlDisplay = totalValueTracker.querySelector('#total-display-1') as HTMLElement;
  totalValueTracker.querySelectorAll('p')[0].innerText = 'Total';
  totalHtmlDisplay.innerText = '$0.000 ';

  customElements.parentElement?.insertBefore(totalValueTracker, customElements.parentElement?.childNodes[2]);
  customElements.parentElement?.insertBefore(stockValueTracker, customElements.parentElement?.childNodes[2]);

  return { stock: stockHtmlDisplay, total: totalHtmlDisplay };
}

export async function main(ns: NS) {
  ns.disableLog('getServerMoneyAvailable');
  ns.clearLog();

  const hudElement = initializeHUD();
  ns.atExit(() => {
    hudElement.stock.parentElement?.parentElement?.parentElement?.removeChild(
      hudElement.stock.parentElement?.parentElement,
    );
    hudElement.total.parentElement?.parentElement?.parentElement?.removeChild(
      hudElement.total.parentElement?.parentElement,
    );
  });

  const sm = new StockMaster(ns, hudElement);
  await sm.smRun();
}
