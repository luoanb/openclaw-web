export type DiffAutoSaverOptions<T> = {
  intervalMs: number;
  readSnapshot: () => T;
  submitSnapshot: (snapshot: T) => void;
  normalizeSnapshot?: (snapshot: T) => T;
  canSubmit?: (snapshot: T) => boolean;
  isEqual?: (left: T, right: T) => boolean;
};

export type DiffAutoSaverDisposeOptions = {
  flush?: boolean;
};

export class DiffAutoSaver<T> {
  private committedSnapshot: T;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    initialSnapshot: T,
    private readonly options: DiffAutoSaverOptions<T>
  ) {
    this.committedSnapshot = this.normalize(initialSnapshot);
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick();
    }, this.options.intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  tick(): void {
    const snapshot = this.normalize(this.options.readSnapshot());

    if (!this.canSubmit(snapshot) || this.isEqual(snapshot, this.committedSnapshot)) {
      return;
    }

    this.options.submitSnapshot(snapshot);
    this.committedSnapshot = snapshot;
  }

  flush(): void {
    this.tick();
  }

  markCommitted(snapshot: T): void {
    this.committedSnapshot = this.normalize(snapshot);
  }

  dispose(options: DiffAutoSaverDisposeOptions = {}): void {
    if (options.flush) {
      this.flush();
    }

    this.stop();
  }

  private normalize(snapshot: T): T {
    return this.options.normalizeSnapshot?.(snapshot) ?? snapshot;
  }

  private canSubmit(snapshot: T): boolean {
    return this.options.canSubmit?.(snapshot) ?? true;
  }

  private isEqual(left: T, right: T): boolean {
    return this.options.isEqual?.(left, right) ?? Object.is(left, right);
  }
}
