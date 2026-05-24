import { expressPortalCase } from './cases/expressPortal.case.js';
import { interactiveTerminalCase } from './cases/interactiveTerminal.case.js';
import { multipleTerminalsCase } from './cases/multipleTerminals.case.js';
import { persistStorageCase } from './cases/persistStorage.case.js';

export const browserPodCases = [
  persistStorageCase,
  multipleTerminalsCase,
  interactiveTerminalCase,
  expressPortalCase,
];
