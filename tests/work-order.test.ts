import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseWorkbookData } from '../lib/import-data.ts';
import {
  average,
  buildWorkOrderRecords,
  defaultWorkOrderTypeSelection,
  distinctCount,
  filterWorkOrderRecords,
  formatDuration,
  isBackfilledWorkOrder,
  isCalculationEligible,
  median,
  parseDateTime,
  recognizeHeaders,
  workOrderMetricEntries,
} from '../lib/work-order.ts';

const rows = [
  {
    'Case Number': 'C-1',
    'Work Order Number': 'WO-1',
    'Created On': '2026-08-01 08:00',
    'Dispatch Time': '2026-08-01 08:10',
    'Departure Time': '2026-08-01 08:30',
    'Arrival Time': '2026-08-01 09:00',
    'Work Order Closed Time': '2026-08-01 11:00',
    'Service Region': 'East',
    Country: 'China',
    'Work Order Type': 'Repair',
    'Service Crew Dispatcher': 'Dispatcher A',
  },
  {
    'Case Number': 'C-1',
    'Work Order Number': 'WO-2',
    'Created On': '2026-08-02 08:00',
    'Dispatch Time': '2026-08-02 10:05',
    'Departure Time': '2026-08-02 10:30',
    'Arrival Time': '2026-08-02 11:30',
    'Work Order Closed Time': '2026-08-02 13:00',
    'Service Region': 'West',
    Country: 'China',
    'Work Order Type': 'Installation',
    'Service Crew Dispatcher': 'Dispatcher B',
  },
  {
    'Case Number': 'C-2',
    'Work Order Number': 'WO-3',
    'Created On': '2026-08-03 09:00',
    'Dispatch Time': '2026-08-03 08:00',
    'Departure Time': '',
    'Arrival Time': '',
    'Service Region': 'East',
    Country: 'Japan',
    'Work Order Type': 'repair',
    'Service Crew Dispatcher': 'Dispatcher A',
  },
  {
    'Case Number': 'C-1',
    'Work Order Number': 'WO-1',
    'Created On': '2026-08-01 08:00',
    'Dispatch Time': '2026-08-01 08:10',
    'Service Region': 'East',
    Country: 'China',
    'Work Order Type': 'Repair',
    'Service Crew Dispatcher': 'Dispatcher A',
  },
];

test('recognizes supported headers without manual mapping', () => {
  const result = recognizeHeaders([
    ' case-number ',
    'WORK ORDER NUMBER',
    'Service Team Dispatch Officer - Reference',
    'Service Crew Dispatcher',
    'Order Dispatcher',
    'Unknown Field',
  ]);
  assert.equal(result.mapping.get('Case Number'), ' case-number ');
  assert.equal(result.mapping.get('Work Order Number'), 'WORK ORDER NUMBER');
  assert.equal(result.mapping.get('Service Team Dispatch Officer - Reference'), 'Service Team Dispatch Officer - Reference');
  assert.equal(result.mapping.get('Service Crew Dispatcher'), 'Service Crew Dispatcher');
  assert.equal(result.mapping.get('Order Dispatcher'), 'Order Dispatcher');
  assert.deepEqual(result.unrecognizedHeaders, ['Unknown Field']);
});

test('parses common Excel-style dates and preserves missing values', () => {
  assert.equal(parseDateTime('2026/08/24 14:30')?.getFullYear(), 2026);
  assert.equal(parseDateTime('2026年8月24日 14:30')?.getMonth(), 7);
  const serialDate = parseDateTime(45_000);
  assert.equal(serialDate?.getFullYear(), 2023);
  assert.equal(serialDate?.getHours(), 0);
  assert.equal(parseDateTime(''), null);
  assert.equal(parseDateTime('not a date'), null);
});

test('calculates work-order durations using the required start and end fields', () => {
  const record = buildWorkOrderRecords(rows.slice(0, 1)).records[0];
  assert.equal(record.durations.woToDispatch, 10);
  assert.equal(record.durations.dispatchToDeparture, 20);
  assert.equal(record.durations.travelTime, 30);
  assert.equal(record.durations.dispatchToArrival, 50);
  assert.equal(record.durations.arrivalToClose, 120);
});

test('flags negative time sequences and excludes their invalid duration', () => {
  const record = buildWorkOrderRecords(rows.slice(2, 3)).records[0];
  assert.equal(record.durations.woToDispatch, null);
  assert.equal(record.qualityFlag, 'Time Data Error');
  assert.deepEqual(record.invalidDurationKeys, ['woToDispatch']);
});

test('classifies backfilled rows using dispatch order and negative travel time', () => {
  const [
    afterCreated,
    beforeCreated,
    arrivalAfterDispatch,
    missingArrival,
    missingDepartureArrivalBefore,
    missingDepartureArrivalAfter,
    missingBoth,
    arrivalBeforeDeparture,
    closedBeforeArrival,
  ] = buildWorkOrderRecords([
    {
      'Work Order Number': 'WO-B1',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 12:00',
      'Departure Time': '2026-08-01 09:00',
      'Arrival Time': '2026-08-01 10:00',
    },
    {
      'Work Order Number': 'WO-B2',
      'Created On': '2026-08-01 10:00',
      'Dispatch Time': '2026-08-01 12:00',
      'Departure Time': '2026-08-01 08:00',
      'Arrival Time': '2026-08-01 09:00',
    },
    {
      'Work Order Number': 'WO-E1',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '2026-08-01 09:00',
      'Arrival Time': '2026-08-01 11:00',
    },
    {
      'Work Order Number': 'WO-B3',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '2026-08-01 09:00',
      'Arrival Time': '',
    },
    {
      'Work Order Number': 'WO-B4',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '',
      'Arrival Time': '2026-08-01 09:00',
    },
    {
      'Work Order Number': 'WO-S1',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '',
      'Arrival Time': '2026-08-01 11:00',
    },
    {
      'Work Order Number': 'WO-S2',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '',
      'Arrival Time': '',
    },
    {
      'Work Order Number': 'WO-B5',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '2026-08-01 12:00',
      'Arrival Time': '2026-08-01 11:59',
    },
    {
      'Work Order Number': 'WO-S3',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 10:00',
      'Departure Time': '2026-08-01 11:00',
      'Arrival Time': '2026-08-01 12:00',
      'Work Order Closed Time': '2026-08-01 11:30',
    },
  ].map((row) => ({ 'Service Crew Dispatcher': 'Dispatcher A', ...row }))).records;

  assert.equal(isBackfilledWorkOrder(afterCreated), true);
  assert.equal(afterCreated.qualityFlag, 'Backfilled Dispatch');
  assert.equal(afterCreated.durations.woToDispatch, 240);
  assert.equal(afterCreated.durations.travelTime, 60);

  assert.equal(isBackfilledWorkOrder(beforeCreated), true);
  assert.equal(beforeCreated.qualityFlag, 'Backfilled Dispatch');

  assert.equal(isBackfilledWorkOrder(arrivalAfterDispatch), true);
  assert.equal(arrivalAfterDispatch.qualityFlag, 'Backfilled Dispatch');

  assert.equal(isBackfilledWorkOrder(missingArrival), true);
  assert.equal(missingArrival.qualityFlag, 'Backfilled Dispatch');

  assert.equal(isBackfilledWorkOrder(missingDepartureArrivalBefore), true);
  assert.equal(missingDepartureArrivalBefore.qualityFlag, 'Backfilled Dispatch');
  assert.equal(missingDepartureArrivalBefore.durations.woToDispatch, 120);
  assert.equal(missingDepartureArrivalBefore.durations.travelTime, null);

  assert.equal(isBackfilledWorkOrder(missingDepartureArrivalAfter), false);
  assert.equal(missingDepartureArrivalAfter.qualityFlag, 'OK');
  assert.equal(missingDepartureArrivalAfter.durations.dispatchToArrival, 60);
  assert.equal(missingDepartureArrivalAfter.durations.travelTime, null);

  assert.equal(isBackfilledWorkOrder(missingBoth), false);
  assert.equal(missingBoth.qualityFlag, 'OK');
  assert.equal(missingBoth.durations.woToDispatch, 120);
  assert.equal(missingBoth.durations.dispatchToDeparture, null);
  assert.equal(missingBoth.durations.dispatchToArrival, null);
  assert.equal(missingBoth.durations.travelTime, null);

  assert.equal(isBackfilledWorkOrder(arrivalBeforeDeparture), true);
  assert.equal(arrivalBeforeDeparture.qualityFlag, 'Backfilled Dispatch');
  assert.equal(arrivalBeforeDeparture.durations.woToDispatch, 120);
  assert.equal(arrivalBeforeDeparture.durations.travelTime, null);

  assert.equal(isBackfilledWorkOrder(closedBeforeArrival), false);
  assert.equal(closedBeforeArrival.qualityFlag, 'OK');
  assert.equal(closedBeforeArrival.durations.dispatchToDeparture, 60);
  assert.equal(closedBeforeArrival.durations.travelTime, 60);
  assert.equal(closedBeforeArrival.durations.dispatchToArrival, 120);
  assert.equal(closedBeforeArrival.durations.arrivalToClose, null);
  assert.deepEqual(closedBeforeArrival.invalidDurationKeys, []);
});

test('resolves Service Crew Dispatcher and excludes missing dispatcher rows from calculations', () => {
  const [direct, fallback, missing, systemFallback] = buildWorkOrderRecords([
    {
      'Case Number': 'C-D1',
      'Work Order Number': 'WO-D1',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 09:00',
      'Service Crew Dispatcher': 'Alice',
      'Order Dispatcher': 'Bob',
    },
    {
      'Case Number': 'C-D2',
      'Work Order Number': 'WO-D2',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 09:00',
      'Service Crew Dispatcher': '',
      'Order Dispatcher': 'Bob',
    },
    {
      'Case Number': 'C-D3',
      'Work Order Number': 'WO-D3',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 09:00',
      'Service Crew Dispatcher': '',
      'Order Dispatcher': '',
    },
    {
      'Case Number': 'C-D4',
      'Work Order Number': 'WO-D4',
      'Created On': '2026-08-01 08:00',
      'Dispatch Time': '2026-08-01 09:00',
      'Service Crew Dispatcher': '',
      'Order Dispatcher': 'SYSTEM',
    },
  ]).records;

  assert.equal(direct.values['Service Crew Dispatcher'], 'Alice');
  assert.equal(direct.qualityFlag, 'OK');
  assert.equal(fallback.values['Service Crew Dispatcher'], 'Bob');
  assert.equal(fallback.qualityFlag, 'OK');
  assert.equal(missing.qualityFlag, 'Dispatcher Data Error');
  assert.equal(systemFallback.qualityFlag, 'Dispatcher Data Error');
  assert.equal(isCalculationEligible(missing), false);
  assert.equal(isCalculationEligible(systemFallback), false);
  assert.equal(workOrderMetricEntries([direct, fallback, missing, systemFallback], 'woToDispatch').length, 2);
  assert.equal(distinctCount([direct, fallback, missing, systemFallback], 'Case Number'), 2);
});

test('counts distinct Case Number and Work Order Number independently', () => {
  const records = buildWorkOrderRecords(rows).records;
  assert.equal(distinctCount(records, 'Case Number'), 2);
  assert.equal(distinctCount(records, 'Work Order Number'), 3);
});

test('calculates median correctly without null values or outlier distortion', () => {
  assert.equal(median([10, 12, 15, 18, 540, null]), 15);
  assert.equal(median([10, 20]), 15);
  assert.equal(median([null]), null);
});

test('calculates average correctly while excluding null values', () => {
  assert.equal(average([10, 20, 30, null]), 20);
  assert.equal(average([null]), null);
});

test('uses each Work Order Number once in time metrics while retaining raw rows', () => {
  const records = buildWorkOrderRecords(rows).records;
  assert.equal(records.length, 4);
  const entries = workOrderMetricEntries(records, 'woToDispatch');
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.workOrderNumber), ['WO-1', 'WO-2']);
});

test('formats durations as minutes, hours, or N/A', () => {
  assert.equal(formatDuration(18), '18 min');
  assert.equal(formatDuration(125), '2.1 h');
  assert.equal(formatDuration(null), 'N/A');
});

test('applies date and multi-select filters together', () => {
  const records = buildWorkOrderRecords(rows).records;
  const filtered = filterWorkOrderRecords(records, {
    dateFrom: '2026-08-01',
    dateTo: '2026-08-02',
    selections: { 'Service Region': ['East'], Country: ['China'] },
  });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((record) => record.values['Work Order Number'] === 'WO-1'));
});

test('defaults Work Order Type to Repair when present, without hard-coding the source casing', () => {
  const records = buildWorkOrderRecords(rows).records;
  assert.deepEqual(defaultWorkOrderTypeSelection(records), ['Repair']);
});

test('imports an Excel workbook and auto-recognizes fields', () => {
  const workbook = XLSX.utils.book_new();
  const excelRows = rows.slice(0, 2).map((row, index) => ({
    ...row,
    'Created On': new Date(2026, 7, index + 1, 8, 0),
    'Dispatch Time': new Date(2026, 7, index + 1, index ? 10 : 8, index ? 5 : 10),
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(excelRows), 'Orders');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const result = parseWorkbookData(data, 'orders.xlsx');
  assert.equal(result.rawRowCount, 2);
  assert.equal(result.sheetName, 'Orders');
  assert.ok(result.recognizedFields.includes('Work Order Number'));
  assert.equal(result.records[0].durations.woToDispatch, 10);
});

test('imports CSV data and leaves absent optional fields harmlessly empty', () => {
  const csv = 'Case Number,Work Order Number,Created On,Dispatch Time\nC-9,WO-9,2026-08-01 08:00,2026-08-01 08:20';
  const bytes = new TextEncoder().encode(csv);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = parseWorkbookData(data, 'orders.csv');
  assert.equal(result.rawRowCount, 1);
  assert.equal(result.records[0].values.Modality, '');
  assert.equal(result.records[0].durations.woToDispatch, 20);
});
