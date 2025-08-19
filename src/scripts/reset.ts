import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  ns.singularity.softReset('/scripts/on-reset.js');
}
