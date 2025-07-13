import { Metrics } from '@/lib/Metrics';

const COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };

export const JOB_TYPES = ['hack', 'weaken1', 'grow', 'weaken2'] as const;
type JobType = (typeof JOB_TYPES)[number];

export class Job {
  type: JobType;
  end: number;
  time: number;
  target: string;
  threads: number;
  server: string;
  report: boolean;
  port: number;
  batch: number;

  constructor(type: JobType, metrics: Metrics, batch = 0) {
    this.type = type;
    this.end = metrics.end;
    this.time = metrics.times[type];
    this.target = metrics.target;
    this.threads = metrics.threads[type];
    this.server = 'none';
    this.report = true;
    this.port = metrics.port;
    this.batch = batch;
  }

  get cost() {
    return this.threads * COSTS[this.type];
  }
}
