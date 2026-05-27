export type AsyncTaskQueueOptions = {
  readonly concurrency: number;
};

type QueueEntry<T> = {
  readonly task: () => Promise<T> | T;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
};

export class AsyncTaskQueue {
  private readonly concurrency: number;
  private readonly entries: QueueEntry<unknown>[] = [];
  private activeCount = 0;

  constructor(options: AsyncTaskQueueOptions) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new Error("AsyncTaskQueue concurrency must be a positive integer.");
    }
    this.concurrency = options.concurrency;
  }

  enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.entries.push({ task, resolve: resolve as (value: unknown) => void, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.activeCount < this.concurrency) {
      const entry = this.entries.shift();
      if (!entry) return;
      this.activeCount += 1;
      void this.runEntry(entry);
    }
  }

  private async runEntry<T>(entry: QueueEntry<T>): Promise<void> {
    try {
      entry.resolve(await entry.task());
    } catch (error) {
      entry.reject(error);
    } finally {
      this.activeCount -= 1;
      this.drain();
    }
  }
}
