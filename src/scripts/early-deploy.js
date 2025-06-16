const EXCLUDES = ["home", "darkweb"]
const SCRIPT = "/scripts/early-hack.js"

/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 1) {
    ns.print("usage: early-deploy.js <target>")
    return 1
  }

  var id = ns.run("/scripts/prep.js", 1, ns.args[0])

  while (ns.ps().find((process) => process.pid == id) != null) {
    await ns.sleep(1000)
  }

  var servers = []
  while (true) {
    var server_file = JSON.parse(ns.read("/data/servers.json")).filter((srv) => srv.root)
    // only re-run the scripts if the servers have changed
    if (servers.length < server_file.length) {
      servers = server_file

      const target = servers.find((srv) => srv.name == ns.args[0])
      for (const server of servers) {
        if (server.root && !EXCLUDES.includes(server.name) && (server.ram > 0)) {
          ns.killall(server.name)
          ns.scp(SCRIPT, server.name)
          ns.exec(SCRIPT, server.name, Math.floor(server.ram / 2.2), target.name, target.money, target.security)
          await ns.sleep(200)
        }
      }
    }
    // 1 minute
    await ns.sleep(60000)
  }
}