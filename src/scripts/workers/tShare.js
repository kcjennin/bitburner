export async function main(ns) {
  const { port, type, server } = JSON.parse(ns.args[0].toString());
  await ns.share();
  ns.writePort(port, type + server);
}
