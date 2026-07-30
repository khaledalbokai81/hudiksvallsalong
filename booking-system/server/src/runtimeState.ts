let shuttingDown = false;
let shutdownSignal: string | undefined;

export function beginShutdown(signal: string) {
  shuttingDown = true;
  shutdownSignal = signal;
}

export function isShuttingDown() {
  return shuttingDown;
}

export function getShutdownSignal() {
  return shutdownSignal;
}
