import { NS } from '@ns';
import { buyOptimalAmountOfInputMaterials, setSmartSupplyData } from './lib/utils';

export async function main(ns: NS): Promise<void> {
  while (true) {
    const { prevState, nextState } = ns.corporation.getCorporation();

    if (prevState === 'PURCHASE') {
      setSmartSupplyData(ns);
    }

    if (nextState === 'PURCHASE') {
      buyOptimalAmountOfInputMaterials(ns);
    }

    await ns.corporation.nextUpdate();
  }
}
