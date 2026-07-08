// Simple structured logging layer wrapping console or pino

export type LogLevel = "info" | "warn" | "error" | "debug";

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({ level: "info", timestamp: new Date().toISOString(), message, ...meta }));
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(JSON.stringify({ level: "warn", timestamp: new Date().toISOString(), message, ...meta }));
  },
  error: (message: string, error?: any, ...meta: any[]) => {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...meta,
      })
    );
  },
  debug: (message: string, ...meta: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(JSON.stringify({ level: "debug", timestamp: new Date().toISOString(), message, ...meta }));
    }
  },
};
