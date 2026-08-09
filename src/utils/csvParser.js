/**
 * Standard MT4 / MT5 & Custom CSV Parser and Exporter
 * 
 * Supports MT4 export layout:
 * Ticket;Open Time;Type;Size;Item;Price;S/L;T/P;Close Time;Price;Commission;Taxes;Swap;Profit
 * 
 * Supports MT5 export layout:
 * Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price, Commission, Swap, Profit
 */

/**
 * Helper to prevent CSV Formula Injection (=, +, -, @, tab, CR)
 */
function sanitizeCSVField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // If field starts with formula trigger characters, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Parses raw CSV string into canonical Trade objects
 * @param {string} csvText 
 * @returns {import('../types/tradeSchema').Trade[]}
 */
export function parseCSV(csvText) {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Determine delimiter (tab, semicolon, or comma)
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes('\t')) delimiter = '\t';
  else if (headerLine.includes(';')) delimiter = ';';

  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const parsedTrades = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 3) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = row[idx] || '';
    });

    // Detect format type
    const isMT4 = headers.includes('ticket') || headers.includes('open time') || headers.includes('item');
    const isMT5 = headers.includes('position') || headers.includes('volume');

    let side = 'Buy';
    let entryPrice = 0;
    let exitPrice = 0;
    let stopLoss = 0;
    let takeProfit = 0;
    let lotSize = 0.1;
    let pnl = 0;
    let dateStr = new Date().toISOString().split('T')[0];
    let timestamp = new Date().toISOString();
    let ticket = '';

    if (isMT4) {
      ticket = rowObj['ticket'] || '';
      const typeStr = (rowObj['type'] || '').toLowerCase();
      if (typeStr.includes('sell')) side = 'Sell';

      lotSize = parseFloat(rowObj['size'] || rowObj['lots']) || 0.1;
      entryPrice = parseFloat(rowObj['price']) || 0;
      stopLoss = parseFloat(rowObj['s/l'] || rowObj['sl']) || 0;
      takeProfit = parseFloat(rowObj['t/p'] || rowObj['tp']) || 0;

      // In MT4, second 'price' column is close price if available
      const priceKeys = headers.filter((h) => h === 'price');
      if (priceKeys.length > 1) {
        const firstPriceIdx = headers.indexOf('price');
        const secondPriceIdx = headers.indexOf('price', firstPriceIdx + 1);
        exitPrice = parseFloat(row[secondPriceIdx]) || entryPrice;
      } else {
        exitPrice = parseFloat(rowObj['close price'] || rowObj['exit price']) || entryPrice;
      }

      pnl = parseFloat(rowObj['profit']) || 0;
      const rawDate = rowObj['open time'] || rowObj['close time'] || rowObj['time'];
      if (rawDate) {
        // Parse MT4 date format e.g. 2026.07.29 14:30:00 -> 2026-07-29T14:30:00 for cross-browser parsing
        const formatted = rawDate.replace(/\./g, '-').trim().replace(' ', 'T');
        const parsedDate = new Date(formatted);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate.toISOString();
          dateStr = timestamp.split('T')[0];
        }
      }
    } else if (isMT5) {
      ticket = rowObj['position'] || rowObj['ticket'] || '';
      const typeStr = (rowObj['type'] || '').toLowerCase();
      if (typeStr.includes('sell')) side = 'Sell';

      lotSize = parseFloat(rowObj['volume'] || rowObj['size']) || 0.1;
      entryPrice = parseFloat(rowObj['price']) || 0;
      stopLoss = parseFloat(rowObj['s / l'] || rowObj['s/l']) || 0;
      takeProfit = parseFloat(rowObj['t / p'] || rowObj['t/p']) || 0;
      pnl = parseFloat(rowObj['profit']) || 0;

      const rawDate = rowObj['time'];
      if (rawDate) {
        const parsedDate = new Date(rawDate.replace(' ', 'T'));
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate.toISOString();
          dateStr = timestamp.split('T')[0];
        }
      }
    } else {
      // Generic TradePulse CSV format
      side = (rowObj['side'] || rowObj['direction'] || '').toLowerCase().includes('sell') ? 'Sell' : 'Buy';
      entryPrice = parseFloat(rowObj['entry'] || rowObj['entryprice']) || 0;
      exitPrice = parseFloat(rowObj['exit'] || rowObj['exitprice']) || 0;
      stopLoss = parseFloat(rowObj['stoploss'] || rowObj['sl']) || 0;
      takeProfit = parseFloat(rowObj['takeprofit'] || rowObj['tp']) || 0;
      lotSize = parseFloat(rowObj['lot'] || rowObj['lotsize'] || rowObj['size']) || 0.1;
      pnl = parseFloat(rowObj['pnl'] || rowObj['profit']) || 0;
      dateStr = rowObj['date'] || dateStr;
      timestamp = rowObj['timestamp'] || timestamp;
    }

    const rr = calculateRR(side, entryPrice, stopLoss, takeProfit);

    parsedTrades.push(
      createTrade({
        ticket: ticket.replace(/[<>"']/g, ''),
        date: dateStr,
        timestamp,
        side,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        lotSize,
        pnl,
        rr,
        strategy: (rowObj['strategy'] || 'Breakout').replace(/[<>"']/g, ''),
        session: (rowObj['session'] || 'London').replace(/[<>"']/g, ''),
        marketCondition: (rowObj['marketcondition'] || 'Trending').replace(/[<>"']/g, ''),
        emotion: (rowObj['emotion'] || 'Planned').replace(/[<>"']/g, ''),
        notes: (rowObj['notes'] || rowObj['reason'] || '').replace(/[<>"']/g, ''),
      })
    );
  }

  return parsedTrades;
}

/**
 * Exports trades array to clean CSV string format with Formula Injection protection
 * @param {import('../types/tradeSchema').Trade[]} trades 
 * @returns {string} CSV format text
 */
export function exportToCSV(trades = []) {
  if (!trades.length) return '';

  const headers = ['ID', 'Date', 'Timestamp', 'Side', 'Entry', 'Exit', 'StopLoss', 'TakeProfit', 'LotSize', 'PnL', 'RR', 'Strategy', 'Session', 'Emotion', 'Mistakes', 'Notes'];

  const rows = trades.map((t) => [
    sanitizeCSVField(t.id),
    sanitizeCSVField(t.date),
    sanitizeCSVField(t.timestamp),
    sanitizeCSVField(t.side),
    t.entryPrice,
    t.exitPrice,
    t.stopLoss,
    t.takeProfit,
    t.lotSize,
    t.pnl,
    t.rr,
    `"${sanitizeCSVField(t.strategy || '').replace(/"/g, '""')}"`,
    sanitizeCSVField(t.session),
    sanitizeCSVField(t.emotion),
    `"${(t.mistakes || []).map(sanitizeCSVField).join(', ')}"`,
    `"${sanitizeCSVField(t.notes || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

