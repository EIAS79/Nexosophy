export type ParsedRRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: number[];
  byMonthDay: number[];
  count: number | null;
  until: Date | null;
};

const WEEKDAYS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function parseRRule(value?: string | null): ParsedRRule | null {
  if (!value) return null;
  const fields = Object.fromEntries(
    value
      .trim()
      .toUpperCase()
      .split(";")
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      }),
  );
  const freq = fields.FREQ;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) {
    throw new Error("UNSUPPORTED_RECURRENCE_RULE");
  }
  const interval = Math.max(1, Number(fields.INTERVAL ?? "1") || 1);
  const byDay = (fields.BYDAY ?? "")
    .split(",")
    .map((value: string) => WEEKDAYS[value])
    .filter((value: number | undefined): value is number => Number.isInteger(value));
  const byMonthDay = (fields.BYMONTHDAY ?? "")
    .split(",")
    .map(Number)
    .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= 31);
  const count = fields.COUNT ? Math.max(1, Number(fields.COUNT) || 1) : null;
  const until = fields.UNTIL
    ? new Date(
        /^\d{8}T\d{6}Z$/.test(fields.UNTIL)
          ? fields.UNTIL.replace(
              /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
              "$1-$2-$3T$4:$5:$6Z",
            )
          : fields.UNTIL,
      )
    : null;
  return {
    freq: freq as ParsedRRule["freq"],
    interval,
    byDay,
    byMonthDay,
    count,
    until: until && !Number.isNaN(until.getTime()) ? until : null,
  };
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

function localEpoch(parts: LocalParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

export function zonedLocalToUtc(parts: LocalParts, timeZone: string): Date {
  let guess = new Date(localEpoch(parts));
  for (let pass = 0; pass < 4; pass += 1) {
    const rendered = localParts(guess, timeZone);
    const delta = localEpoch(parts) - localEpoch(rendered);
    if (delta === 0) return guess;
    guess = new Date(guess.getTime() + delta);
  }
  return guess;
}

function addLocal(
  parts: LocalParts,
  input: { days?: number; months?: number; years?: number },
): LocalParts {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  if (input.years) date.setUTCFullYear(date.getUTCFullYear() + input.years);
  if (input.months) date.setUTCMonth(date.getUTCMonth() + input.months);
  if (input.days) date.setUTCDate(date.getUTCDate() + input.days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function matchesFilters(parts: LocalParts, rule: ParsedRRule): boolean {
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  if (rule.byDay.length > 0 && !rule.byDay.includes(weekday)) return false;
  if (rule.byMonthDay.length > 0 && !rule.byMonthDay.includes(parts.day)) return false;
  return true;
}

export function nextOccurrenceAfter(
  seriesStart: Date,
  after: Date,
  timeZone: string,
  ruleText?: string | null,
): Date | null {
  const rule = parseRRule(ruleText);
  if (!rule) return null;

  let parts = localParts(seriesStart, timeZone);
  let occurrence = seriesStart;
  let emitted = 1;
  if (occurrence > after && matchesFilters(parts, rule)) return occurrence;

  for (let steps = 0; steps < 20000; steps += 1) {
    if (rule.freq === "DAILY") {
      parts = addLocal(parts, { days: rule.interval });
    } else if (rule.freq === "WEEKLY" && rule.byDay.length === 0) {
      parts = addLocal(parts, { days: 7 * rule.interval });
    } else if (rule.freq === "MONTHLY") {
      parts = addLocal(parts, { months: rule.interval });
    } else if (rule.freq === "YEARLY") {
      parts = addLocal(parts, { years: rule.interval });
    } else {
      parts = addLocal(parts, { days: 1 });
      if (rule.freq === "WEEKLY") {
        const startParts = localParts(seriesStart, timeZone);
        const candidateDay = Date.UTC(parts.year, parts.month - 1, parts.day);
        const anchorDay = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
        const week = Math.floor((candidateDay - anchorDay) / (7 * 86400000));
        if (week < 0 || week % rule.interval !== 0) continue;
      }
    }

    if (!matchesFilters(parts, rule)) continue;
    occurrence = zonedLocalToUtc(parts, timeZone);
    emitted += 1;
    if (rule.count !== null && emitted > rule.count) return null;
    if (rule.until && occurrence > rule.until) return null;
    if (occurrence > after) return occurrence;
  }
  throw new Error("RECURRENCE_EXPANSION_LIMIT");
}

export function occurrencesBetween(
  seriesStart: Date,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
  ruleText?: string | null,
  maxOccurrences = 2000,
): Date[] {
  if (!ruleText) {
    return seriesStart >= rangeStart && seriesStart < rangeEnd ? [seriesStart] : [];
  }
  const output: Date[] = [];
  let current =
    seriesStart >= rangeStart
      ? seriesStart
      : nextOccurrenceAfter(seriesStart, new Date(rangeStart.getTime() - 1), timeZone, ruleText);
  while (current && current < rangeEnd && output.length < maxOccurrences) {
    if (current >= rangeStart) output.push(current);
    current = nextOccurrenceAfter(seriesStart, current, timeZone, ruleText);
  }
  return output;
}

export function isQuietTime(
  instant: Date,
  timeZone: string,
  quietStart?: string | null,
  quietEnd?: string | null,
): boolean {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;
  const parts = localParts(instant, timeZone);
  const minutes = parts.hour * 60 + parts.minute;
  const [sh, sm] = quietStart.split(":").map(Number);
  const [eh, em] = quietEnd.split(":").map(Number);
  const start = (sh ?? 0) * 60 + (sm ?? 0);
  const end = (eh ?? 0) * 60 + (em ?? 0);
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export function nextQuietEnd(
  instant: Date,
  timeZone: string,
  quietStart?: string | null,
  quietEnd?: string | null,
): Date {
  if (!isQuietTime(instant, timeZone, quietStart, quietEnd) || !quietEnd) return instant;
  const parts = localParts(instant, timeZone);
  const [hour, minute] = quietEnd.split(":").map(Number);
  let endParts: LocalParts = {
    ...parts,
    hour: hour ?? 0,
    minute: minute ?? 0,
    second: 0,
  };
  let result = zonedLocalToUtc(endParts, timeZone);
  if (result <= instant) {
    endParts = addLocal(endParts, { days: 1 });
    result = zonedLocalToUtc(endParts, timeZone);
  }
  return result;
}
