export class GenerationQueue {
  private readonly pending: string[] = [];
  private readonly retryTimers: NodeJS.Timeout[] = [];
  private activeCount = 0;

  constructor(
    private readonly executor: (jobId: string) => Promise<void>,
    private readonly concurrency = 1,
  ) {}

  push(jobId: string): void {
    this.pending.push(jobId);
    this.scheduleDrain();
  }

  scheduleRetry(jobId: string, delayMs: number): void {
    const t = setTimeout(() => this.push(jobId), delayMs);
    this.retryTimers.push(t);
  }

  /** Cancel all pending retry timers. Call on server shutdown. */
  destroy(): void {
    for (const t of this.retryTimers) clearTimeout(t);
    this.retryTimers.length = 0;
  }

  /** Wait until the queue has no pending or in-flight work. Used in tests only. */
  async waitForIdle(): Promise<void> {
    while (this.activeCount > 0 || this.pending.length > 0) {
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  private scheduleDrain(): void {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const jobId = this.pending.shift()!;
      this.activeCount++;
      void this.runJob(jobId);
    }
  }

  private async runJob(jobId: string): Promise<void> {
    try {
      await this.executor(jobId);
    } catch {
      // executor handles its own errors; this is a safety net
    } finally {
      this.activeCount--;
      this.scheduleDrain();
    }
  }
}
