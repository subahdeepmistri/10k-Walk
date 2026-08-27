import { StorageValidationError } from './storageErrors.js';

function hasUnsupportedValue(value, seen = new Set(), path = '$') {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return `${path} contains an unsupported value.`;
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return `${path} contains a non-finite number.`;
  }
  if (typeof value === 'bigint') return `${path} contains an unsupported bigint.`;

  if (!value || typeof value !== 'object') return null;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return `${path} must be a plain object or array.`;
  }
  if (seen.has(value)) return `${path} contains a circular reference.`;

  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const issue = hasUnsupportedValue(value[index], seen, `${path}[${index}]`);
      if (issue) return issue;
    }
  } else {
    for (const [key, child] of Object.entries(value)) {
      const issue = hasUnsupportedValue(child, seen, `${path}.${key}`);
      if (issue) return issue;
    }
  }
  seen.delete(value);
  return null;
}

export function safeStringify(value) {
  const issue = hasUnsupportedValue(value);
  if (issue) throw new StorageValidationError(issue, { issues: [issue] });

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      throw new StorageValidationError('The value could not be serialized.');
    }
    return serialized;
  } catch (error) {
    if (error instanceof StorageValidationError) throw error;
    throw new StorageValidationError('The value could not be serialized.', { cause: error });
  }
}

export function safeParse(serialized) {
  if (typeof serialized !== 'string') {
    throw new StorageValidationError('Stored data is not text.');
  }

  try {
    return JSON.parse(serialized);
  } catch (error) {
    throw new StorageValidationError('Stored data is not valid JSON.', { cause: error });
  }
}

export function toQuarantineValue(value, seen = new Map(), path = '$') {
  if (value === undefined) return { type: 'undefined' };
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { type: 'number', value: String(value) };
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return { type: typeof value, value: String(value) };
  }
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return { type: 'circular-reference', target: seen.get(value) };
  if (value instanceof Date) {
    return { type: 'date', value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString() };
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return { type: 'unsupported-object', name: value.constructor?.name || 'Object', value: String(value) };
    }
  }

  seen.set(value, path);
  if (Array.isArray(value)) {
    const result = value.map((item, index) => toQuarantineValue(item, seen, `${path}[${index}]`));
    seen.delete(value);
    return result;
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = toQuarantineValue(child, seen, `${path}.${key}`);
  }
  seen.delete(value);
  return result;
}
