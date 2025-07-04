import { Metrics } from '@/lib/Metrics';
import { COSTS, JobType } from '@/lib/utils';

export class Job {
  type: JobType;
  end: number;
  time: number;
  target: string;
  threads: number;
  cost: number;
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
    this.cost = this.threads * COSTS[type];
    this.server = 'none';
    this.report = true;
    this.port = metrics.port;
    this.batch = batch;
  }
}
