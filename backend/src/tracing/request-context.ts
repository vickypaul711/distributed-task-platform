import { AsyncLocalStorage } from 'async_hooks';

type RequestContextStore = {
  requestId: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestId() {
  return requestContext.getStore()?.requestId;
}
