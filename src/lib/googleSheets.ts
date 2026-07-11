import { UserProfile, BodyMetricEntry, CalorieEntry } from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Default spreadsheet ID provided by user
export const DEFAULT_SPREADSHEET_ID = '1Jvd4jMz-Ob5BNVDgAWzHbutybKKWF8YIw4I9Kqj-G3g';
// Default Google Drive backup folder
export const DEFAULT_DRIVE_FOLDER_ID = '1lB4AeOSoRU0FW7OjBb3lFANWEJ-f2ChQ';

// Helper to execute Google API fetch
async function googleFetch(url: string, options: RequestInit, accessToken: string) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Google API Error: ${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error && parsed.error.message) {
        errMsg = parsed.error.message;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }
  return response.json();
}

/**
 * Check if the spreadsheet has required worksheets, and create them if missing.
 */
export async function initializeSpreadsheet(spreadsheetId: string, accessToken: string): Promise<boolean> {
  try {
    const spreadsheet = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}`, { method: 'GET' }, accessToken);
    const existingSheets = spreadsheet.sheets.map((s: any) => s.properties.title);
    
    const requiredSheets = ['Users', 'BodyMetrics_Log', 'Calories_Log'];
    const missingSheets = requiredSheets.filter(s => !existingSheets.includes(s));
    
    if (missingSheets.length > 0) {
      const requests = missingSheets.map(title => ({
        addSheet: {
          properties: { title }
        }
      }));
      
      await googleFetch(
        `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests })
        },
        accessToken
      );
    }
    
    // Now initialize headers for each sheet if they are empty
    await initializeHeaders(spreadsheetId, accessToken);
    return true;
  } catch (error) {
    console.error('Initialize spreadsheet failed:', error);
    throw error;
  }
}

/**
 * Initialize column headers for worksheets if they are empty.
 */
async function initializeHeaders(spreadsheetId: string, accessToken: string) {
  const checkHeaders = async (sheetName: string, expectedHeaders: string[]) => {
    try {
      const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}!A1:Z1`, { method: 'GET' }, accessToken);
      if (!data.values || data.values.length === 0 || data.values[0].length === 0) {
        // Sheet is empty, write headers
        await googleFetch(
          `${SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}!A1:1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              range: `${sheetName}!A1:1`,
              majorDimension: 'ROWS',
              values: [expectedHeaders]
            })
          },
          accessToken
        );
      }
    } catch (e) {
      console.warn(`Could not check/set headers for sheet ${sheetName}:`, e);
    }
  };

  await checkHeaders('Users', ['User_ID', 'Gender', 'Age', 'Height_cm', 'Activity_Level']);
  await checkHeaders('BodyMetrics_Log', ['Date', 'Weight_kg', 'BP_Systolic', 'BP_Diastolic', 'HeartRate_bpm', 'Waist_cm', 'BodyFat_pct', 'Muscle_pct', 'Calculated_BMI']);
  await checkHeaders('Calories_Log', ['Record_ID', 'Date', 'Timestamp', 'Type', 'Item_Name', 'Calories']);
}

/**
 * Create a brand new Google Spreadsheet in user's drive and set up tabs.
 */
export async function createNewSpreadsheet(accessToken: string): Promise<string> {
  try {
    const body = {
      properties: {
        title: '身體素質與卡路里紀錄資料庫'
      },
      sheets: [
        { properties: { title: 'Users' } },
        { properties: { title: 'BodyMetrics_Log' } },
        { properties: { title: 'Calories_Log' } }
      ]
    };
    
    const res = await googleFetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, accessToken);
    
    const spreadsheetId = res.spreadsheetId;
    await initializeHeaders(spreadsheetId, accessToken);
    return spreadsheetId;
  } catch (error) {
    console.error('Create new spreadsheet failed:', error);
    throw error;
  }
}

/**
 * Users Worksheet Actions
 */
export async function fetchUserProfile(spreadsheetId: string, accessToken: string): Promise<UserProfile | null> {
  try {
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Users!A2:E`, { method: 'GET' }, accessToken);
    if (!data.values || data.values.length === 0) {
      return null;
    }
    
    // We assume row 2 is User01's data (the primary user)
    const row = data.values[0];
    return {
      User_ID: row[0] || 'User01',
      Gender: (row[1] === 'Female' ? 'Female' : 'Male'),
      Age: Number(row[2]) || 30,
      Height_cm: Number(row[3]) || 170,
      Activity_Level: Number(row[4]) || 1.2
    };
  } catch (error) {
    console.error('Fetch user profile failed:', error);
    return null;
  }
}

export async function saveUserProfile(spreadsheetId: string, profile: UserProfile, accessToken: string): Promise<void> {
  try {
    // Check if any profile exists
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Users!A2:E2`, { method: 'GET' }, accessToken);
    const exists = data.values && data.values.length > 0;
    
    const values = [[
      profile.User_ID || 'User01',
      profile.Gender,
      profile.Age,
      profile.Height_cm,
      profile.Activity_Level
    ]];
    
    if (exists) {
      // Overwrite the existing row
      await googleFetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/Users!A2:E2?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            range: 'Users!A2:E2',
            majorDimension: 'ROWS',
            values
          })
        },
        accessToken
      );
    } else {
      // Append a new row
      await googleFetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/Users!A:E:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            range: 'Users!A:E',
            majorDimension: 'ROWS',
            values
          })
        },
        accessToken
      );
    }
  } catch (error) {
    console.error('Save user profile failed:', error);
    throw error;
  }
}

/**
 * BodyMetrics_Log Worksheet Actions
 */
export async function fetchBodyMetrics(spreadsheetId: string, accessToken: string): Promise<BodyMetricEntry[]> {
  try {
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/BodyMetrics_Log!A2:I`, { method: 'GET' }, accessToken);
    if (!data.values) return [];
    
    return data.values.map((row: any) => ({
      Date: row[0],
      Weight_kg: Number(row[1]) || 0,
      BP_Systolic: row[2] ? Number(row[2]) : undefined,
      BP_Diastolic: row[3] ? Number(row[3]) : undefined,
      HeartRate_bpm: row[4] ? Number(row[4]) : undefined,
      Waist_cm: row[5] ? Number(row[5]) : undefined,
      BodyFat_pct: row[6] ? Number(row[6]) : undefined,
      Muscle_pct: row[7] ? Number(row[7]) : undefined,
      Calculated_BMI: Number(row[8]) || 0
    })).sort((a: any, b: any) => a.Date.localeCompare(b.Date));
  } catch (error) {
    console.error('Fetch body metrics failed:', error);
    return [];
  }
}

/**
 * Upsert Body Metric log. Overwrites if identical Date is found.
 */
export async function upsertBodyMetric(spreadsheetId: string, entry: BodyMetricEntry, accessToken: string): Promise<void> {
  try {
    // 1. Fetch all existing entries to check for matching Date
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/BodyMetrics_Log!A1:A`, { method: 'GET' }, accessToken);
    const existingDates = data.values ? data.values.map((row: any) => row[0]) : [];
    
    const rowIndex = existingDates.indexOf(entry.Date); // 0-indexed index. Sheet row is rowIndex + 1.
    
    const rowValues = [
      entry.Date,
      entry.Weight_kg,
      entry.BP_Systolic !== undefined ? entry.BP_Systolic : '',
      entry.BP_Diastolic !== undefined ? entry.BP_Diastolic : '',
      entry.HeartRate_bpm !== undefined ? entry.HeartRate_bpm : '',
      entry.Waist_cm !== undefined ? entry.Waist_cm : '',
      entry.BodyFat_pct !== undefined ? entry.BodyFat_pct : '',
      entry.Muscle_pct !== undefined ? entry.Muscle_pct : '',
      entry.Calculated_BMI
    ];

    if (rowIndex !== -1) {
      // Overwrite the existing row (convert 0-indexed array to 1-indexed sheet row)
      const sheetRow = rowIndex + 1;
      await googleFetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/BodyMetrics_Log!A${sheetRow}:I${sheetRow}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            range: `BodyMetrics_Log!A${sheetRow}:I${sheetRow}`,
            majorDimension: 'ROWS',
            values: [rowValues]
          })
        },
        accessToken
      );
    } else {
      // Append a new row
      await googleFetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/BodyMetrics_Log!A:I:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            range: 'BodyMetrics_Log!A:I',
            majorDimension: 'ROWS',
            values: [rowValues]
          })
        },
        accessToken
      );
    }
  } catch (error) {
    console.error('Upsert body metric failed:', error);
    throw error;
  }
}

/**
 * Calories_Log Worksheet Actions
 */
export async function fetchCalorieLogs(spreadsheetId: string, accessToken: string): Promise<CalorieEntry[]> {
  try {
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Calories_Log!A2:F`, { method: 'GET' }, accessToken);
    if (!data.values) return [];
    
    return data.values.map((row: any) => ({
      Record_ID: row[0],
      Date: row[1],
      Timestamp: row[2],
      Type: row[3] === 'Burn' ? 'Burn' : 'Intake',
      Item_Name: row[4] || '',
      Calories: Number(row[5]) || 0
    })).sort((a: any, b: any) => b.Timestamp.localeCompare(a.Timestamp)); // Newest first
  } catch (error) {
    console.error('Fetch calorie logs failed:', error);
    return [];
  }
}

export async function addCalorieLog(spreadsheetId: string, entry: CalorieEntry, accessToken: string): Promise<void> {
  try {
    const rowValues = [
      entry.Record_ID,
      entry.Date,
      entry.Timestamp,
      entry.Type,
      entry.Item_Name,
      entry.Calories
    ];
    
    await googleFetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Calories_Log!A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: 'Calories_Log!A:F',
          majorDimension: 'ROWS',
          values: [rowValues]
        })
      },
      accessToken
    );
  } catch (error) {
    console.error('Add calorie log failed:', error);
    throw error;
  }
}

/**
 * Delete a calorie entry by matching Record_ID.
 * It downloads all calorie logs, filters the one with matching Record_ID, and overwrites Calories_Log.
 */
export async function deleteCalorieLog(spreadsheetId: string, recordId: string, accessToken: string): Promise<void> {
  try {
    // 1. Fetch all rows
    const data = await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Calories_Log!A1:F`, { method: 'GET' }, accessToken);
    if (!data.values || data.values.length <= 1) return;
    
    const headers = data.values[0];
    const originalRows = data.values.slice(1);
    
    const filteredRows = originalRows.filter(row => row[0] !== recordId);
    
    if (originalRows.length === filteredRows.length) {
      console.warn('Record not found, nothing deleted.');
      return;
    }
    
    // Clear whole Calories_Log sheet values first so we don't leave trailing rows
    await googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Calories_Log!A1:Z10000:clear`, { method: 'POST' }, accessToken);
    
    // Rewrite headers + remaining rows
    const newValues = [headers, ...filteredRows];
    await googleFetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Calories_Log!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: 'Calories_Log!A1',
          majorDimension: 'ROWS',
          values: newValues
        })
      },
      accessToken
    );
  } catch (error) {
    console.error('Delete calorie log failed:', error);
    throw error;
  }
}

/**
 * Drive File backup. Writes current state to Google Drive folder in JSON format.
 */
export async function backupDataToDrive(
  folderId: string,
  data: { profile: UserProfile | null; metrics: BodyMetricEntry[]; calories: CalorieEntry[] },
  accessToken: string
): Promise<string> {
  try {
    const filename = `BodyMetrics_Backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
    const fileContent = JSON.stringify(data, null, 2);
    
    // Standard Drive Multipart upload:
    // First, metadata
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId]
    };
    
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;
      
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const headers = {
      'Content-Type': `multipart/related; boundary=${boundary}`
    };
    
    const result = await googleFetch(url, {
      method: 'POST',
      headers,
      body
    }, accessToken);
    
    return result.id;
  } catch (error) {
    console.error('Backup data to Drive failed:', error);
    throw error;
  }
}
