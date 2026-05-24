type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

type LogOptions = {
  dedupeKey?: string;
  throttleMs?: number;
};

const DEFAULT_THROTTLE_MS = 15000;
const lastLogTimeByKey = new Map<string, number>();

function shouldLog(level: LogLevel, message: string, options?: LogOptions): boolean {
  const dedupeKey = options?.dedupeKey ?? `${level}:${message}`;
  const throttleMs = options?.throttleMs ?? DEFAULT_THROTTLE_MS;
  const now = Date.now();
  const lastLogTime = lastLogTimeByKey.get(dedupeKey) ?? 0;

  if (now - lastLogTime < throttleMs) {
    return false;
  }

  lastLogTimeByKey.set(dedupeKey, now);
  return true;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object') {
    const maybeAxiosError = error as {
      message?: string;
      code?: string;
      response?: {
        status?: number;
        data?: unknown;
        headers?: Record<string, unknown>;
      };
      config?: {
        method?: string;
        url?: string;
      };
    };

    if (maybeAxiosError.response || maybeAxiosError.config) {
      return {
        message: maybeAxiosError.message,
        code: maybeAxiosError.code,
        status: maybeAxiosError.response?.status,
        responseData: maybeAxiosError.response?.data,
        requestMethod: maybeAxiosError.config?.method,
        requestUrl: maybeAxiosError.config?.url,
      };
    }
  }

  return error;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) {
    return undefined;
  }

  const sanitizedContext: LogContext = {};

  Object.entries(context).forEach(([key, value]) => {
    sanitizedContext[key] = key.toLowerCase().includes('error') ? serializeError(value) : value;
  });

  return sanitizedContext;
}

function write(level: LogLevel, message: string, context?: LogContext, options?: LogOptions) {
  if (!shouldLog(level, message, options)) {
    return;
  }

  const sanitizedContext = sanitizeContext(context);

  if (sanitizedContext) {
    console[level](`[Vector] ${message}`, sanitizedContext);
    return;
  }

  console[level](`[Vector] ${message}`);
}

export const clientLogger = {
  debug(message: string, context?: LogContext, options?: LogOptions) {
    write('debug', message, context, options);
  },
  info(message: string, context?: LogContext, options?: LogOptions) {
    write('info', message, context, options);
  },
  warn(message: string, context?: LogContext, options?: LogOptions) {
    write('warn', message, context, options);
  },
  error(message: string, context?: LogContext, options?: LogOptions) {
    write('error', message, context, options);
  },
};
