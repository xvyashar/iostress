const { IOStress } = require('iostress');
const path = require('path');

const stressTest = new IOStress({
  target: 'http://localhost:3000',
  phases: [
    {
      name: 'Test',
      minClients: 90,
      maxClients: 100,
      scenarioPath: path.join(__dirname, 'scenario.js'),
      scenarioTimeout: 20000,
    },
  ],
});

stressTest.run();
