import { NS } from '@ns';
import { Target } from './Target';

export const JOB_TYPES = ['hack', 'weaken1', 'grow', 'weaken2'] as const;
type JobType = (typeof JOB_TYPES)[number];
const COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };

const OLD_SCRIPTS = {
  hack: '/hacking/workers/tHack.js',
  weaken1: '/hacking/workers/tWeaken.js',
  grow: '/hacking/workers/tGrow.js',
  weaken2: '/hacking/workers/tWeaken.js',
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
    this.report = true;
  }

  cost() {
    return COSTS[this.type] * this.threads;
  }

  script() {
    return OLD_SCRIPTS[this.type];
  }
}

export async function submitJob(ns: NS, job: Job): Promise<number> {
  const pid = ns.exec(job.script(), job.server, { threads: job.threads, temporary: true }, ns.pid, JSON.stringify(job));

  if (pid === 0) {
    const server = ns.getServer(job.server);
    ns.print(`INFO: ${ns.formatNumber(server.maxRam - server.ramUsed)}/${ns.formatNumber(server.maxRam)}`);
    ns.print(job);
    throw 'Failed to execute job.';
  }

  const port = ns.getPortHandle(pid);
  await port.nextWrite();
  return port.read();
}
