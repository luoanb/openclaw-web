import { customTerminalCase } from './cases/customTerminal.case.js';
import { expressPortalCase } from './cases/expressPortal.case.js';
import { interactiveTerminalCase } from './cases/interactiveTerminal.case.js';
import { multipleTerminalsCase } from './cases/multipleTerminals.case.js';
import { packageCommandRunnerCase } from './cases/packageCommandRunner.case.js';
import { persistStorageCase } from './cases/persistStorage.case.js';

export const browserPodCases = [
  persistStorageCase,
  customTerminalCase,
  packageCommandRunnerCase,
  multipleTerminalsCase,
  interactiveTerminalCase,
  expressPortalCase,
];
