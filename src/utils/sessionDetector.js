/**
 * Detects active Forex/Gold market session based on current UTC time & day of week
 * and calculates remaining time in the current session.
 */
export function getCurrentGoldSession(date = new Date(), marketSource = 'oanda') {
  if (marketSource === 'okx-crypto') {
    return { name: '24/7 Crypto Market', color: '#3FA88C', status: 'active', timeLeft: 'Trading 24/7' };
  }

  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Helper to format remaining minutes to 'Xh Ym left'
  const formatTimeLeft = (endHour) => {
    const endMinutes = endHour * 60;
    const diff = endMinutes - timeInMinutes;
    if (diff <= 0) return 'closing soon';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m left`;
  };

  // Weekend Close: Friday 21:00 UTC to Sunday 21:00 UTC
  if (day === 6 || (day === 0 && timeInMinutes < 21 * 60) || (day === 5 && timeInMinutes >= 21 * 60)) {
    return { name: 'Weekend Closed', color: '#8B8D91', status: 'closed', timeLeft: 'Markets Closed' };
  }

  // London / NY Overlap: 13:00 to 16:00 UTC
  if (timeInMinutes >= 13 * 60 && timeInMinutes < 16 * 60) {
    return { name: 'London / NY Overlap', color: '#C9A227', status: 'high_volatility', timeLeft: formatTimeLeft(16) };
  }

  // London Session: 08:00 to 16:00 UTC
  if (timeInMinutes >= 8 * 60 && timeInMinutes < 16 * 60) {
    return { name: 'London session', color: '#3FA88C', status: 'active', timeLeft: formatTimeLeft(16) };
  }

  // New York Session: 13:00 to 21:00 UTC
  if (timeInMinutes >= 13 * 60 && timeInMinutes < 21 * 60) {
    return { name: 'New York session', color: '#3FA88C', status: 'active', timeLeft: formatTimeLeft(21) };
  }

  // Asian Session: 00:00 to 08:00 UTC
  if (timeInMinutes >= 0 && timeInMinutes < 8 * 60) {
    return { name: 'Asian session', color: '#7E99A3', status: 'active', timeLeft: formatTimeLeft(8) };
  }

  // Sydney / Asian Open: 21:00 to 24:00 UTC
  return { name: 'Sydney / Asian Open', color: '#7E99A3', status: 'active', timeLeft: formatTimeLeft(24) };
}
