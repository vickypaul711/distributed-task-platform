export type LogPayload = Record<string, unknown>;

export const withTimestamp = <TPayload extends LogPayload>(
  payload: TPayload,
): TPayload & { timestamp: string } => ({
  timestamp: new Date().toISOString(),
  ...payload,
});
