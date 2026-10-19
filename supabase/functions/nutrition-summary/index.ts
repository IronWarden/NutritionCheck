// nutrition-summary: today's totals and the 7-day daily average, against the user's targets.

import { json, loadProfile, loadRecentItems, serve, targetsFor } from "../_shared/http.ts";
import { add, divide, type Nutrients } from "../_shared/nutrients.ts";
import { localDate } from "../_shared/profile.ts";

serve(async (req, { db, userId }) => {
  const { timezone = "UTC" } = (await req.json().catch(() => ({}))) as { timezone?: string };
  const profile = await loadProfile(db, userId);
  const items = await loadRecentItems(db, 7);

  const today = localDate(new Date().toISOString(), timezone);
  const days = new Set<string>();
  let todayTotal: Nutrients = {};
  let weekTotal: Nutrients = {};
  for (const item of items) {
    const day = localDate(item.eaten_at, timezone);
    days.add(day);
    weekTotal = add(weekTotal, item.nutrients ?? {});
    if (day === today) todayTotal = add(todayTotal, item.nutrients ?? {});
  }

  return json({
    targets: targetsFor(profile),
    today: todayTotal,
    week_average: days.size ? divide(weekTotal, days.size) : {},
    days_logged: days.size,
    hide_numbers: profile.hide_numbers || profile.safe_mode,
  });
});
