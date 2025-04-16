# iostress

🚀 Blast your Socket.IO server with this quick and powerful JavaScript testing tool!

> ⚠️ **WARNING:** This tool is **unstable**. Do not use in production environments.

## 🎯 Mission

- 🧩 Flexible and easy-to-use API
- 💡 Lightweight
- 🔌 Socket.IO-specific stress testing
- 🧠 Covers complex real-world scenarios
- 📊 Accurate performance and error statistics

## 📦 Installation

```bash
npm install iostress
```

```bash
pnpm add iostress
```

```bash
yarn add iostress
```

## 🚀 Get Started

Organize your stress tests with separate configuration and scenario logic.

```bash
tests/
├── test.js
├── low-pressure.scenario.js
└── high-pressure.scenario.js
```

### Example: `test.js`

```js
const { IOStress } = require('iostress');
const { join } = require('path');

const stressTest = new IOStress({
  target: 'http://localhost:3000',
  phases: [
    {
      name: 'Low Pressure',
      minClients: 10,
      maxClients: 100,
      rampDelayRate: 500,
      scenarioInitializer: (clientNumber) => ({
        extraHeaders: { token: clientNumber },
      }),
      scenarioPath: join(__dirname, 'low-pressure.scenario.js'),
      scenarioTimeout: 20000,
    },
    {
      name: 'More Pressure',
      minClients: 100,
      maxClients: 1000,
      rampDelayRate: 100,
      scenarioInitializer: (clientNumber) => ({
        extraHeaders: { token: clientNumber },
      }),
      scenarioPath: join(__dirname, 'high-pressure.scenario.js'),
    },
  ],
});

stressTest.run();
```

### Example: `low-pressure.scenario.js`

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scenario = async (socket, logger) => {
  for (let i = 0; i < 100; i++) {
    await sleep(10);
    socket.emit('ping', (data) => {
      logger.log(`Received: ${data}`);
      if (i === 99) {
        setTimeout(() => {
          socket.disconnect(); // signal scenario completion
        }, 1000);
      }
    });
  }
};

export default scenario;
// CommonJS: module.exports = scenario;
```

## ⚙️ How to Use

### IOStress Configuration

```ts
interface IOStressOptions {
  target: string;
  phases: StressPhase[];
}

interface StressPhase {
  name: string;
  minClients: number;
  maxClients?: number;
  rampDelayRate?: number;
  scenarioInitializer?: (
    clientNumber: number,
  ) => Partial<ManagerOptions & SocketOptions>;
  scenarioPath: string;
  scenarioTimeout?: number;
}
```

### Scenario Interface

```ts
type StressScenario = (socket: Socket, logger: ILogger) => void | Promise<void>;

interface ILogger {
  log(message: string, type?: string): void;
  error(message: string | Error, type?: string): void;
  warn(message: string, type?: string): void;
  debug(message: string, type?: string): void;
}
```

> ⚠️ Your scenario **must** call `socket.disconnect()` at the end to prevent hanging clients.

> 💡 Press `t` to gracefully terminate a phase. Use `Ctrl+C` for forceful exit.

## 📈 Reports

Each phase generates a report named `phase-name.report.json`.

### Schema

```ts
interface StressReport {
  phase: string;
  testDuration: number;
  connections: {
    attempted: number;
    successful: number;
    failed: number;
    averageConnectionTime: number;
    reconnectAttempts: number;
  };
  events: {
    sent: number;
    received: number;
    successful: number;
    failed: number;
    throughput: number;
  };
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p85: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
}
```

## 📄 License

```text
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
