export type { IWebOsRuntime } from "./runtime.interfaces";
export { WebOsRuntime, webOsRuntime } from "./webOsRuntime.impl";

import type { WebContainer } from "@webcontainer/api";
import { webOsRuntime } from "./webOsRuntime.impl";

export function switchDriveAndBoot(driveId: string): Promise<WebContainer> {
  return webOsRuntime.switchDriveAndBoot(driveId);
}
