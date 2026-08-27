/**
 * Public persistence port. Implementations return promises even when their
 * underlying browser API is synchronous so feature code stays implementation-agnostic.
 */
export const STORAGE_PORT_METHODS = Object.freeze([
  'load',
  'save',
  'update',
  'remove',
  'clearAll',
  'subscribe',
  'export',
  'import',
]);

export function assertStoragePort(port) {
  const missing = STORAGE_PORT_METHODS.filter((method) => typeof port?.[method] !== 'function');
  if (missing.length) throw new TypeError(`Storage port is missing: ${missing.join(', ')}`);
  return port;
}
