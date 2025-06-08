import { StressScenario } from 'iostress';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scenario: StressScenario = async (socket, logger) => {
  for (let i = 0; i < 100; i++) {
    await sleep(10);
    socket.emit('ping', (data: string) => {
      logger.log(`Received: ${data}`);
      if (i === 99) {
        setTimeout(() => {
          socket.disconnect();
        }, 1000);
      }
    });
  }
};

export default scenario;
