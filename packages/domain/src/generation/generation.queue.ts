export class GenerationQueue {
  private readonly pending: string[] = [];
  private draining = false;
  private readonly retryTimers: NodeJS.Timeout[] = [];

  constructor(private readonly executor: (jobId: string) => Promise<void>) {}

  push(jobId: string): void {
    this.pending.push(jobId);
    void this.drain();
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
    while (this.draining || this.pending.length > 0) {
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const jobId = this.pending.shift()!;
        try {
          await this.executor(jobId);
        } catch {
          // executor handles its own errors; this is a safety net
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
