export interface SchedulerRunResult {
  claimed: number;
  completed: number;
  deferred: number;
  failed: number;
}

export interface AutomationScheduler {
  runDue(now: Date, workerId: string): Promise<SchedulerRunResult>;
}

