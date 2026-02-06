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
 * J: Redeem date
 * K: Status
 *
 * Row 1: This sheet is auto-generated.
 * Row 2: Headers
 * Rows 3...N: Data
 */

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_GRANT_SPREADSHEET_ID;
const RANGE = `${process.env.GOOGLE_SHEETS_GRANT_SHEET_NAME}!A3:K`;

async function getSheetsService() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function findGrantInSheet(email: string): Promise<GrantWithStatus | null> {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
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
    redeemDate: row[9] ? new Date(row[9]) : null,
    status: row[10] as GrantStatus,
  };
}

export async function insertGrantInSheet(data: GrantDetails) {
  const service = await getSheetsService();
  const values = [
    [
      data.name,
      data.email,
      data.walletAddress,
      data.handle,
      data.role,
      data.hardware.join(', '),
      data.os,
      data.goal,
      new Date().toISOString(),
      '',
      'not-redeemed',
    ],
  ];
  await service.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function updateGrantInSheet(data: GrantWithStatus) {
  const service = await getSheetsService();
  const response = await service.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });
  const rows = response.data.values;
  if (!rows) return;
  const rowIndex = rows.findIndex((row) => row[1] === data.email);
  if (rowIndex === -1) return;
  const rowNumber = rowIndex + 3; // +3 because of header rows and 1-based indexing
  const updateRange = `${process.env.GOOGLE_SHEETS_GRANT_SHEET_NAME}!A${rowNumber}:K${rowNumber}`;
  const values = [
    [
      data.name,
      data.email,
      data.walletAddress,
      data.handle,
      data.role,
      data.hardware.join(', '),
      data.os,
      data.goal,
      data.applicationDate.toISOString(),
      data.redeemDate ? data.redeemDate.toISOString() : '',
      data.status,
    ],
  ];
  await service.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: updateRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
