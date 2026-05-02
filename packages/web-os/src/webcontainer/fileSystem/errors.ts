export class InvalidSnapshotError extends Error {
  readonly name = "InvalidSnapshotError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class IdbQuotaError extends Error {
  readonly name = "IdbQuotaError";

  constructor(message = "IndexedDB 存储配额不足") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
