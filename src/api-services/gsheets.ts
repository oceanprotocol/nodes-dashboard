import { GrantDetails, GrantStatus, GrantWithStatus } from '@/types/grant';
import { google } from 'googleapis';

/**
 * Sheet format
 *
 * Columns:
 * A: Name
 * B: Email (normalized)
 * C: Wallet address
 * D: Handle
 * E: Role
 * F: Hardware
 * G: OS
 * H: Goal
 * I: Application date
 * J: Claim date
 * K: Status
 * L: Amount
 * M: Raw amount
 * N: Nonce
 * O: Signed faucet message
 * P: Transaction hash
 * Q: OTP
 * R: OTP expiry date
 * S: OTP attempts
 * T: OTP last resent
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.GRANT_GSHEETS_SPREADSHEET_ID;

function getRange(row?: number) {
  if (row || row === 0) {
    return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A${row}:T${row}`;
  }
  return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A3:T`;
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
  return {
    name: row[0],
    email: row[1],
    walletAddress: row[2],
    handle: row[3],
    role: row[4],
    hardware: row[5] ? row[5].split(', ') : [],
    os: row[6],
    goal: row[7],
    applicationDate: new Date(row[8]),
    claimDate: row[9] ? new Date(row[9]) : undefined,
    status: row[10] as GrantStatus,
    amount: row[11],
    rawAmount: row[12],
    nonce: row[13] ? Number(row[13]) : undefined,
    signedFaucetMessage: row[14],
    txHash: row[15],
    otp: row[16],
    otpExpires: row[17] ? Number(row[17]) : undefined,
    otpAttempts: row[18] ? Number(row[18]) : 0,
    otpLastResent: row[19] ? Number(row[19]) : undefined,
  };
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
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;
  const rowIndex = rows.findIndex(
    (row) =>
      (email && row[1]?.toLowerCase() === email.toLowerCase()) ||
      (walletAddress && row[2]?.toLowerCase() === walletAddress.toLowerCase())
  );
  if (rowIndex === -1) return null;
  return rowToGrant(rows[rowIndex]);
}

export async function findGrantByTxHash(txHash: string): Promise<GrantWithStatus | null> {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;
  const rowIndex = rows.findIndex((row) => row[15]?.toLowerCase() === txHash.toLowerCase());
  if (rowIndex === -1) return null;
  return rowToGrant(rows[rowIndex]);
}

export async function insertGrantInSheet(
  data: GrantDetails & { otp?: string; otpExpires?: number; otpAttempts?: number; otpLastResent?: number }
) {
  const service = await getSheetsService();
  // Late dedupe check — tightens (but does not eliminate) the race window between two
  // parallel first-time submits for the same wallet/email. Sheets has no atomic upsert,
  // so this is a best-effort safeguard against duplicate rows.
  const existing = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const existingRows = existing.data.values ?? [];
  const dup = existingRows.some(
    (row) =>
      row[1]?.toLowerCase() === data.email.toLowerCase() || row[2]?.toLowerCase() === data.walletAddress.toLowerCase()
  );
  if (dup) {
    throw new Error('Grant row already exists for this wallet or email');
  }
  const values = [
    [
      // A: Name
      data.name,
      // B: Email (normalized)
      data.email,
      // C: Wallet address
      data.walletAddress,
      // D: Handle
      data.handle,
      // E: Role
      data.role,
      // F: Hardware
      data.hardware.join(', '),
      // G: OS
      data.os,
      // H: Goal
      data.goal,
      // I: Application date
      new Date().toISOString(),
      // J: Claim date
      '',
      // K: Status
      GrantStatus.PENDING,
      // L: Amount
      '',
      // M: Raw amount
      '',
      // N: Nonce
      '',
      // O: Signed faucet message
      '',
      // P: Transaction hash
      '',
      // Q: OTP
      data.otp,
      // R: OTP expiry date
      data.otpExpires,
      // S: OTP attempts
      data.otpAttempts ?? 0,
      // T: OTP last resent
      data.otpLastResent ?? '',
    ],
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
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const rows = response.data.values;
  if (!rows) return false;
  const rowIndex = rows.findIndex((row) => row[2]?.toLowerCase() === data.walletAddress.toLowerCase());
  if (rowIndex === -1) return false;
  const rowNumber = rowIndex + 3; // +3 because of header rows and 1-based indexing
  const updateRange = getRange(rowNumber);
  const values = [
    [
      // A: Name
      data.name,
      // B: Email (normalized)
      data.email,
      // C: Wallet address
      data.walletAddress,
      // D: Handle
      data.handle,
      // E: Role
      data.role,
      // F: Hardware
      data.hardware.join(', '),
      // G: OS
      data.os,
      // H: Goal
      data.goal,
      // I: Application date
      data.applicationDate.toISOString(),
      // J: Claim date
      data.claimDate ? data.claimDate.toISOString() : '',
      // K: Status
      data.status,
      // L: Amount
      data.amount,
      // M: Raw amount
      data.rawAmount,
      // N: Nonce
      data.nonce,
      // O: Signed faucet message
      data.signedFaucetMessage,
      // P: Transaction hash
      data.txHash,
      // Q: OTP
      data.otp,
      // R: OTP expiry date
      data.otpExpires,
      // S: OTP attempts
      data.otpAttempts ?? 0,
      // T: OTP last resent
      data.otpLastResent ?? '',
    ],
  ];
  await service.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: updateRange,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return true;
}
