import * as XLSX from 'xlsx';
import { buildWorkOrderRecords, type ParsedRows } from './work-order.ts';

export interface ImportResult extends ParsedRows {
  sheetName: string;
  rawRowCount: number;
}

export function parseWorkbookData(data: ArrayBuffer, fileName: string): ImportResult {
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: false,
    raw: true,
    dense: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No worksheet was found in this file.');
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
  if (!rows.length) throw new Error('The selected file has no data rows.');

  const parsed = buildWorkOrderRecords(rows);
  if (!parsed.recognizedFields.length) {
    throw new Error(`No supported work order fields were found in ${fileName}.`);
  }

  return { ...parsed, sheetName, rawRowCount: rows.length };
}

export async function importWorkOrderFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
    throw new Error('Please choose an Excel (.xlsx, .xls) or CSV (.csv) file.');
  }
  return parseWorkbookData(await file.arrayBuffer(), file.name);
}
