import type { InjectionScript } from "os-core";

export type BrowserPodInjectionScript = InjectionScript & {
  readonly load: () => string | Promise<string>;
};

export type BrowserPodInjectionConfig = {
  readonly enabled?: boolean;
  readonly required?: boolean;
  readonly basePath?: string;
  readonly scripts?: readonly BrowserPodInjectionScript[];
};
