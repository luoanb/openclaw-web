import { describe, expect, it } from "vitest";
import { FileManagerUnknownDriveError } from "./fileManager.errors";

describe("FileManagerUnknownDriveError", () => {
  it("carries driveId and message", () => {
    const e = new FileManagerUnknownDriveError("missing-id");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("FileManagerUnknownDriveError");
    expect(e.driveId).toBe("missing-id");
    expect(e.message).toContain("missing-id");
  });
});
