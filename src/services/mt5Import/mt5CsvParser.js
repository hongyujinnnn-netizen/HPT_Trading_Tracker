/**
 * MT5 Report File Parser (HTML & CSV)
 * Parses MT5 report files targeting the "Deals" table with encoding detection
 * and locale-aware number parsing.
 */

/**
 * Locale-aware number parser supporting:
 * - 1 234.56 (space thousands, dot decimal)
 * - 1,234.56 (comma thousands, dot decimal)
 * - 1234,56 (comma decimal)
 * - 1.234,56 (dot thousands, comma decimal)
 */
export function parseLocaleNumber(raw) {
  if (raw === null || raw === undefined) return 0;
  let str = String(raw).trim();
  if (!str || str === '-' || str === 'n/a') return 0;

  // Remove non-breaking spaces and regular spaces
  str = str.replace(/[\s\xA0]/g, '');

  // Handle European format: 1.234,56 or 1234,56
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // 1.234,56 -> remove dot, replace comma with dot
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> remove comma
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // 1234,56 -> 1234.56
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Detects text encoding from array buffer / string
 */
export function detectEncoding(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  // UTF-16 LE BOM
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  // UTF-16 BE BOM
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';

  // Decode a sample to check for html tags or valid utf8
  try {
    const textDecoder = new TextDecoder('utf-8', { fatal: true });
    textDecoder.decode(bytes.subarray(0, 1000));
    return 'utf-8';
  } catch {
    return 'windows-1251'; // Fallback for Cyrillic / Eastern European MT5 terminals
  }
}

/**
 * Parses raw HTML string from MT5 Report into raw Deal rows
 */
export function parseMt5HtmlDeals(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const rawRows = [];
  const tables = doc.querySelectorAll('table');

  let dealsTable = null;

  // Search for the "Deals" section table
  tables.forEach((table) => {
    const text = table.textContent || '';
    if (text.includes('Deals') || (text.includes('Deal') && text.includes('Position'))) {
      dealsTable = table;
    }
  });

  if (!dealsTable && tables.length > 0) {
    dealsTable = tables[0];
  }

  if (!dealsTable) {
    throw new Error('No Deals table found in MT5 HTML report.');
  }

  const rows = dealsTable.querySelectorAll('tr');
  let isDealsSection = false;
  let headers = [];

  rows.forEach((tr) => {
    const text = tr.textContent.trim();
    if (text.toLowerCase() === 'deals' || text.toLowerCase().includes('deals')) {
      isDealsSection = true;
      return;
    }

    const cells = Array.from(tr.querySelectorAll('td, th')).map((c) => c.textContent.trim());
    if (cells.length < 5) return;

    // Detect header row
    if (cells.some((c) => c.toLowerCase() === 'deal' || c.toLowerCase() === 'ticket')) {
      headers = cells.map((c) => c.toLowerCase());
      return;
    }

    if (cells.length >= 6) {
      // Map cells by header position or default column index
      const dealId = cells[0] || '';
      const time = cells[1] || '';
      const type = (cells[2] || '').toLowerCase(); // buy, sell, balance, credit
      const entryType = (cells[3] || '').toLowerCase(); // in, out, in/out
      const volume = cells[4] || '0';
      const price = cells[5] || '0';
      const order = cells[6] || '';
      const stopLoss = cells[7] || '0';
      const takeProfit = cells[8] || '0';
      const positionId = cells[9] || cells[0]; // position ID column or deal ID fallback
      const profit = cells[cells.length - 1] || '0';
      const swap = cells.length >= 12 ? cells[cells.length - 2] : '0';
      const commission = cells.length >= 13 ? cells[cells.length - 3] : '0';
      const symbol = cells.length >= 11 ? cells[3] || cells[2] : '';

      rawRows.push({
        dealId,
        time,
        type,
        entryType,
        volume: parseLocaleNumber(volume),
        price: parseLocaleNumber(price),
        stopLoss: parseLocaleNumber(stopLoss),
        takeProfit: parseLocaleNumber(takeProfit),
        positionId,
        profit: parseLocaleNumber(profit),
        swap: parseLocaleNumber(swap),
        commission: parseLocaleNumber(commission),
        symbol,
        rawCells: cells,
      });
    }
  });

  return rawRows;
}

/**
 * Parses raw CSV string from MT5 Report into raw Deal rows
 */
export function parseMt5CsvDeals(csvText) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rawRows = [];

  if (lines.length < 2) return rawRows;

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(/[\t;,]/).map((h) => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(/[\t;,]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 4) continue;

    const dealId = cells[0] || `csv_${i}`;
    const time = cells[1] || new Date().toISOString();
    const type = (cells[2] || '').toLowerCase();
    const entryType = (cells[3] || '').toLowerCase();

    // Dynamically match columns if headers are present
    const symbolIdx = headers.findIndex((h) => h.includes('symbol'));
    const volumeIdx = headers.findIndex((h) => h.includes('volume') || h.includes('lots'));
    const priceIdx = headers.findIndex((h) => h.includes('price'));
    const positionIdx = headers.findIndex((h) => h.includes('position'));
    const profitIdx = headers.findIndex((h) => h.includes('profit'));
    const swapIdx = headers.findIndex((h) => h.includes('swap'));
    const commissionIdx = headers.findIndex((h) => h.includes('commission') || h.includes('fee'));

    rawRows.push({
      dealId,
      time,
      type,
      entryType,
      symbol: symbolIdx !== -1 ? cells[symbolIdx] : (cells[3] || ''),
      volume: parseLocaleNumber(volumeIdx !== -1 ? cells[volumeIdx] : cells[4]),
      price: parseLocaleNumber(priceIdx !== -1 ? cells[priceIdx] : cells[5]),
      positionId: positionIdx !== -1 ? cells[positionIdx] : dealId,
      profit: parseLocaleNumber(profitIdx !== -1 ? cells[profitIdx] : cells[cells.length - 1]),
      swap: parseLocaleNumber(swapIdx !== -1 ? cells[swapIdx] : 0),
      commission: parseLocaleNumber(commissionIdx !== -1 ? cells[commissionIdx] : 0),
      rawCells: cells,
    });
  }

  return rawRows;
}
