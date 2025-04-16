# iostress

🚀 Blast your Socket.IO server with this quick and powerful JavaScript testing tool!

> [!WARNING]
> Unstable! Don't use in production stage.

## Mission

- Flexible and Easy to Use API
- Lightweight
- Socket.IO specific stress test library
- Covers complex scenarios
- Accurate statistics

## Installation

```bash
$ npm install iostress
```

```bash
$ pnpm add iostress
```

```bash
$ yarn add iostress
```

## Get Started

iostress separates test config and scenarios logics. So you usually end up with this kind of folder structure:

```plain
tests/
├── test.js
├── low-pressure.scenario.js
└── high-pressure.scenario.js
```

You're configuration (`test.js`) file may look like this:

```javascript
const stressTest = new IOStress({
  target: 'http://localhost:3000',
  phases: [
    {
      name: 'Low Pressure',
      minClients: 10,
      maxClients: 100,
      rampDelayRate: 500,
      scenarioInitializer: (clientNumber) => {
        return { extraHeaders: { token: clientNumber } };
      },
      scenarioPath: join(__dirname, 'low-pressure.scenario.js'),
      scenarioTimeout: 20000,
    },
    {
      name: 'More Pressure',
      minClients: 100,
      maxClients: 1000,
      rampDelayRate: 100,
      scenarioInitializer: (clientNumber) => {
        return { extraHeaders: { token: clientNumber } };
      },
      scenarioPath: join(__dirname, 'high-pressure.scenario.js'),
    },
  ],
});

stressTest.run();
```

And this is how your scenario file may look like:

```javascript
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scenario = async (socket, logger) => {
  for (let i = 0; i < 100; i++) {
    await sleep(10);
    socket.emit('ping', (data) => {
      logger.log(`Received: ${data}`);
      if (i === 99) {
        setTimeout(() => {
          socket.disconnect(); // announce iostress, scenario execution finished
        }, 1000);
      }
    });
  }
};

export default scenario;
// if you're using cjs: module.exports = scenario;
```

## How to Use

### Configuration

iostress exports a single class `IOStress` to configure your stress test behavior:

```typescript
interface IOStressInterface {
  new (options: IOStressOptions): IOStress;

  run: () => Promise<void>;
}
```

```typescript
interface IOStressOptions {
  target: string; // target url
  phases: StressPhase[];
}

interface StressPhase {
  name: string; // phase name
  minClients: number; // arrival clients
  maxClients?: number; // will gradually continue instantiating after min clients started their scenario flow.
  rampDelayRate?: number; // configure speed of gradual clients. default: 100 (bigger = slower)
  scenarioInitializer?: StressScenarioInitializer; // a function that returns io client options. provided to authorize clients if needed.
  scenarioPath: string; // absolute of scenario file.
  scenarioTimeout?: number; // each client lifetime. default: no timeout.
}

type StressScenarioInitializer = (
  clientNumber: number, // starts from 0
) => Partial<ManagerOptions & SocketOptions>;
```

### Scenario

You're scenario files should export a function with this interface:

```typescript
type StressScenario = (
  socket: Socket, // connected io client
  logger: ILogger, // console.log won't work while executing scenario, use logger instead. You're logs will be saved to multiple files.
) => void | Promise<void>;

export interface ILogger {
  log: (message: string, type?: string) => void;
  error: (message: string | Error, type?: string) => void;
  warn: (message: string, type?: string) => void;
  debug: (message: string, type?: string) => void;
}
```

> [!WARNING]
> You're function has to call `socket.disconnect()` when your scenario execution is finished, otherwise iostress will wait for it all the time.

> [!NOTE]
>
> - You can also terminate your phase scenario gracefully by pressing `t` key, and iostress will terminate all clients, and generate your report.
> - `Ctrl + C` will terminate all clients and iostress ungracefully.

## Report

Each phase will generate its own report file, in your project root folder with this pattern: `phase-name.report.json`.

### Report Schema

```typescript
interface StressReport {
  phase: string; // phase name
  testDuration: number; // phase duration in seconds
  connections: {
    attempted: number; // total clients attempted to connect
    successful: number; // successful connections
    failed: number; // failed connections
    averageConnectionTime: number; // average connection time in ms
    reconnectAttempts: number; // total reconnect attempts
  };
  events: {
    sent: number; // total events sent
    received: number; // total events received
    successful: number; // successful events (if provided acknowledgement function)
    failed: number; // failed events (if provided acknowledgement function)
    throughput: number; // events per second
  };
  latency: {
    average: number; // average latency in ms
    min: number; // min latency in ms
    max: number; // max latency in ms
    p50: number; // 50th percentile latency in ms
    p85: number; // 85th percentile latency in ms
    p95: number; // 95th percentile latency in ms
    p99: number; // 99th percentile latency in ms
  };
  errors: {
    total: number; // total errors
    byType: Record<string, number>; // errors count by defined types
  };
}
```

## License

```plain
MIT License

Copyright (c) 2025 Yashar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
