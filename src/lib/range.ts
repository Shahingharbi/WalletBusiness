export const RANGES = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "12m", label: "12 mois" },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export function rangeToDates(range: RangeId): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  bucketDays: number;
} {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let bucketDays = 1;

  switch (range) {
    case "today":
      bucketDays = 1;
      break;
    case "7d":
      start.setDate(start.getDate() - 6);
      bucketDays = 7;
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      bucketDays = 30;
      break;
    case "12m":
      start.setDate(start.getDate() - 364);
      bucketDays = 365;
      break;
  }

  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);

  return { start, end, prevStart, prevEnd, bucketDays };
}
