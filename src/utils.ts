export class Performance {
  private timers: Record<number, [number, number]> = {};
  private incrementorIdx = 0;

  measure(timerId: number, keepTimer = false) {
    if (!this.timers[timerId]) return -1;

    const [seconds, nanoseconds] = process.hrtime(this.timers[timerId]);
    const milliseconds = seconds * 1e3 + nanoseconds / 1e6; // convert to milliseconds

    if (!keepTimer) this.delete(timerId);

    return milliseconds;
  }

  delete(timerId: number) {
    if (this.timers[timerId]) delete this.timers[timerId];
  }

  start() {
    this.timers[this.incrementorIdx] = process.hrtime();
    return this.incrementorIdx++;
  }
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const random = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
