import {
  getHandleComparisonKey,
  SubsidyDetails,
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
 * F: Application date
 * G: Email verified date
 * H: Claim date
 * I: Status
 * J: OTP (hashed)
 * K: OTP expiry date
 * L: OTP attempts
 * M: OTP last resent
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.SUBSIDY_GSHEETS_SPREADSHEET_ID;

const FIRST_DATA_ROW = 3;
const LAST_COLUMN = 'M';

const EMAIL_COLUMN = 1;
const WALLET_COLUMN = 2;
const DISCORD_HANDLE_COLUMN = 3;
const TELEGRAM_HANDLE_COLUMN = 4;

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

function rowToSubsidy(row: string[]): SubsidyWithStatus {
  const discordHandle = row[DISCORD_HANDLE_COLUMN];
  return {
    name: row[0],
    email: row[EMAIL_COLUMN],
    walletAddress: row[WALLET_COLUMN],
    handle: discordHandle || row[TELEGRAM_HANDLE_COLUMN],
    handleService: discordHandle ? 'discord' : 'telegram',
    applicationDate: new Date(row[5]),
    verifiedDate: parseDate(row[6]),
    claimDate: parseDate(row[7]),
    status: row[8] as SubsidyStatus,
    otp: row[9],
    otpExpires: parseNumber(row[10]),
    otpAttempts: parseNumber(row[11]) ?? 0,
    otpLastResent: parseNumber(row[12]),
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
    data.handleService === 'discord' ? data.handle : '',
    // E: Telegram handle
    data.handleService === 'telegram' ? data.handle : '',
    // F: Application date
    data.applicationDate.toISOString(),
    // G: Email verified date
    data.verifiedDate?.toISOString(),
    // H: Claim date
    data.claimDate?.toISOString(),
    // I: Status
    data.status,
    // J: OTP (hashed)
    data.otp,
    // K: OTP expiry date
    data.otpExpires,
    // L: OTP attempts
    data.otpAttempts ?? 0,
    // M: OTP last resent
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
function rowMatchesHandle(row: string[], handle: string, handleService: SubsidyHandleService): boolean {
  const key = getHandleComparisonKey(handle);
  if (!key) {
    return false;
  }
  const value = row[handleService === 'discord' ? DISCORD_HANDLE_COLUMN : TELEGRAM_HANDLE_COLUMN];
  return !!value && getHandleComparisonKey(value) === key;
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

export async function findSubsidyByHandle({
  handle,
  handleService,
}: {
  handle: string;
  handleService: SubsidyHandleService;
}): Promise<SubsidyWithStatus | null> {
  const rows = await getAllRows();
  if (rows.length === 0) return null;
  const matches = rows.filter((row) => rowMatchesHandle(row, handle, handleService)).map(rowToSubsidy);
  if (matches.length === 0) return null;
  return matches.find((match) => match.status !== SubsidyStatus.PENDING) ?? matches[0];
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
      rowMatchesHandle(row, data.handle, data.handleService)
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
