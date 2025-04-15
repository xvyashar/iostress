const { IOStress } = require('iostress');

const stressTest = new IOStress({
  target: 'http://localhost:3000',
  phases: [
    {
      name: 'Test',
      minClients: 10,
      maxClients: 100,
      scenario: async (socket, logger) => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let i = 0; i < 100; i++) {
          await sleep(10);
          socket.emit('ping', (data) => {
            logger.log('Received:', data);
            if (i === 99) {
              socket.disconnect();
            }
          });
        }
      },
      scenarioTimeout: 20000,
    },
  ],
});

stressTest.run();
