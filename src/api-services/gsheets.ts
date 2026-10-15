import {
  getHandleComparisonKey,
  SUBSIDY_HANDLE_SERVICE_CHOICES,
  SubsidyDetails,
  SubsidyHandles,
  SubsidyHandleService,
  SubsidyStatus,
  SubsidyWithStatus,
} from '@/types/subsidy';
import { google } from 'googleapis';

/**
 * Sheet format
 *
 * Columns:
 * A: Name
 * B: Email (normalized)
 * C: Wallet address
 * D: Discord handle
 * E: Telegram handle
 * F: X handle
 * G: Application date
 * H: Email verified date
 * I: Claim date
 * J: Status
 * K: OTP (hashed)
 * L: OTP expiry date
 * M: OTP attempts
 * N: OTP last resent
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.SUBSIDY_GSHEETS_SPREADSHEET_ID;

const FIRST_DATA_ROW = 3;
const LAST_COLUMN = 'N';

const EMAIL_COLUMN = 1;
const WALLET_COLUMN = 2;
const HANDLE_COLUMNS: Record<SubsidyHandleService, number> = {
  discord: 3,
  telegram: 4,
  x: 5,
};

function getRange(row?: number) {
  if (row || row === 0) {
    return `${process.env.SUBSIDY_GSHEETS_SHEET_NAME}!A${row}:${LAST_COLUMN}${row}`;
  }
  return `${process.env.SUBSIDY_GSHEETS_SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COLUMN}`;
}

async function getSheetsService() {
  const auth = new google.auth.JWT({
    email: process.env.SUBSIDY_GSHEETS_SERVICE_ACCOUNT_EMAIL,
    key: process.env.SUBSIDY_GSHEETS_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const parseDate = (value: string | undefined) => (value ? new Date(value) : undefined);

const parseNumber = (value: string | undefined) => (value ? Number(value) : undefined);

function rowToHandles(row: string[]): SubsidyHandles {
  const handles: SubsidyHandles = {};
  for (const { value: service } of SUBSIDY_HANDLE_SERVICE_CHOICES) {
    const handle = row[HANDLE_COLUMNS[service]];
    if (handle) {
      handles[service] = handle;
    }
  }
  return handles;
}

function rowToSubsidy(row: string[]): SubsidyWithStatus {
  return {
    name: row[0],
    email: row[EMAIL_COLUMN],
    walletAddress: row[WALLET_COLUMN],
    handles: rowToHandles(row),
    applicationDate: new Date(row[6]),
    verifiedDate: parseDate(row[7]),
    claimDate: parseDate(row[8]),
    status: row[9] as SubsidyStatus,
    otp: row[10],
    otpExpires: parseNumber(row[11]),
    otpAttempts: parseNumber(row[12]) ?? 0,
    otpLastResent: parseNumber(row[13]),
  };
}

function subsidyToRow(data: SubsidyWithStatus): string[] {
  // Sheets drops `undefined` cells, which would shift the row — coerce every cell to a string.
  const cells: Array<string | number | undefined> = [
    // A: Name
    data.name,
    // B: Email (normalized)
    data.email,
    // C: Wallet address
    data.walletAddress,
    // D: Discord handle
    data.handles.discord,
    // E: Telegram handle
    data.handles.telegram,
    // F: X handle
    data.handles.x,
    // G: Application date
    data.applicationDate.toISOString(),
    // H: Email verified date
    data.verifiedDate?.toISOString(),
    // I: Claim date
    data.claimDate?.toISOString(),
    // J: Status
    data.status,
    // K: OTP (hashed)
    data.otp,
    // L: OTP expiry date
    data.otpExpires,
    // M: OTP attempts
    data.otpAttempts ?? 0,
    // N: OTP last resent
    data.otpLastResent,
  ];
  return cells.map((cell) => (cell === undefined || cell === null ? '' : String(cell)));
}

async function getAllRows(): Promise<string[][]> {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  return response.data.values ?? [];
}

/**
 * Comparison goes through getHandleComparisonKey, so stored rows that kept an "@" or surrounding
 * whitespace still match a bare handle.
 */
function rowMatchesAnyHandle(row: string[], handles: SubsidyHandles): boolean {
  return SUBSIDY_HANDLE_SERVICE_CHOICES.some(({ value: service }) => {
    const key = getHandleComparisonKey(handles[service] ?? '');
    if (!key) {
      return false;
    }
    const value = row[HANDLE_COLUMNS[service]];
    return !!value && getHandleComparisonKey(value) === key;
  });
}

export async function findSubsidyInSheet({
  email,
  walletAddress,
}: {
  email?: string;
  walletAddress?: string;
}): Promise<SubsidyWithStatus | null> {
  if (!email && !walletAddress) {
    throw new Error('Missing required fields');
  }
  const rows = await getAllRows();
  if (rows.length === 0) return null;
  const rowIndex = rows.findIndex(
    (row) =>
      (email && row[EMAIL_COLUMN]?.toLowerCase() === email.toLowerCase()) ||
      (walletAddress && row[WALLET_COLUMN]?.toLowerCase() === walletAddress.toLowerCase())
  );
  if (rowIndex === -1) return null;
  return rowToSubsidy(rows[rowIndex]);
}

export async function findSubsidiesByHandles(handles: SubsidyHandles): Promise<SubsidyWithStatus[]> {
  const rows = await getAllRows();
  return rows.filter((row) => rowMatchesAnyHandle(row, handles)).map(rowToSubsidy);
}

export async function insertSubsidyInSheet(
  data: SubsidyDetails & { otp?: string; otpExpires?: number; otpAttempts?: number; otpLastResent?: number }
) {
  const service = await getSheetsService();
  // Late dedupe check — tightens (but does not eliminate) the race window between two
  // parallel first-time submits for the same wallet/email/handle. Sheets has no atomic upsert,
  // so this is a best-effort safeguard against duplicate rows.
  const existingRows = await getAllRows();
  const dup = existingRows.some(
    (row) =>
      row[EMAIL_COLUMN]?.toLowerCase() === data.email.toLowerCase() ||
      row[WALLET_COLUMN]?.toLowerCase() === data.walletAddress.toLowerCase() ||
      rowMatchesAnyHandle(row, data.handles)
  );
  if (dup) {
    throw new Error('Subsidy row already exists for this wallet, email or handle');
  }
  const values = [subsidyToRow({ ...data, applicationDate: new Date(), status: SubsidyStatus.PENDING })];
  await service.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function updateSubsidyInSheet(data: SubsidyWithStatus): Promise<boolean> {
  const service = await getSheetsService();
  const rows = await getAllRows();
  if (rows.length === 0) return false;
  const rowIndex = rows.findIndex((row) => row[WALLET_COLUMN]?.toLowerCase() === data.walletAddress.toLowerCase());
  if (rowIndex === -1) return false;
  const rowNumber = rowIndex + FIRST_DATA_ROW;
  await service.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(rowNumber),
    valueInputOption: 'RAW',
    requestBody: { values: [subsidyToRow(data)] },
  });
  return true;
}
