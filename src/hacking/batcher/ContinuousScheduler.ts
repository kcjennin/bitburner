import { NS } from '@ns';

export class ContinuousScheduler {
  stopped: number;
  running: number;

  constructor(private readonly ns: NS) {
    this.stopped = 0;
    this.running = 0;
  }

  size() {
    // also add anything in the queue?
    return this.running;
  }
}
