const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  console.log('Client connected');

  socket.on("ping", (callback) => {
    callback("pong");
  });

  socket.on("disconnect", () => {
    console.log('Client disconnected');
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});