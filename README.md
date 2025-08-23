# iostress ![version](https://img.shields.io/badge/version-1.0.0-blue)

🚀 Blast your Socket.IO server with this quick and powerful JavaScript testing tool!

> [!WARNING]
> Unstable! Don't use in production stage.

---

## 🌟 Features

- Flexible and easy-to-use API
- Lightweight
- Socket.IO specific stress testing library
- Covers complex scenarios
- Accurate statistics and reporting

---

## 📦 Installation

```bash
npm install --save-dev iostress
# or
pnpm add -D iostress
# or
yarn add -D iostress
```

---

## 🚀 Getting Started

iostress separates the test configuration from scenario logic. Your typical project iostress tests file structure may look like this:

```
tests/
├── test.js
├── low-pressure.scenario.js
└── high-pressure.scenario.js
```

### Example: Configuration (`test.js`)

```js
const stressTest = new IOStress({
  target: 'http://localhost:3000',
  interfaceOptions: defaultTerminalInterface({
    logsDir: path.join(__dirname, 'stress-logs'),
    reportsDir: path.join(__dirname, 'stress-reports'),
  }),
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

stressTest.run().then(() => process.exit(0));
```

### Example: Scenario (`low-pressure.scenario.js`)

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scenario = async (socket, logger) => {
  for (let i = 0; i < 100; i++) {
    await sleep(10);
    socket.emit('ping', (data) => {
      logger.log(`Received: ${data}`);
      if (i === 99) {
        setTimeout(() => socket.disconnect(), 1000); // signal scenario complete
      }
    });
  }
};

export default scenario;
// If using CommonJS: module.exports = scenario;
```

---

## ⚙️ Configuration Options

### `IOStress(options)`

Create an instance of the stress tester.

**Options:**

| Name               | Type                     | Required | Description             |
| ------------------ | ------------------------ | -------- | ----------------------- |
| `target`           | `string`                 | ✅       | The target URL          |
| `interfaceOptions` | `StressInterfaceOptions` | ❌       | API interaction options |
| `phases`           | `StressPhase[]`          | ✅       | List of test phases     |

### `StressInterfaceOptions` Object

| Name            | Type                                          | Required | Description                                                           |
| --------------- | --------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `terminator`    | `() => AbortController`                       | ❌       | `AbortController` factory function                                    |
| `eventsHandler` | `(eventEmitter: StressEventsEmitter) => void` | ❌       | A function that listens on `StressEvents` via provided `eventEmitter` |
| `logsDir`       | `string`                                      | ❌       | Logs directory absolute path                                          |

### `StressPhase` Object

| Name                  | Type                                      | Required | Description                                                              |
| --------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `name`                | `string`                                  | ✅       | Name of the test phase                                                   |
| `minClients`          | `number`                                  | ✅       | Initial number of clients                                                |
| `maxClients`          | `number`                                  | ❌       | Maximum clients to scale to                                              |
| `rampDelayRate`       | `number` (default: 100)                   | ❌       | Delay rate between client spawns                                         |
| `scenarioInitializer` | `(clientNumber: number) => ClientOptions` | ❌       | Customize client options                                                 |
| `scenarioPath`        | `string`                                  | ✅       | Absolute path to scenario file                                           |
| `scenarioTimeout`     | `number`                                  | ❌       | Timeout per client (ms)                                                  |
| `interfaceOptions`    | `StressInterfaceOptions`                  | ❌       | API interaction options (each property will overrides top level options) |

---

## 🎭 Writing Scenarios

A scenario file must export a function like this:

```ts
(socket: Socket, logger: ILogger) => void | Promise<void>
```

### `ILogger` Interface

| Method  | Parameters                              | Description            |
| ------- | --------------------------------------- | ---------------------- |
| `log`   | `message: string, type?: string`        | Log a standard message |
| `error` | `message: string\|Error, type?: string` | Log an error message   |
| `warn`  | `message: string, type?: string`        | Log a warning message  |
| `debug` | `message: string, type?: string`        | Log a debug message    |

Use `logger` to output messages instead of `console.log`. Your logs are automatically stored in files.

> [!WARNING]
> You **must** call `socket.disconnect()` at the end of the scenario, or it will hang indefinitely.

> [!NOTE]
> Press `t` (specified softTerminatorSignal, or SIG_SOFT at your custom `AbortController`) during execution to gracefully terminate a phase and generate the report. Use `Ctrl+C` (specified hardTerminatorSignal or SIG_HARD at your custom `AbortController`) to terminate forcefully.

---

## 🔧 Customize Interface Behaviors

The `interfaceOptions` field at top-level options and phase-specific options is used to customize iostress interactions interface behaviors (showing tests status and termination signal). By default it filled with `defaultTerminalInterface()` function that you can also modify this default interface behavior with these properties:

```typescript
type defaultInterfaceOptions = {
  softTerminatorSignal?: string; // a single character signal that terminates test softly and generate report at the end. default: 't'
  hardTerminatorSignal?: string; // a single character signal that terminates tests immediately. default: '\u0003' (Ctrl + C)
  reportsDir?: string; // default: {process.cwd()}/iostress-reports
  logsDir?: string; // default: process.cwd()
}
```

If you don't like to use one major component of default interface, like that terminal signals you can just pick up default components that you need, like this:
```typescript
const opts: IOStressOptions = {
  // ...
  interfaceOptions: {
    terminator: defaultTerminalTerminator(softSignal, hardSignal), // or your custom terminator
    eventsHandler: defaultTerminalEventsHandler(reportsDir), // or your custom events handler
    logsDir: process.cwd() // or your custom logs path
  }
  // ...
}
```

> [!NOTE]
> Your phase will consume these options by combining top-level options and phase-specific options (phase-specific options has higher priority and only if an option does not exist here it will delegate to top-level options).

---

## ✅ TypeScript Support
You can write your scenario files in TypeScript (.ts) — no manual setup required.

- iostress automatically compiles .ts scenario files behind the scenes.

- If your project has a tsconfig.json, its settings will be automatically applied.

- If no tsconfig.json is found, a sensible default configuration will be used.

- Declaration files are not emitted, and output is cleaned up after execution.

ℹ️ Just point scenarioPath to your .ts file and you’re good to go!

---

## 📊 Report

Each phase generates a `{phase-name}.report.json` file in your root folder.

### Schema

```ts
interface StressReport {
  phase: string;
  testDuration: number; // seconds
  connections: {
    attempted: number;
    successful: number;
    failed: number;
    averageConnectionTime: number; // ms
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
    average: number; // ms
    min: number; // ms
    max: number; // ms
    p50: number; // ms
    p85: number; // ms
    p95: number; // ms
    p99: number; // ms
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
}
```

---

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
