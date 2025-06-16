const DISABLED_LOGS = [
  "killall",
  "scp",
  "exec",
  "getServerMoneyAvailable",
  "getServerSecurityLevel",
]

/** @param {NS} ns
 *  @param {ServerInfo[]} servers
 *  @param {ServerInfo} target
 *  @param {string} action
 */
async function deploy(ns, servers, target, action) {
  ns.disableLog("sleep")
  let script = `/scripts/${action}.js`

  for (const server of servers) {
    if (server.root && (server.ram > 0)) {
      if (server.name != "home") {
        ns.killall(server.name)
      } else {
        for (let process of ns.ps(server.name)) {
          if (["scripts/weak.js", "scripts/grow.js", "scripts/hack.js", "scripts/prep.js"].includes(process.filename) &&
              process.pid != ns.pid) {
            ns.kill(process.pid)
          }
        }
      }
      ns.scp(script, server.name)
      ns.exec(script, server.name, Math.floor(server.ram / 1.75), target.name)

      await ns.sleep(20)
    }
  }
  ns.enableLog("sleep")
}

/** @param {NS} ns
 *  @param {ServerInfo} target
 */
function moneyThreshold(ns, target) {
  return ns.getServerMoneyAvailable(target.name) > (target.money * 0.95)
}

/** @param {NS} ns
 *  @param {ServerInfo} target
 */
function securityThreshold(ns, target) {
  return ns.getServerSecurityLevel(target.name) < (target.security + 5)
}

/** @param {NS} ns */
export async function main(ns) {
  // Make the logs quiet
  DISABLED_LOGS.forEach((func) => ns.disableLog(func))

  if (ns.args.length != 1) {
    ns.print("usage: prep.js <target>")
    ns.exit()
  }

  let servers = JSON.parse(ns.read("/data/servers.json"))
  let target = servers.find((srv) => srv.name == ns.args[0])

  while (true) {
    if (!securityThreshold(ns, target)) {
      await deploy(ns, servers, target, "weak")
      ns.print("Weakening.")
      await ns.sleep(ns.getWeakenTime(target.name) + 1000)
    } else if (!moneyThreshold(ns, target)) {
      await deploy(ns, servers, target, "grow")
      ns.print("Growing.")
      await ns.sleep(ns.getGrowTime(target.name) + 1000)
    } else {
      await deploy(ns, servers, target, "hack")
      ns.print("Hacking.")
      await ns.sleep(ns.getHackTime(target.name) + 1000)
    }

    // update servers incase we have more available
    servers = JSON.parse(ns.read("/data/servers.json"))
    target = servers.find((srv) => srv.name == target.name)
  }
}