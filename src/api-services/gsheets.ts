import { getHandleComparisonKey, GrantDetails, GrantHandleService, GrantStatus, GrantWithStatus } from '@/types/grant';
import { google } from 'googleapis';

/**
 * Sheet format
 *
 * Columns:
 * A: Name
 * B: Email (normalized)
 * C: Wallet address
 * D: Handle (legacy — service unknown, only written before the Discord/Telegram split)
 * E: Discord handle
 * F: Telegram handle
 * G: Role
 * H: Hardware
 * I: OS
 * J: Goal
 * K: Application date
 * L: Claim date
 * M: Status
 * N: Amount
 * O: Raw amount
 * P: Nonce
 * Q: Signed faucet message
 * R: Transaction hash
 * S: OTP
 * T: OTP expiry date
 * U: OTP attempts
 * V: OTP last resent
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.GRANT_GSHEETS_SPREADSHEET_ID;

const LEGACY_HANDLE_COLUMN = 3;
const DISCORD_HANDLE_COLUMN = 4;
const TELEGRAM_HANDLE_COLUMN = 5;
const TX_HASH_COLUMN = 17;

function getRange(row?: number) {
  if (row || row === 0) {
    return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A${row}:V${row}`;
  }
  return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A3:V`;
}

async function getSheetsService() {
  const auth = new google.auth.JWT({
    email: process.env.GRANT_GSHEETS_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GRANT_GSHEETS_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function rowToGrant(row: string[]): GrantWithStatus {
  const discordHandle = row[DISCORD_HANDLE_COLUMN];
  const telegramHandle = row[TELEGRAM_HANDLE_COLUMN];
  const legacyHandle = row[LEGACY_HANDLE_COLUMN];
  // Legacy rows only have the service-agnostic column, so they resolve to an undefined service.
  const handleService: GrantHandleService | undefined = discordHandle
    ? 'discord'
    : telegramHandle
      ? 'telegram'
      : undefined;
  return {
    name: row[0],
    email: row[1],
    walletAddress: row[2],
    legacyHandle,
    handle: discordHandle || telegramHandle || legacyHandle,
    handleService,
    role: row[6],
    hardware: row[7] ? row[7].split(', ') : [],
    os: row[8],
    goal: row[9],
    applicationDate: new Date(row[10]),
    claimDate: row[11] ? new Date(row[11]) : undefined,
    status: row[12] as GrantStatus,
    amount: row[13],
    rawAmount: row[14],
    nonce: row[15] ? Number(row[15]) : undefined,
    signedFaucetMessage: row[16],
    txHash: row[TX_HASH_COLUMN],
    otp: row[18],
    otpExpires: row[19] ? Number(row[19]) : undefined,
    otpAttempts: row[20] ? Number(row[20]) : 0,
    otpLastResent: row[21] ? Number(row[21]) : undefined,
  };
}

function grantToRow(data: GrantWithStatus): string[] {
  // Sheets drops `undefined` cells, which would shift the row — coerce every cell to a string.
  const cells: Array<string | number | undefined> = [
    // A: Name
    data.name,
    // B: Email (normalized)
    data.email,
    // C: Wallet address
    data.walletAddress,
    // D: Handle (legacy — preserved as-is, never populated for new submissions)
    data.legacyHandle ?? '',
    // E: Discord handle
    data.handleService === 'discord' ? data.handle : '',
    // F: Telegram handle
    data.handleService === 'telegram' ? data.handle : '',
    // G: Role
    data.role,
    // H: Hardware
    data.hardware.join(', '),
    // I: OS
    data.os,
    // J: Goal
    data.goal,
    // K: Application date
    data.applicationDate.toISOString(),
    // L: Claim date
    data.claimDate ? data.claimDate.toISOString() : '',
    // M: Status
    data.status,
    // N: Amount
    data.amount,
    // O: Raw amount
    data.rawAmount,
    // P: Nonce
    data.nonce,
    // Q: Signed faucet message
    data.signedFaucetMessage,
    // R: Transaction hash
    data.txHash,
    // S: OTP
    data.otp,
    // T: OTP expiry date
    data.otpExpires,
    // U: OTP attempts
    data.otpAttempts ?? 0,
    // V: OTP last resent
    data.otpLastResent ?? '',
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
 * A row matches a handle when the column for that service matches, or when the legacy
 * (service-unknown) column does. Legacy rows predate the split, so a match there is treated
 * as the same person regardless of the service now selected.
 * Comparison goes through getHandleComparisonKey, so stored rows that kept an "@", surrounding
 * whitespace or a pasted profile link still match a bare handle.
 */
function rowMatchesHandle(row: string[], handle: string, handleService: GrantHandleService): boolean {
  const key = getHandleComparisonKey(handle);
  if (!key) {
    return false;
  }
  return [row[serviceHandleColumn(handleService)], row[LEGACY_HANDLE_COLUMN]].some(
    (value) => !!value && getHandleComparisonKey(value) === key
  );
}

function serviceHandleColumn(handleService: GrantHandleService): number {
  return handleService === 'discord' ? DISCORD_HANDLE_COLUMN : TELEGRAM_HANDLE_COLUMN;
}

export async function findGrantInSheet({
  email,
  walletAddress,
}: {
  email?: string;
  walletAddress?: string;
}): Promise<GrantWithStatus | null> {
  if (!email && !walletAddress) {
    throw new Error('Missing required fields');
  }
  const rows = await getAllRows();
  if (rows.length === 0) return null;
  const rowIndex = rows.findIndex(
    (row) =>
      (email && row[1]?.toLowerCase() === email.toLowerCase()) ||
      (walletAddress && row[2]?.toLowerCase() === walletAddress.toLowerCase())
  );
  if (rowIndex === -1) return null;
  return rowToGrant(rows[rowIndex]);
}

export async function findGrantByHandle({
  handle,
  handleService,
}: {
  handle: string;
  handleService: GrantHandleService;
}): Promise<GrantWithStatus | null> {
  const rows = await getAllRows();
  if (rows.length === 0) return null;
  const rowIndex = rows.findIndex((row) => rowMatchesHandle(row, handle, handleService));
  if (rowIndex === -1) return null;
  return rowToGrant(rows[rowIndex]);
}

export async function findGrantByTxHash(txHash: string): Promise<GrantWithStatus | null> {
  const rows = await getAllRows();
  if (rows.length === 0) return null;
  const rowIndex = rows.findIndex((row) => row[TX_HASH_COLUMN]?.toLowerCase() === txHash.toLowerCase());
  if (rowIndex === -1) return null;
  return rowToGrant(rows[rowIndex]);
}

export async function insertGrantInSheet(
  data: GrantDetails & { otp?: string; otpExpires?: number; otpAttempts?: number; otpLastResent?: number }
) {
  const service = await getSheetsService();
  // Late dedupe check — tightens (but does not eliminate) the race window between two
  // parallel first-time submits for the same wallet/email/handle. Sheets has no atomic upsert,
  // so this is a best-effort safeguard against duplicate rows.
  const existingRows = await getAllRows();
  const dup = existingRows.some(
    (row) =>
      row[1]?.toLowerCase() === data.email.toLowerCase() ||
      row[2]?.toLowerCase() === data.walletAddress.toLowerCase() ||
      rowMatchesHandle(row, data.handle, data.handleService)
  );
  if (dup) {
    throw new Error('Grant row already exists for this wallet, email or handle');
  }
  const values = [
    grantToRow({
      ...data,
      applicationDate: new Date(),
      status: GrantStatus.PENDING,
      amount: '',
      rawAmount: '',
      signedFaucetMessage: '',
      txHash: '',
    }),
  ];
  await service.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function updateGrantInSheet(data: GrantWithStatus): Promise<boolean> {
  const service = await getSheetsService();
  const rows = await getAllRows();
  if (rows.length === 0) return false;
  const rowIndex = rows.findIndex((row) => row[2]?.toLowerCase() === data.walletAddress.toLowerCase());
  if (rowIndex === -1) return false;
  const rowNumber = rowIndex + 3; // +3 because of header rows and 1-based indexing
  const updateRange = getRange(rowNumber);
  const values = [grantToRow({ ...data, legacyHandle: data.legacyHandle ?? rows[rowIndex][LEGACY_HANDLE_COLUMN] })];
  await service.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: updateRange,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return true;
}
