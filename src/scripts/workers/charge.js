export async function main(ns) {
  const [x, y, port = 0] = ns.args;
  await ns.stanek.chargeFragment(x, y);
  if (port) ns.writePort(port, 0);
}
