// Every service call returns one of these, so tool handlers never need try/catch.

export type Result<Value> =
  | { kind: 'success'; value: Value }
  | { kind: 'failure'; message: string };

export function success<Value>(value: Value): Result<Value> {
  return { kind: 'success', value };
}

export function failure<Value>(message: string): Result<Value> {
  return { kind: 'failure', message };
}
