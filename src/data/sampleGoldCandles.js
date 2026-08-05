/**
 * Sample XAU/USD Historical OHLC Dataset for CRT Backtest (v1)
 * Covers recent Gold market structure & consolidation range (~$2,710 - $2,780).
 */

export const SAMPLE_GOLD_4H_CANDLES = [
  { time: '2026-08-01T00:00:00Z', open: 2720.50, high: 2735.00, low: 2715.00, close: 2730.00 },
  { time: '2026-08-01T04:00:00Z', open: 2730.00, high: 2742.00, low: 2725.00, close: 2740.20 },
  { time: '2026-08-01T08:00:00Z', open: 2740.20, high: 2748.50, low: 2732.00, close: 2745.00 }, // Ref candle
  { time: '2026-08-01T12:00:00Z', open: 2745.00, high: 2752.00, low: 2728.00, close: 2736.00 }, // Bearish sweep of 2748.50 -> closes 2736
  { time: '2026-08-01T16:00:00Z', open: 2736.00, high: 2740.00, low: 2720.00, close: 2725.50 }, // Follow-through down (win)
  { time: '2026-08-02T00:00:00Z', open: 2725.50, high: 2735.00, low: 2718.00, close: 2732.00 },
  { time: '2026-08-02T04:00:00Z', open: 2732.00, high: 2745.00, low: 2726.00, close: 2742.00 },
  { time: '2026-08-02T08:00:00Z', open: 2742.00, high: 2755.00, low: 2738.00, close: 2750.00 }, // Ref candle
  { time: '2026-08-02T12:00:00Z', open: 2750.00, high: 2758.00, low: 2734.00, close: 2744.00 }, // Bearish sweep
  { time: '2026-08-02T16:00:00Z', open: 2744.00, high: 2748.00, low: 2730.00, close: 2732.00 }, // Win
  { time: '2026-08-03T00:00:00Z', open: 2732.00, high: 2740.00, low: 2725.00, close: 2728.00 }, // Ref candle
  { time: '2026-08-03T04:00:00Z', open: 2728.00, high: 2738.00, low: 2722.00, close: 2735.00 }, // Bullish sweep of 2725 -> closes 2735
  { time: '2026-08-03T08:00:00Z', open: 2735.00, high: 2752.00, low: 2732.00, close: 2748.00 }, // Win to prior high
  { time: '2026-08-03T12:00:00Z', open: 2748.00, high: 2762.00, low: 2745.00, close: 2758.00 },
  { time: '2026-08-03T16:00:00Z', open: 2758.00, high: 2765.00, low: 2750.00, close: 2752.00 },
  { time: '2026-08-04T00:00:00Z', open: 2752.00, high: 2760.00, low: 2742.00, close: 2746.00 },
  { time: '2026-08-04T04:00:00Z', open: 2746.00, high: 2755.00, low: 2738.00, close: 2750.00 },
  { time: '2026-08-04T08:00:00Z', open: 2750.00, high: 2768.00, low: 2748.00, close: 2765.00 },
  { time: '2026-08-04T12:00:00Z', open: 2765.00, high: 2774.00, low: 2760.00, close: 2770.00 },
  { time: '2026-08-04T16:00:00Z', open: 2770.00, high: 2780.00, low: 2762.00, close: 2764.00 }, // Ref candle
  { time: '2026-08-05T00:00:00Z', open: 2764.00, high: 2782.00, low: 2755.00, close: 2758.00 }, // Bearish sweep
  { time: '2026-08-05T04:00:00Z', open: 2758.00, high: 2762.00, low: 2740.00, close: 2745.00 }, // Win
  { time: '2026-08-05T08:00:00Z', open: 2745.00, high: 2752.00, low: 2735.00, close: 2748.00 },
  { time: '2026-08-05T12:00:00Z', open: 2748.00, high: 2760.00, low: 2742.00, close: 2756.00 },
];
