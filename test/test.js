const { IOStress } = require('iostress');
const path = require('path');

const jsAbortController = new AbortController();
const tsAbortController = new AbortController();

const stressTest = new IOStress({
  target: 'http://localhost:3000',
  phases: [
    {
      name: 'JS Test',
      minClients: 10,
      maxClients: 100,
      scenarioInitializer: (clientNumber) => {
        return { extraHeaders: { token: clientNumber } };
      },
      scenarioPath: path.join(__dirname, 'scenario.js'),
      scenarioTimeout: 20000,
      terminator: jsAbortController,
      reportsPath: path.join(__dirname, 'stress-reports'),
      logsPath: path.join(__dirname, 'stress-logs'),
    },
    {
      name: 'TS Test',
      minClients: 100,
      maxClients: 1000,
      scenarioInitializer: (clientNumber) => {
        return { extraHeaders: { token: clientNumber } };
      },
      scenarioPath: path.join(__dirname, 'scenario.ts'),
      terminator: tsAbortController,
      reportsPath: path.join(__dirname, 'stress-reports'),
      logsPath: path.join(__dirname, 'stress-logs'),
    },
  ],
});

stressTest.run();

setTimeout(() => jsAbortController.abort(), 3000);
setTimeout(() => tsAbortController.abort('hard'), 10000);
