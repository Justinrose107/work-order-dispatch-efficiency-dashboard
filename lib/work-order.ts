export const FIELD_NAMES = [
  'Case Number',
  'Work Order Number',
  'Asset',
  'Case Occurs Time',
  'Account Call Time',
  'Created On',
  'Dispatch Time',
  'Departure Time',
  'Arrival Time',
  'First Work Order Closed Time',
  'Work Order Closed Time',
  'Service Region',
  'Country',
  'Modality',
  'Work Order Type',
  'Work Order Subtype',
  'Remote Service Result',
  'Service On-Site or Not',
  'Work Order Status',
  'Warranty Status',
  'Main Engineer',
  'Reassign Engineer',
  'Priority',
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export const DATE_FIELDS = [
  'Case Occurs Time',
  'Account Call Time',
  'Created On',
  'Dispatch Time',
  'Departure Time',
  'Arrival Time',
  'First Work Order Closed Time',
  'Work Order Closed Time',
] as const satisfies readonly FieldName[];

export type DateField = (typeof DATE_FIELDS)[number];

export type DurationKey =
  | 'caseToCall'
  | 'callToCreated'
  | 'woToDispatch'
  | 'dispatchToDeparture'
  | 'travelTime'
  | 'dispatchToArrival'
  | 'arrivalToClose';

export interface WorkOrderRecord {
  id: number;
  source: Record<string, unknown>;
  values: Record<FieldName, string>;
  dates: Record<DateField, Date | null>;
  durations: Record<DurationKey, number | null>;
  invalidDurationKeys: DurationKey[];
  qualityFlag: 'OK' | 'Backfilled Dispatch' | 'Time Data Error';
}

function datesShowBackfilledDispatch(dates: Record<DateField, Date | null>) {
  const dispatch = dates['Dispatch Time'];
  const departure = dates['Departure Time'];
  return Boolean(
    dispatch &&
    departure &&
    departure < dispatch
  );
}

export function isBackfilledWorkOrder(record: WorkOrderRecord) {
  return datesShowBackfilledDispatch(record.dates);
}

export interface ParsedRows {
  records: WorkOrderRecord[];
  recognizedFields: FieldName[];
  unrecognizedHeaders: string[];
}

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-–—]+/g, '');

const normalizedFields = new Map(
  FIELD_NAMES.map((field) => [normalizeHeader(field), field]),
);

export function recognizeHeaders(headers: string[]) {
  const mapping = new Map<FieldName, string>();
  const unrecognizedHeaders: string[] = [];

  for (const header of headers) {
    const canonical = normalizedFields.get(normalizeHeader(header));
    if (canonical && !mapping.has(canonical)) mapping.set(canonical, header);
    else if (!canonical && String(header).trim()) unrecognizedHeaders.push(header);
  }

  return { mapping, unrecognizedHeaders };
}

function excelSerialToDate(value: number): Date | null {
  if (!Number.isFinite(value) || value <= 0 || value > 2_958_465) return null;
  const milliseconds = Math.round((value - 25_569) * 86_400_000);
  const utc = new Date(milliseconds);
  if (Number.isNaN(utc.getTime())) return null;
  return new Date(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
    utc.getUTCSeconds(),
    utc.getUTCMilliseconds(),
  );
}

function buildLocalDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

export function parseDateTime(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'number') return excelSerialToDate(value);

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return excelSerialToDate(Number(text));

  const normalized = text
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const yearFirst = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?)?$/,
  );
  if (yearFirst) {
    return buildLocalDate(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
      Number(yearFirst[4] ?? 0),
      Number(yearFirst[5] ?? 0),
      Number(yearFirst[6] ?? 0),
    );
  }

  const dayOrMonthFirst = normalized.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (dayOrMonthFirst) {
    const first = Number(dayOrMonthFirst[1]);
    const second = Number(dayOrMonthFirst[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return buildLocalDate(
      Number(dayOrMonthFirst[3]),
      month,
      day,
      Number(dayOrMonthFirst[4] ?? 0),
      Number(dayOrMonthFirst[5] ?? 0),
      Number(dayOrMonthFirst[6] ?? 0),
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function durationMinutes(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  return Number.isFinite(minutes) ? minutes : null;
}

function validDuration(start: Date | null, end: Date | null) {
  const value = durationMinutes(start, end);
  return value != null && value >= 0 ? value : null;
}

export function buildWorkOrderRecords(rows: Record<string, unknown>[]): ParsedRows {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const { mapping, unrecognizedHeaders } = recognizeHeaders(headers);
  const recognizedFields = Array.from(mapping.keys());

  const records = rows.map((source, id) => {
    const values = Object.fromEntries(
      FIELD_NAMES.map((field) => {
        const header = mapping.get(field);
        const value = header ? source[header] : null;
        return [field, value == null ? '' : String(value).trim()];
      }),
    ) as Record<FieldName, string>;

    const dates = Object.fromEntries(
      DATE_FIELDS.map((field) => {
        const header = mapping.get(field);
        return [field, parseDateTime(header ? source[header] : null)];
      }),
    ) as Record<DateField, Date | null>;

    const rawDurations: Record<DurationKey, number | null> = {
      caseToCall: durationMinutes(dates['Case Occurs Time'], dates['Account Call Time']),
      callToCreated: durationMinutes(dates['Account Call Time'], dates['Created On']),
      woToDispatch: durationMinutes(dates['Created On'], dates['Dispatch Time']),
      dispatchToDeparture: durationMinutes(dates['Dispatch Time'], dates['Departure Time']),
      travelTime: durationMinutes(dates['Departure Time'], dates['Arrival Time']),
      dispatchToArrival: durationMinutes(dates['Dispatch Time'], dates['Arrival Time']),
      arrivalToClose: durationMinutes(dates['Arrival Time'], dates['Work Order Closed Time']),
    };

    const checkedKeys: DurationKey[] = [
      'woToDispatch',
      'dispatchToDeparture',
      'travelTime',
      'dispatchToArrival',
      'arrivalToClose',
    ];
    const invalidDurationKeys = checkedKeys.filter(
      (key) => rawDurations[key] != null && rawDurations[key]! < 0,
    );
    const durations: Record<DurationKey, number | null> = {
      caseToCall: rawDurations.caseToCall,
      callToCreated: rawDurations.callToCreated,
      woToDispatch: validDuration(dates['Created On'], dates['Dispatch Time']),
      dispatchToDeparture: validDuration(dates['Dispatch Time'], dates['Departure Time']),
      travelTime: validDuration(dates['Departure Time'], dates['Arrival Time']),
      dispatchToArrival: validDuration(dates['Dispatch Time'], dates['Arrival Time']),
      arrivalToClose: validDuration(dates['Arrival Time'], dates['Work Order Closed Time']),
    };
    const isBackfilled = datesShowBackfilledDispatch(dates);

    return {
      id,
      source,
      values,
      dates,
      durations,
      invalidDurationKeys,
      qualityFlag: isBackfilled
        ? 'Backfilled Dispatch'
        : invalidDurationKeys.length
          ? 'Time Data Error'
          : 'OK',
    } satisfies WorkOrderRecord;
  });

  return { records, recognizedFields, unrecognizedHeaders };
}

export function median(values: Array<number | null | undefined>) {
  const valid = values
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2
    ? valid[middle]
    : (valid[middle - 1] + valid[middle]) / 2;
}

export function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
}

export function distinctCount(records: WorkOrderRecord[], field: 'Case Number' | 'Work Order Number') {
  return new Set(records.map((record) => record.values[field]).filter(Boolean)).size;
}

export interface WorkOrderMetricEntry {
  workOrderNumber: string;
  value: number;
  record: WorkOrderRecord;
}

export function workOrderMetricEntries(records: WorkOrderRecord[], key: DurationKey) {
  const entries = new Map<string, WorkOrderMetricEntry>();
  for (const record of records) {
    const workOrderNumber = record.values['Work Order Number'];
    const value = record.durations[key];
    if (!workOrderNumber || value == null || entries.has(workOrderNumber)) continue;
    entries.set(workOrderNumber, { workOrderNumber, value, record });
  }
  return Array.from(entries.values());
}

export function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return 'N/A';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface WorkOrderFilters {
  dateFrom?: string;
  dateTo?: string;
  selections?: Partial<Record<FieldName, string[]>>;
}

export function filterWorkOrderRecords(records: WorkOrderRecord[], filters: WorkOrderFilters) {
  return records.filter((record) => {
    const created = record.dates['Created On'];
    const createdKey = created ? localDateKey(created) : '';
    if (filters.dateFrom && (!createdKey || createdKey < filters.dateFrom)) return false;
    if (filters.dateTo && (!createdKey || createdKey > filters.dateTo)) return false;
    return Object.entries(filters.selections ?? {}).every(([field, selected]) => (
      !selected?.length || selected.includes(record.values[field as FieldName])
    ));
  });
}

export function defaultWorkOrderTypeSelection(records: WorkOrderRecord[]) {
  const types = Array.from(
    new Set(records.map((record) => record.values['Work Order Type']).filter(Boolean)),
  );
  const repair = types.find((value) => value.toLowerCase() === 'repair');
  return repair ? [repair] : [];
}
