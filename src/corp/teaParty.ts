import { NS } from '@ns';
import { AGRI_NAME, CHEM_NAME, teaAndParty, TOBA_NAME, waitState } from './utils';

export async function main(ns: NS): Promise<void> {
  while (true) {
    await waitState(ns, 'START');
    await teaAndParty(ns, [AGRI_NAME, CHEM_NAME, TOBA_NAME]);
  }
}
