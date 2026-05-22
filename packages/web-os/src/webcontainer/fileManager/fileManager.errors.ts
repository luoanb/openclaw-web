/** `driveId` 不在 `drive_registry` 中（尚 `createDrive` / `copyDrive`）。 */
export class FileManagerUnknownDriveError extends Error {
  readonly driveId: string;

  constructor(driveId: string) {
    super(`Drive not registered: ${driveId}`);
    this.name = "FileManagerUnknownDriveError";
    this.driveId = driveId;
  }
}
