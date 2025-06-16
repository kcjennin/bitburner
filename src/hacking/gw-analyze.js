/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length !== 2) return ns.exit()
  const [t, p] = ns.args.map(Number)

  let lo = 1, hi = t
  while (hi - lo > 0.1) {
    const mid = (lo + hi) / 2
    ns.weakenAnalyze(mid) > ns.growthAnalyzeSecurity(t - mid) ? hi = mid : lo = mid
  }
  ns.tryWritePort(p, [t - Math.ceil(lo), Math.ceil(lo)])
}