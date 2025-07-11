import { NS } from '@ns';

const HACKNET = false;
const RAM_COST = 2.5 + (HACKNET ? 4 : 0);

export async function main(ns: NS) {
  ns.ramOverride(RAM_COST);
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

      if (HACKNET) {
        let hacknetTotalProduction = 0;
        let hacknetTotalProfit = 0;

        // Calculate total hacknet income & profit
        for (let index = 0; index <= ns.hacknet.numNodes() - 1; index++) {
          hacknetTotalProduction += ns.hacknet.getNodeStats(index).production;
          hacknetTotalProfit += ns.hacknet.getNodeStats(index).totalProduction;
        }

        headers.push('Hacknet Income: ');
        values.push('$' + ns.formatNumber(hacknetTotalProduction) + '/s');

        headers.push('Hacknet Profit: ');
        values.push('$' + ns.formatNumber(hacknetTotalProfit));
      }

      headers.push('Script Income: ');
      values.push('$' + ns.formatNumber(ns.getTotalScriptIncome()[0]) + '/s');

      headers.push('Script Experience: ');
      values.push(ns.formatNumber(ns.getTotalScriptExpGain()) + '/s');

      headers.push('Share Power: ');
      values.push(ns.formatPercent(ns.getSharePower() - 1));

      headers.push('Karma: ');
      values.push(ns.formatNumber(ns.heart.break(), 0));

      headers.push('People Killed: ');
      values.push(ns.getPlayer().numPeopleKilled);

      headers.push('City: ');
      values.push(ns.getPlayer().city);

      headers.push('Location: ');
      values.push(ns.getPlayer().location.substring(0, 10));

      headers.push('Local Time: ');
      values.push(new Date().toLocaleTimeString());

      hook0.innerText = headers.join(' \n');
      hook1.innerText = values.join('\n');
    } catch (error) {
      ns.print('ERROR- Update Skipped: ' + String(error));
    }

    await ns.sleep(1000);
  }
}
