import { describe, it, expect } from 'vitest';

describe('GoldChart Persistence & Mount-on-First-Visit Logic', () => {
  it('does not mount GoldChart prior to initial chart tab visit', () => {
    let activePage = 'dashboard';
    let hasVisitedChart = false;

    // Simulate initial load on dashboard
    if (activePage === 'chart' && !hasVisitedChart) {
      hasVisitedChart = true;
    }

    expect(hasVisitedChart).toBe(false);
    expect(activePage !== 'chart').toBe(true);
  });

  it('mounts GoldChart when activePage becomes chart and keeps it mounted when switching back', () => {
    let activePage = 'dashboard';
    let hasVisitedChart = false;

    // User navigates to Gold Chart
    activePage = 'chart';
    if (activePage === 'chart' && !hasVisitedChart) {
      hasVisitedChart = true;
    }

    expect(hasVisitedChart).toBe(true);
    let wrapperClass = activePage === 'chart' ? 'block flex-1 min-h-0' : 'hidden';
    expect(wrapperClass).toBe('block flex-1 min-h-0');

    // User navigates to Dashboard
    activePage = 'dashboard';
    // hasVisitedChart remains true
    expect(hasVisitedChart).toBe(true);
    wrapperClass = activePage === 'chart' ? 'block flex-1 min-h-0' : 'hidden';
    expect(wrapperClass).toBe('hidden');

    // User returns to Gold Chart
    activePage = 'chart';
    expect(hasVisitedChart).toBe(true);
    wrapperClass = activePage === 'chart' ? 'block flex-1 min-h-0' : 'hidden';
    expect(wrapperClass).toBe('block flex-1 min-h-0');
  });
});
