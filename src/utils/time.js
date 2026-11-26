const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convert a Prisma Time (Date at 1970-01-01 UTC) or time string into "HH:mm".
 */
function formatPrismaTime(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid Date value for time');
    }
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const hours = String(parsed.getUTCHours()).padStart(2, '0');
      const minutes = String(parsed.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  throw new Error('Unsupported time value');
}

/**
 * Convert an "HH:mm" string or Date into total minutes since midnight (0..1439).
 */
function timeToMinutes(value) {
  const hhmm = formatPrismaTime(value);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert a validated "HH:mm" string into a UTC Date suitable for Prisma @db.Time(0).
 */
function timeStringToPrismaDate(hhmm) {
  const match = String(hhmm).trim().match(TIME_REGEX);
  if (!match) {
    throw new Error('Time must be in HH:mm format');
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

module.exports = {
  TIME_REGEX,
  DAY_NAMES,
  formatPrismaTime,
  timeToMinutes,
  timeStringToPrismaDate,
};
