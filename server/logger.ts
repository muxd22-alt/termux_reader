const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 } as const
type Level = keyof typeof LEVELS

function currentLevel(): Level {
  if (process.env.LOG_LEVEL && process.env.LOG_LEVEL in LEVELS) {
    return process.env.LOG_LEVEL as Level
  }
  if (process.env.VITEST) return 'silent'
  return 'info'
}

function enabled(level: Level): boolean {
  return LEVELS[level] <= LEVELS[currentLevel()]
}

function fmt(prefix: string | undefined, args: unknown[]): unknown[] {
  return prefix ? [`[${prefix}]`, ...args] : args
}

export interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  child(prefix: string): Logger
}

function createLogger(prefix?: string): Logger {
  return {
    debug(...args: unknown[]) {
      if (enabled('debug')) console.log(...fmt(prefix, args))
    },
    info(...args: unknown[]) {
      if (enabled('info')) console.log(...fmt(prefix, args))
    },
    warn(...args: unknown[]) {
      if (enabled('warn')) console.warn(...fmt(prefix, args))
    },
    error(...args: unknown[]) {
      if (enabled('error')) console.error(...fmt(prefix, args))
    },
    child(childPrefix: string) {
      const full = prefix ? `${prefix}:${childPrefix}` : childPrefix
      return createLogger(full)
    },
  }
}

export const logger = createLogger()
