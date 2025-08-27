/** @param {NS} ns */
export async function main(ns) {
  const gi = ns.gang.getGangInformation();

  ns.tprint(gi.wantedPenalty);
}