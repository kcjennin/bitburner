import { CrimeType, NS } from '@ns';

const SLEEVES = [0, 1, 2, 3, 4, 5, 6, 7];

export async function main(ns: NS): Promise<void> {
  const {
    _: [crime],
  } = ns.flags([]) as { _: string[] };
  if (!Object.values(ns.enums.CrimeType).includes(crime as CrimeType)) {
    ns.tprint(`Invalid crime type: ${crime}`);
    ns.exit();
  }

  SLEEVES.forEach((sn) => ns.sleeve.setToCommitCrime(sn, crime as CrimeType));
}
