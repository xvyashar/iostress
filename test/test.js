const { IOStress } = require('iostress');
const path = require('path');

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
      reportsPath: path.join(__dirname, 'stress-reports'),
      logsPath: path.join(__dirname, 'stress-logs'),
    },
  ],
});

stressTest.run();
