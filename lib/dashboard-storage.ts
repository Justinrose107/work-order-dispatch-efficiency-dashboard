import type { FieldName } from './work-order';

export type StoredDashboardView = 'standard' | 'backfill';

export interface StoredImport {
  fileName: string;
  data: ArrayBuffer;
  savedAt: number;
}

export interface StoredDashboardPreferences {
  filters: Partial<Record<FieldName, string[]>>;
  dateFrom: string;
  dateTo: string;
  dashboardView: StoredDashboardView;
  detailDate: string;
}

const DATABASE_NAME = 'work-order-dispatch-dashboard';
const DATABASE_VERSION = 1;
const IMPORT_STORE = 'imports';
const LATEST_IMPORT_KEY = 'latest';
const PREFERENCES_KEY = 'work-order-dispatch-dashboard:preferences:v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMPORT_STORE)) {
        database.createObjectStore(IMPORT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage could not be opened.'));
    request.onblocked = () => reject(new Error('Browser storage is blocked by another tab.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Browser storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage transaction was cancelled.'));
  });
}

export async function loadStoredImport(): Promise<StoredImport | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(IMPORT_STORE, 'readonly');
    const completion = transactionDone(transaction);
    const stored = await requestResult(transaction.objectStore(IMPORT_STORE).get(LATEST_IMPORT_KEY));
    await completion;
    return (stored as StoredImport | undefined) ?? null;
  } finally {
    database.close();
  }
}

export async function saveStoredImport(storedImport: StoredImport): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(IMPORT_STORE, 'readwrite');
    const completion = transactionDone(transaction);
    await requestResult(transaction.objectStore(IMPORT_STORE).put(storedImport, LATEST_IMPORT_KEY));
    await completion;
  } finally {
    database.close();
  }
}

export async function deleteStoredImport(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(IMPORT_STORE, 'readwrite');
    const completion = transactionDone(transaction);
    await requestResult(transaction.objectStore(IMPORT_STORE).delete(LATEST_IMPORT_KEY));
    await completion;
  } finally {
    database.close();
  }
}

export function loadStoredPreferences(): StoredDashboardPreferences | null {
  const value = window.localStorage.getItem(PREFERENCES_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredDashboardPreferences;
  } catch {
    return null;
  }
}

export function saveStoredPreferences(preferences: StoredDashboardPreferences): void {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function clearStoredPreferences(): void {
  window.localStorage.removeItem(PREFERENCES_KEY);
}
