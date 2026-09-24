/** Split a list into runs of at most `size`, for `.in('id', ids)` lookups that must stay under URL length limits. */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Ids per `.in()` request. 50 ids stay far below typical URL limits. */
export const IN_CHUNK = 50;
