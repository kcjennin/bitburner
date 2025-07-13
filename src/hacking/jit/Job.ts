import { NS } from '@ns';
import { Target } from '@/hacking/jit/Target';

export const JOB_TYPES = ['hack', 'weaken1', 'grow', 'weaken2'] as const;
type JobType = (typeof JOB_TYPES)[number];
const COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
const SCRIPTS = {
  hack: '/lib/workers/tHack.js',
  weaken1: '/lib/workers/tWeaken.js',
  grow: '/lib/workers/tGrow.js',
  weaken2: '/lib/workers/tWeaken.js',
};

export class Job {
  server: string;
  target: string;
  threads: number;
  end: number;
  time: number;
  report: boolean;

  constructor(public type: JobType, target: Target) {
    target.end += target.spacer;

    this.server = 'none';
    this.target = target.name;
    this.threads = target.threads[type];
    this.end = target.end;
    this.time = target.times[type];
    this.report = type === 'weaken2';
  }

  cost() {
    return COSTS[this.type] * this.threads;
  }

  script() {
    return SCRIPTS[this.type];
  }
}

export async function submitJob(ns: NS, job: Job): Promise<number> {
  const pid = ns.exec(job.script(), job.server, { threads: job.threads, temporary: true }, ns.pid, JSON.stringify(job));

  if (pid === 0) {
    ns.print(job);
    throw 'Failed to execute job.';
  }

  const port = ns.getPortHandle(pid);
  await port.nextWrite();
  return port.read();
}

export function copyScripts(ns: NS, server: string) {
  Object.values(SCRIPTS).forEach((s) => ns.scp(s, server));
}
