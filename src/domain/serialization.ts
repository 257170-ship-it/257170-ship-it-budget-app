/** JSON equality ignores object-key order while preserving array order and values. */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const ordered = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(current).sort()) ordered[key] = current[key];
      return ordered;
    }
    return current;
  });
}
