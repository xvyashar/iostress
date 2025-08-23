const { IOStress, defaultTerminalInterface } = require('iostress');
const path = require('path');

const stressTest = new IOStress({
  target: 'http://localhost:3000',
  interfaceOptions: defaultTerminalInterface({
    logsDir: path.join(__dirname, 'stress-logs'),
    reportsDir: path.join(__dirname, 'stress-reports'),
    softTerminatorSignal: 'q',
    hardTerminatorSignal: 'Q',
  }),
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
    },
    {
      name: 'TS Test',
      minClients: 100,
      maxClients: 1000,
      scenarioInitializer: (clientNumber) => {
        return { extraHeaders: { token: clientNumber } };
      },
      scenarioPath: path.join(__dirname, 'scenario.ts'),
    },
  ],
});

stressTest.run().then(() => process.exit(0));
