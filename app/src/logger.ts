export type Logger = (fields: Record<string, unknown>) => void;

/** Structured JSON log line. Callers must never pass credentials or key material. */
export const jsonLogger: Logger = (fields) => {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...fields }));
};
