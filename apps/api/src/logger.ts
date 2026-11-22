interface LogFields {
  [key: string]: string | number | boolean | null;
}

export function structuredLog(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  fields: LogFields = {}
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...fields
    })
  );
}
