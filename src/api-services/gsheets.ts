import { GrantDetails, GrantStatus, GrantWithStatus } from '@/types/grant';
import { google } from 'googleapis';

/**
 * Sheet format
 *
 * Columns:
 * A: Name
 * B: Email
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
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.GRANT_GSHEETS_SPREADSHEET_ID;

function getRange(row?: number) {
  if (row || row === 0) {
    return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A${row}:P${row}`;
  }
  return `${process.env.GRANT_GSHEETS_SHEET_NAME}!A3:P`;
}

async function getSheetsService() {
  const auth = new google.auth.JWT({
    email: process.env.GRANT_GSHEETS_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GRANT_GSHEETS_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function findGrantInSheet(email: string): Promise<GrantWithStatus | null> {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;
  const rowIndex = rows.findIndex((row) => row[1] === email);
  if (rowIndex === -1) return null;
  const row = rows[rowIndex];
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
  };
}

export async function insertGrantInSheet(data: GrantDetails) {
  const service = await getSheetsService();
  const values = [
    [
      // A: Name
      data.name,
      // B: Email
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
      GrantStatus.EMAIL_VERIFIED,
    ],
  ];
  await service.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function updateGrantInSheet(data: GrantWithStatus) {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: getRange(),
  });
  const rows = response.data.values;
  if (!rows) return;
  const rowIndex = rows.findIndex((row) => row[1] === data.email);
  if (rowIndex === -1) return;
  const rowNumber = rowIndex + 3; // +3 because of header rows and 1-based indexing
  const updateRange = getRange(rowNumber);
  const values = [
    [
      // A: Name
      data.name,
      // B: Email
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
    ],
  ];
  await service.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: updateRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
