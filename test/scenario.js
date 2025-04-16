const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scenario = async (socket, logger) => {
  for (let i = 0; i < 100; i++) {
    await sleep(10);
    socket.emit('ping', (data) => {
      logger.log(`Received: ${data}`);
      if (i === 99) {
        setTimeout(() => {
          socket.disconnect();
        }, 1000);
      }
    });
  }
};

module.exports = scenario;
