import { NS } from '@ns';
import { StockMaster } from './StockMaster';

function initializeHUD(ns: NS) {
  const d = eval('document') as Document;
  const theme = ns.ui.getTheme();

  let stockHtmlDisplay = d.getElementById('stock-display-1');
  let totalHtmlDisplay = d.getElementById('total-display-1');
  if (stockHtmlDisplay !== null && totalHtmlDisplay !== null) {
    return { stock: stockHtmlDisplay, total: totalHtmlDisplay };
  }

  const moneyTableRow = d.getElementById('overview-money-hook')?.parentElement?.parentElement;
  const noBottomRefRow = d.getElementById('overview-hp-hook')?.parentElement?.parentElement;
  if (!moneyTableRow || !noBottomRefRow) throw 'Failed to get custom elements.';

  const stockTableRow = moneyTableRow.cloneNode(true) as HTMLElement;
  stockTableRow.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  stockTableRow.querySelectorAll('p').forEach((el, i) => (el.id = `stock-display-${i}`));

  stockHtmlDisplay = stockTableRow.querySelector('#stock-display-1') as HTMLElement;
  stockTableRow.querySelectorAll('p')[0].innerText = 'Stock';
  stockTableRow.querySelectorAll('p')[0].style.color = theme['money'];
  stockHtmlDisplay.innerText = '$0.000 ';
  stockHtmlDisplay.style.color = theme['money'];

  // clone the stock display node to create total display
  const totalTableRow = moneyTableRow.cloneNode(true) as HTMLElement;
  totalTableRow.querySelectorAll('p > p').forEach((el) => el.parentElement?.removeChild(el));
  totalTableRow.querySelectorAll('p').forEach((el, i) => (el.id = `total-display-${i}`));

  totalHtmlDisplay = totalTableRow.querySelector('#total-display-1') as HTMLElement;
  totalTableRow.querySelectorAll('p')[0].innerText = 'Total';
  totalTableRow.querySelectorAll('p')[0].style.color = theme['money'];
  totalHtmlDisplay.innerText = '$0.000 ';
  totalHtmlDisplay.style.color = theme['money'];

  // remove the bottom border from money and stock
  for (let idx = 0; idx < moneyTableRow.children.length; ++idx) {
    const oldCss = moneyTableRow.children[idx].classList.item(moneyTableRow.children[idx].classList.length - 1);
    const newCss = noBottomRefRow.children[idx].classList.item(noBottomRefRow.children[idx].classList.length - 1);

    if (oldCss && newCss) {
      moneyTableRow.children[idx].classList.replace(oldCss, newCss);
      stockTableRow.children[idx].classList.replace(oldCss, newCss);
    }
  }

  moneyTableRow.after(stockTableRow);
  stockTableRow.after(totalTableRow);

  return { stock: stockHtmlDisplay, total: totalHtmlDisplay };
}

export async function main(ns: NS) {
  ns.disableLog('getServerMoneyAvailable');
  ns.clearLog();

  const hudElement = initializeHUD(ns);
  ns.atExit(() => {
    const d = eval('document') as Document;
    const moneyTableRow = d.getElementById('overview-money-hook')?.parentElement?.parentElement;
    const totalTableRow = hudElement.total.parentElement?.parentElement;

    if (!moneyTableRow || !totalTableRow) return;

    // add the bottom border back to the money row
    for (let idx = 0; idx < moneyTableRow.children.length; ++idx) {
      const oldCss = moneyTableRow.children[idx].classList.item(moneyTableRow.children[idx].classList.length - 1);
      const newCss = totalTableRow.children[idx].classList.item(totalTableRow.children[idx].classList.length - 1);

      if (oldCss && newCss) {
        moneyTableRow.children[idx].classList.replace(oldCss, newCss);
      }
    }

    // remove the stock and total elements
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
