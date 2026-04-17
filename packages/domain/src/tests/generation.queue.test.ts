import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GenerationQueue } from "../generation/generation.queue.js";

describe("GenerationQueue", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("push() calls executor with the correct jobId", async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue    = new GenerationQueue(executor);

    queue.push("job-1");
    await vi.runAllTimersAsync();
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("job-1");
  });

  it("processes jobs serially — second job waits for first to complete", async () => {
    const order: string[] = [];
    let resolveFirst!: () => void;
    const executor = vi.fn().mockImplementation(async (jobId: string) => {
      if (jobId === "job-1") {
        await new Promise<void>(r => { resolveFirst = r; });
      }
      order.push(jobId);
    });
    const queue = new GenerationQueue(executor);

    queue.push("job-1");
    queue.push("job-2");

    // job-2 should not start until job-1 resolves
    await vi.runAllTimersAsync();
    expect(order).toEqual([]);   // job-1 still in-flight

    resolveFirst();
    await vi.runAllTimersAsync();
    await queue.waitForIdle();

    expect(order).toEqual(["job-1", "job-2"]);
  });

  it("executor throwing does not stop the drain loop", async () => {
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const queue = new GenerationQueue(executor);

    queue.push("job-1");
    queue.push("job-2");
    await vi.runAllTimersAsync();
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenNthCalledWith(1, "job-1");
    expect(executor).toHaveBeenNthCalledWith(2, "job-2");
  });

  it("waitForIdle() resolves immediately when queue is empty", async () => {
    const queue = new GenerationQueue(vi.fn().mockResolvedValue(undefined));
    await expect(queue.waitForIdle()).resolves.toBeUndefined();
  });

  it("waitForIdle() resolves only after all pending jobs complete", async () => {
    const completed: string[] = [];
    const executor = vi.fn().mockImplementation(async (jobId: string) => {
      completed.push(jobId);
    });
    const queue = new GenerationQueue(executor);

    queue.push("job-a");
    queue.push("job-b");
    await vi.runAllTimersAsync();
    await queue.waitForIdle();

    expect(completed).toEqual(["job-a", "job-b"]);
  });

  it("scheduleRetry() enqueues jobId after the specified delay", async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue    = new GenerationQueue(executor);

    queue.scheduleRetry("job-retry", 500);
    expect(executor).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("job-retry");
  });

  it("destroy() cancels scheduled retry timers so executor never fires", async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue    = new GenerationQueue(executor);

    queue.scheduleRetry("job-cancel", 1000);
    queue.destroy();

    await vi.advanceTimersByTimeAsync(2000);

    expect(executor).not.toHaveBeenCalled();
  });
});
