export function parseWholeNumber(
  value: string,
  minimum: number,
  maximum: number,
): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}
export function parseDurationParts(
  minutes: string,
  seconds: string,
  minimum = 10,
  maximum = 3600,
): number | null {
  const minuteValue = parseWholeNumber(minutes, 0, Math.floor(maximum / 60));
  const secondValue = parseWholeNumber(seconds, 0, 59);
  if (minuteValue === null || secondValue === null) return null;
  const total = minuteValue * 60 + secondValue;
  return total >= minimum && total <= maximum ? total : null;
}
