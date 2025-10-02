import { NS } from '@ns';
import { findScripts } from './pgrep';

export async function main(ns: NS): Promise<void> {
  const {
    _: [pattern = '.*'],
  } = ns.flags([]) as { _: string[] };

  const scripts = findScripts(ns, pattern);

  if (scripts.length === 0) {
    ns.tprint('No matching scripts found.');
  } else if (scripts.length > 1) {
    const output: string[] = [];
    scripts.forEach((pi) =>
      output.push(`(PID - ${pi.pid}, RAM - ${ns.formatRam(pi.ram)}) ${pi.filename} ${pi.args.join(' ')}`),
    );
    ns.tprint(`Multiple matching scripts:\n${output.join('\n')}`);
  } else {
    const [script] = scripts;
    ns.kill(script.pid);
    await ns.sleep(100);
    ns.run(script.filename, script.threads, ...script.args);
  }
}
