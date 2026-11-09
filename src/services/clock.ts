// Injected wherever "now" matters, so tests can freeze or advance time.

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now() {
    return new Date();
  },
};
