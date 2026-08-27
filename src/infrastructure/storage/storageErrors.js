export class StorageError extends Error {
  constructor(message, code, options = {}) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export class StorageUnavailableError extends StorageError {
  constructor(message = 'Browser storage is unavailable.', options = {}) {
    super(message, 'unavailable', options);
    this.name = 'StorageUnavailableError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(message = 'Browser storage is full.', options = {}) {
    super(message, 'quota', options);
    this.name = 'StorageQuotaError';
  }
}

export class StorageConflictError extends StorageError {
  constructor(message = 'The data changed in another tab.', options = {}) {
    super(message, 'conflict', options);
    this.name = 'StorageConflictError';
    this.actualRevision = options.actualRevision;
    this.expectedRevision = options.expectedRevision;
  }
}

export class StorageValidationError extends StorageError {
  constructor(message = 'The data is invalid.', options = {}) {
    super(message, 'invalid', options);
    this.name = 'StorageValidationError';
    this.issues = options.issues || [];
  }
}
