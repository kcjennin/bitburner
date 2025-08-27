import { NS } from '@ns';
import { StockMaster } from './StockMaster';

function initializeHUD() {
  const d = eval('document') as Document;
  let htmlDisplay = d.getElementById('stock-display-1');
  if (htmlDisplay !== null) return htmlDisplay;

  const customElements = d.getElementById('overview-extra-hook-0')?.parentElement?.parentElement;
  if (!customElements) throw 'Failed to get custom elements.';
  const stockValueTracker = customElements.cloneNode(true) as HTMLElement;

  stockValueTracker.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  stockValueTracker.querySelectorAll('p').forEach((el, i) => (el.id = `stock-display-${i}`));
  htmlDisplay = stockValueTracker.querySelector('#stock-display-1') as HTMLElement;
  stockValueTracker.querySelectorAll('p')[0].innerText = 'Stock';
  htmlDisplay.innerText = '$0.000 ';
  customElements.parentElement?.insertBefore(stockValueTracker, customElements.parentElement?.childNodes[2]);

  return htmlDisplay;
}

export async function main(ns: NS) {
  ns.disableLog('getServerMoneyAvailable');
  ns.clearLog();

  const hudElement = initializeHUD();
  ns.atExit(() =>
    hudElement.parentElement?.parentElement?.parentElement?.removeChild(hudElement.parentElement?.parentElement),
  );

  const sm = new StockMaster(ns, hudElement);
  await sm.smRun();
}
