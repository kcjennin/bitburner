const DISABLED_LOGS = [
  "scan",
  "run",
  "getServerRequiredHackingLevel",
  "getHackingLevel",
  "getServerNumPortsRequired",
  "fileExists",
  "hasRootAccess"
]
const EXCLUDES = ["darkweb"]
const HOME_RESERVED = 64

/** @param {NS} ns
 *  @param {string} server
 */
function hackServer(ns, server) {
  if (ns.hasRootAccess(server)) {
    return true
  }

  let hacks = 0
  if (ns.fileExists("BruteSSH.exe") && ns.brutessh(server)) hacks += 1
  if (ns.fileExists("FTPCrack.exe") && ns.ftpcrack(server)) hacks += 1
  if (ns.fileExists("HTTPWorm.exe") && ns.httpworm(server)) hacks += 1
  if (ns.fileExists("SQLInject.exe") && ns.sqlinject(server)) hacks += 1
  if (ns.fileExists("relaySMTP.exe") && ns.relaysmtp(server)) hacks += 1

  let requiredPorts = ns.getServerNumPortsRequired(server)
  if ((requiredPorts > 0) && (hacks < requiredPorts)) {
    ns.print(`Not enough ports open: ${server}`)
    return false
  }

  ns.nuke(server)
  ns.toast(`${server} has been hacked.`)
  return true
}

/** @param {NS} ns */
export async function main(ns) {
  // Make the logs quiet
  DISABLED_LOGS.forEach((func) => ns.disableLog(func))

  while (true) {
    let servers = [
      { "name": "home", "root": null, "ram": null, "money": null, "security": null, "contract": null },
      ...ns.getPurchasedServers().map((srv) => ({ "name": srv, "root": null, "ram": null, "money": null, "security": null, "contract": null }))
    ]
    let idx = 0

    while (idx < servers.length) {
      servers[idx].root = hackServer(ns, servers[idx].name)
      servers[idx].ram = ns.getServerMaxRam(servers[idx].name)
      servers[idx].money = ns.getServerMaxMoney(servers[idx].name)
      servers[idx].security = ns.getServerMinSecurityLevel(servers[idx].name)
      servers[idx].contract = ns.ls(servers[idx].name).filter((srv) => srv.endsWith(".cct")).length > 0

      if (servers[idx].name == "home") {
        servers[idx].ram -= HOME_RESERVED
      }

      for (const newServer of ns.scan(servers[idx].name)) {
        if (!servers.find((srv) => srv.name == newServer)) {
          servers.push({ "name": newServer, "root": null, "ram": null, "money": null, "security": null })
        }
      }
      idx += 1
    }

    servers = servers.filter((srv) => (!EXCLUDES.includes(srv.name)))
    ns.write("/data/servers.json", JSON.stringify(servers, null, 2), "w")
    await ns.sleep(60000)
  }
}