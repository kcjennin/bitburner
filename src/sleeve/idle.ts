import { NS } from '@ns';

const NUM_SLEEVES = 8;

export async function main(ns: NS): Promise<void> {
  for (let sn = 0; sn < NUM_SLEEVES; ++sn) {
    ns.sleeve.setToIdle(sn);
  }
}
