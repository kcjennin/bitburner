/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 3) {
    ns.print("usage: early-hack.js <target> <max_money> <min_security>")
    return
  }

  var target = ns.args[0]
  var maxMoney = ns.args[1]
  var minSecurity = ns.args[2]

  while (true) {

    if (ns.getServerSecurityLevel(target) > (minSecurity + 5)) {
      await ns.weaken(target)
    } else if (ns.getServerMoneyAvailable(target) < (maxMoney * 0.95)) {
      await ns.grow(target)
    } else {
      await ns.hack(target)
    }
  }
}