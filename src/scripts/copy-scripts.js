/** @param {NS} ns */
export async function main(ns) {
  let server = ns.args[0]
  ns.scp('/scripts/weak.js', server)
  ns.scp('/scripts/grow.js', server)
  ns.scp('/scripts/hack.js', server)
}
