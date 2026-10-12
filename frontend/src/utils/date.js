// Cross-browser safe parsing of API date strings.
//
// Why this exists: the backend serializes some dates with more than 3
// fractional-second digits (e.g. "2026-09-02T02:26:09.734372"). Chrome/Node
// parse that fine, but Safari (iOS/macOS JavaScriptCore) returns "Invalid
// Date", which silently drops every matching transaction from the monthly
// totals. Safari also rejects the space-separated form ("YYYY-MM-DD HH:mm:ss")
// and treats the date-only form as UTC. This helper normalizes all of those.
export function parseApiDate(value) {
  if (value == null || value === "") return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const s = String(value).trim();

  // Date only -> local midnight (avoids the UTC shift of the ISO date-only form)
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
  }

  // Safari requires the ISO "T" separator
  let normalized = s.replace(" ", "T");
  // Safari rejects fractional seconds with more than 3 digits -> truncate
  normalized = normalized.replace(/(\.\d{3})\d+/, "$1");

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // Last resort: manual parse of "YYYY-MM-DD[THH:mm[:ss[.sss]]]"
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/
  );
  if (m) {
    const ms = m[7] ? Number((m[7] + "000").slice(0, 3)) : 0;
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
      ms
    );
  }

  return new Date(NaN);
}

// Hoy en formato "YYYY-MM-DD" (zona local, para <input type="date">)
export function todayInputDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default parseApiDate;
