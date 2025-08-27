import { NS } from '@ns';

export async function main(ns: NS) {
  const doc = eval('document');

  // Hook into game's overview
  const hook0 = doc.getElementById('overview-extra-hook-0');
  const hook1 = doc.getElementById('overview-extra-hook-1');
  ns.atExit(() => {
    hook0.innerText = '';
    hook1.innerText = '';
  });

  if (!hook0 || !hook1) {
    throw new Error('Failed to get hooks.');
  }

  while (true) {
    try {
      const headers = [];
      const values = [];

      headers.push('----------');
      values.push('----------');

      headers.push('Karma');
      values.push(ns.formatNumber(ns.heart.break(), 0));

      if (ns.stock.hasWSEAccount()) {
        const investment = ns.stock.getSymbols().reduce((total, sym) => {
          const [l, , s] = ns.stock.getPosition(sym);
          return total + ns.stock.getSaleGain(sym, l, 'Long') + ns.stock.getSaleGain(sym, s, 'Short');
        }, 0);

        headers.push('Stock Value');
        values.push('$' + ns.formatNumber(investment));
      }

      hook0.innerText = headers.join(' \n');
      hook1.innerText = values.join('\n');
    } catch (error) {
      ns.print('ERROR- Update Skipped: ' + String(error));
    }

    await ns.sleep(1000);
  }
}
