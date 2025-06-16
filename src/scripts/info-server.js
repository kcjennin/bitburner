/** @param {NS} ns
 *  @param {boolean} all
 */
function getAllServers(ns, all = false) {
  var servers = ["home"]
  var result = []

  var idx = 0
  while (idx < servers.length) {
    for (const newServer of ns.scan(servers[idx])) {
      if (servers.indexOf(newServer) < 0) {
        servers.push(newServer)
        if (all || (ns.hasRootAccess(newServer) && (ns.getServerMaxMoney(newServer) > 0))) {
          result.push(newServer)
        }
      }
    }
    idx += 1
  }

  return result
}

/** @param {NS} ns
 *  @param {string} server
 */
function getServerData(ns, server) {
  var money = ns.getServerMoneyAvailable(server)
  var moneyMax = ns.getServerMaxMoney(server)
  var securityLvl = ns.getServerSecurityLevel(server)
  var securityMin = ns.getServerMinSecurityLevel(server)
  var ram = ns.getServerMaxRam(server)
  return `\n${server}:\n` +
    `  money: ${parseInt(money)} / ${moneyMax}\n` +
    `  security: ${parseInt(securityLvl)} (${securityMin})\n` +
    `  RAM: ${ram}`
}


/** @param {NS} ns */
function getServers(ns) {
  if (ns.args.length >= 1) {
    return ns.args
  } else {
    return getAllServers(ns, false)
  }
}

export function autocomplete(data) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns) {
  getServers(ns).forEach((server) => ns.tprint(getServerData(ns, server)))
}