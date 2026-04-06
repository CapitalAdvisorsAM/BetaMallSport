type MonthRange = {
  desdeDate: Date;
  hastaDate: Date;
};

export function resolveMonthRange(desde?: string | null, hasta?: string | null): MonthRange {
  return {
    desdeDate: desde ? new Date(`${desde}-01`) : new Date("2024-01-01"),
    hastaDate: hasta ? new Date(`${hasta}-01`) : new Date()
  };
}

export function toPeriodKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}
