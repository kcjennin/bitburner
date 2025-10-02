import { NS, ScriptArg } from '@ns';

export interface RunningScript {
  pid: number;
  threads: number;
  ram: number;
  filename: string;
  args: ScriptArg[];
}

export function findScripts(ns: NS, pattern: string): RunningScript[] {
  return ns
    .ps()
    .filter((pi) => pi.filename.match(pattern))
    .map((pi) => ({
      pid: pi.pid,
      threads: pi.threads,
      ram: ns.getScriptRam(pi.filename),
      filename: pi.filename,
      args: pi.args,
    }));
}

export async function main(ns: NS): Promise<void> {
  const {
    _: [pattern = '.*'],
  } = ns.flags([]) as { _: string[] };

  const output: string[] = [];
  findScripts(ns, pattern).forEach((pi) =>
    output.push(`(PID - ${pi.pid}, RAM - ${ns.formatRam(pi.threads * pi.ram)}) ${pi.filename} ${pi.args.join(' ')}`),
  );

  ns.tprint('\n' + output.join('\n'));
}
