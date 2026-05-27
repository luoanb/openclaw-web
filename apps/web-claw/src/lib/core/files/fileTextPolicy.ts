export class FileTextPolicy {
  static readonly maxEditableBytes = 1024 * 1024;

  static canReadSize(size?: number): boolean {
    return size === undefined || size <= FileTextPolicy.maxEditableBytes;
  }
}
