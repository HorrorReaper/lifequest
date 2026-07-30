// Shared IANA timezone helpers.
//
// Timezone pickers must never show a value that differs from the value that is
// actually stored on the profile. A curated list cannot guarantee that: a user
// in Europe/Vienna would get a select whose displayed option does not match its
// own value, and touching the control would overwrite a correct zone with a
// wrong one. So the list is derived from the runtime and the active value is
// always guaranteed to be present.

export const UTC_TIMEZONE = 'UTC'

// Used only when the runtime does not expose the full IANA set.
const FALLBACK_TIMEZONES = [
  'America/Anchorage',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  UTC_TIMEZONE,
]

export function listTimezones(): string[] {
  try {
    const supported = Intl.supportedValuesOf?.('timeZone')
    if (supported && supported.length > 0) return [...supported]
  } catch {
    // Fall through to the curated list below.
  }

  return [...FALLBACK_TIMEZONES]
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC_TIMEZONE
  } catch {
    return UTC_TIMEZONE
  }
}

/**
 * Every selectable zone, sorted, always including `current` and UTC so a select
 * bound to `current` can never render a value it has no option for.
 */
export function timezoneOptions(current?: string | null): string[] {
  const options = new Set(listTimezones())
  options.add(UTC_TIMEZONE)
  if (current) options.add(current)

  return [...options].sort((a, b) => a.localeCompare(b))
}

export function formatTimezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ')
}

/**
 * Zones grouped by IANA region so a ~400 entry select stays navigable.
 * Single-segment zones such as `UTC` are grouped under "Other".
 */
export function groupedTimezoneOptions(
  current?: string | null
): { region: string; zones: string[] }[] {
  const groups = new Map<string, string[]>()

  for (const zone of timezoneOptions(current)) {
    const region = zone.includes('/') ? zone.split('/')[0] : 'Other'
    const zones = groups.get(region)
    if (zones) zones.push(zone)
    else groups.set(region, [zone])
  }

  return [...groups.entries()]
    .map(([region, zones]) => ({ region, zones }))
    .sort((a, b) => a.region.localeCompare(b.region))
}
