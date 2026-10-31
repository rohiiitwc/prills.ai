// Official Quotex Platform Asset Configuration, Payouts, and Base Prices
// Calibrated directly to live Quotex Web Trading Platform (https://quotex.com/en/trade and https://quotex.com/en/demo-trade)

export interface QuotexAssetConfig {
  symbol: string;
  name: string;
  category: 'OTC' | 'LIVE';
  payout: number;       // Exact Quotex 1-minute payout percentage
  change24h: string;    // Quotex 24h ticker change
  basePrice: number;    // Quotex live price scale anchor
  digits: number;       // Price decimal precision on Quotex
}

export const QUOTEX_ASSETS_MAP: Record<string, QuotexAssetConfig> = {
  // =========================================================================
  // 1. QUOTEX 24/7 OTC CURRENCY PAIRS (Have OTC on Quotex)
  // Calibrated to exact Quotex OTC terminal quotes (e.g. USD/INR OTC @ 105.0778)
  // =========================================================================
  'USDINR-OTC': {
    symbol: 'USDINR-OTC',
    name: 'USD/INR (Quotex OTC)',
    category: 'OTC',
    payout: 79,
    change24h: '+0.03%',
    basePrice: 105.0778,
    digits: 4
  },
  'USDPKR-OTC': {
    symbol: 'USDPKR-OTC',
    name: 'USD/PKR (Quotex OTC)',
    category: 'OTC',
    payout: 92,
    change24h: '+0.03%',
    basePrice: 278.4000,
    digits: 4
  },
  'USDBRL-OTC': {
    symbol: 'USDBRL-OTC',
    name: 'USD/BRL (Quotex OTC)',
    category: 'OTC',
    payout: 91,
    change24h: '-3.40%',
    basePrice: 5.4420,
    digits: 4
  },
  'USDZAR-OTC': {
    symbol: 'USDZAR-OTC',
    name: 'USD/ZAR (Quotex OTC)',
    category: 'OTC',
    payout: 90,
    change24h: '-0.15%',
    basePrice: 16.7220,
    digits: 4
  },
  'NZDCHF-OTC': {
    symbol: 'NZDCHF-OTC',
    name: 'NZD/CHF (Quotex OTC)',
    category: 'OTC',
    payout: 88,
    change24h: '+2.57%',
    basePrice: 0.46410,
    digits: 5
  },
  'USDMXN-OTC': {
    symbol: 'USDMXN-OTC',
    name: 'USD/MXN (Quotex OTC)',
    category: 'OTC',
    payout: 87,
    change24h: '-0.09%',
    basePrice: 18.7880,
    digits: 4
  },
  'USDBDT-OTC': {
    symbol: 'USDBDT-OTC',
    name: 'USD/BDT (Quotex OTC)',
    category: 'OTC',
    payout: 85,
    change24h: '+0.01%',
    basePrice: 120.500,
    digits: 3
  },
  'USDEGP-OTC': {
    symbol: 'USDEGP-OTC',
    name: 'USD/EGP (Quotex OTC)',
    category: 'OTC',
    payout: 85,
    change24h: '+0.02%',
    basePrice: 48.900,
    digits: 3
  },
  'USDTRY-OTC': {
    symbol: 'USDTRY-OTC',
    name: 'USD/TRY (Quotex OTC)',
    category: 'OTC',
    payout: 82,
    change24h: '-0.14%',
    basePrice: 49.940,
    digits: 3
  },
  'USDARS-OTC': {
    symbol: 'USDARS-OTC',
    name: 'USD/ARS (Quotex OTC)',
    category: 'OTC',
    payout: 80,
    change24h: '+0.00%',
    basePrice: 995.000,
    digits: 3
  },
  'USDCOP-OTC': {
    symbol: 'USDCOP-OTC',
    name: 'USD/COP (Quotex OTC)',
    category: 'OTC',
    payout: 80,
    change24h: '+0.01%',
    basePrice: 4420.00,
    digits: 2
  },
  'USDIDR-OTC': {
    symbol: 'USDIDR-OTC',
    name: 'USD/IDR (Quotex OTC)',
    category: 'OTC',
    payout: 82,
    change24h: '-0.05%',
    basePrice: 15720.0,
    digits: 1
  },
  'USDPHP-OTC': {
    symbol: 'USDPHP-OTC',
    name: 'USD/PHP (Quotex OTC)',
    category: 'OTC',
    payout: 82,
    change24h: '+0.03%',
    basePrice: 58.200,
    digits: 3
  },
  'USDDZD-OTC': {
    symbol: 'USDDZD-OTC',
    name: 'USD/DZD (Quotex OTC)',
    category: 'OTC',
    payout: 80,
    change24h: '+0.00%',
    basePrice: 133.500,
    digits: 3
  },
  'USDNGN-OTC': {
    symbol: 'USDNGN-OTC',
    name: 'USD/NGN (Quotex OTC)',
    category: 'OTC',
    payout: 80,
    change24h: '+0.02%',
    basePrice: 1650.00,
    digits: 2
  },

  // =========================================================================
  // 2. QUOTEX LIVE MARKET PAIRS (Pairs that DO NOT have OTC on Quotex)
  // Calibrated to live spot market & Quotex payout table
  // =========================================================================
  'USDJPY': {
    symbol: 'USDJPY',
    name: 'USD/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 91,
    change24h: '-0.21%',
    basePrice: 157.420,
    digits: 3
  },
  'EURJPY': {
    symbol: 'EURJPY',
    name: 'EUR/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 88,
    change24h: '-0.21%',
    basePrice: 175.650,
    digits: 3
  },
  'AUDJPY': {
    symbol: 'AUDJPY',
    name: 'AUD/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 87,
    change24h: '-0.23%',
    basePrice: 110.690,
    digits: 3
  },
  'EURUSD': {
    symbol: 'EURUSD',
    name: 'EUR/USD (Spot Forex)',
    category: 'LIVE',
    payout: 87,
    change24h: '+0.05%',
    basePrice: 1.11610,
    digits: 5
  },
  'GBPUSD': {
    symbol: 'GBPUSD',
    name: 'GBP/USD (Spot Forex)',
    category: 'LIVE',
    payout: 87,
    change24h: '-0.08%',
    basePrice: 1.33910,
    digits: 5
  },
  'GBPJPY': {
    symbol: 'GBPJPY',
    name: 'GBP/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 87,
    change24h: '-0.25%',
    basePrice: 210.800,
    digits: 3
  },
  'AUDUSD': {
    symbol: 'AUDUSD',
    name: 'AUD/USD (Spot Forex)',
    category: 'LIVE',
    payout: 85,
    change24h: '-0.02%',
    basePrice: 0.70340,
    digits: 5
  },
  'EURGBP': {
    symbol: 'EURGBP',
    name: 'EUR/GBP (Spot Forex)',
    category: 'LIVE',
    payout: 85,
    change24h: '+0.02%',
    basePrice: 0.83320,
    digits: 5
  },
  'USDCHF': {
    symbol: 'USDCHF',
    name: 'USD/CHF (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '+0.04%',
    basePrice: 0.82390,
    digits: 5
  },
  'USDCAD': {
    symbol: 'USDCAD',
    name: 'USD/CAD (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '+0.01%',
    basePrice: 1.39570,
    digits: 5
  },
  'NZDUSD': {
    symbol: 'NZDUSD',
    name: 'NZD/USD (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '-0.06%',
    basePrice: 0.56350,
    digits: 5
  },
  'AUDCAD': {
    symbol: 'AUDCAD',
    name: 'AUD/CAD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.12%',
    basePrice: 0.98130,
    digits: 5
  },
  'CADJPY': {
    symbol: 'CADJPY',
    name: 'CAD/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '-0.15%',
    basePrice: 112.790,
    digits: 3
  },
  'CHFJPY': {
    symbol: 'CHFJPY',
    name: 'CHF/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '-0.10%',
    basePrice: 191.070,
    digits: 3
  },
  'NZDJPY': {
    symbol: 'NZDJPY',
    name: 'NZD/JPY (Spot Forex)',
    category: 'LIVE',
    payout: 82,
    change24h: '-0.18%',
    basePrice: 88.680,
    digits: 3
  },
  'EURAUD': {
    symbol: 'EURAUD',
    name: 'EUR/AUD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.07%',
    basePrice: 1.58670,
    digits: 5
  },
  'EURCHF': {
    symbol: 'EURCHF',
    name: 'EUR/CHF (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.01%',
    basePrice: 0.91920,
    digits: 5
  },
  'EURNZD': {
    symbol: 'EURNZD',
    name: 'EUR/NZD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.11%',
    basePrice: 1.98030,
    digits: 5
  },
  'EURCAD': {
    symbol: 'EURCAD',
    name: 'EUR/CAD (Spot Forex)',
    category: 'LIVE',
    payout: 76,
    change24h: '-0.18%',
    basePrice: 1.55720,
    digits: 5
  },
  'GBPAUD': {
    symbol: 'GBPAUD',
    name: 'GBP/AUD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '-0.05%',
    basePrice: 1.90430,
    digits: 5
  },
  'GBPCAD': {
    symbol: 'GBPCAD',
    name: 'GBP/CAD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '-0.12%',
    basePrice: 1.86880,
    digits: 5
  },
  'GBPCHF': {
    symbol: 'GBPCHF',
    name: 'GBP/CHF (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.03%',
    basePrice: 1.10320,
    digits: 5
  },
  'GBPNZD': {
    symbol: 'GBPNZD',
    name: 'GBP/NZD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '-0.02%',
    basePrice: 2.37670,
    digits: 5
  },
  'AUDCHF': {
    symbol: 'AUDCHF',
    name: 'AUD/CHF (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.02%',
    basePrice: 0.57930,
    digits: 5
  },
  'AUDNZD': {
    symbol: 'AUDNZD',
    name: 'AUD/NZD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.05%',
    basePrice: 1.24800,
    digits: 5
  },
  'CADCHF': {
    symbol: 'CADCHF',
    name: 'CAD/CHF (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '+0.01%',
    basePrice: 0.59030,
    digits: 5
  },
  'NZDCAD': {
    symbol: 'NZDCAD',
    name: 'NZD/CAD (Spot Forex)',
    category: 'LIVE',
    payout: 80,
    change24h: '-0.04%',
    basePrice: 0.78620,
    digits: 5
  }
};

export const QUOTEX_OTC_LIST = Object.values(QUOTEX_ASSETS_MAP).filter(a => a.category === 'OTC');
export const QUOTEX_LIVE_LIST = Object.values(QUOTEX_ASSETS_MAP).filter(a => a.category === 'LIVE');

export function cleanAssetSymbol(asset: string): string {
  return (asset || '').trim().toUpperCase().replace('/', '').replace(/\s+/g, '');
}

export function getQuotexConfig(asset: string): QuotexAssetConfig {
  const clean = cleanAssetSymbol(asset);
  if (QUOTEX_ASSETS_MAP[clean]) return QUOTEX_ASSETS_MAP[clean];
  if (QUOTEX_ASSETS_MAP[`${clean}-OTC`]) return QUOTEX_ASSETS_MAP[`${clean}-OTC`];
  const withoutOtc = clean.replace('-OTC', '');
  if (QUOTEX_ASSETS_MAP[withoutOtc]) return QUOTEX_ASSETS_MAP[withoutOtc];

  // Intelligent fallback by currency detection
  if (clean.includes('INR')) return QUOTEX_ASSETS_MAP['USDINR-OTC'];
  if (clean.includes('PKR')) return QUOTEX_ASSETS_MAP['USDPKR-OTC'];
  if (clean.includes('BRL')) return QUOTEX_ASSETS_MAP['USDBRL-OTC'];
  if (clean.includes('ZAR')) return QUOTEX_ASSETS_MAP['USDZAR-OTC'];
  if (clean.includes('NZDCHF')) return QUOTEX_ASSETS_MAP['NZDCHF-OTC'];
  if (clean.includes('MXN')) return QUOTEX_ASSETS_MAP['USDMXN-OTC'];
  if (clean.includes('EURCAD')) return QUOTEX_ASSETS_MAP['EURCAD'];
  if (clean.includes('AUDCAD')) return QUOTEX_ASSETS_MAP['AUDCAD'];
  if (clean.includes('AUDUSD')) return QUOTEX_ASSETS_MAP['AUDUSD'];
  if (clean.includes('AUDJPY')) return QUOTEX_ASSETS_MAP['AUDJPY'];
  if (clean.includes('EURJPY')) return QUOTEX_ASSETS_MAP['EURJPY'];
  if (clean.includes('USDJPY')) return QUOTEX_ASSETS_MAP['USDJPY'];

  return {
    symbol: clean,
    name: `${clean} (Quotex)`,
    category: clean.includes('OTC') ? 'OTC' : 'LIVE',
    payout: 85,
    change24h: '+0.00%',
    basePrice: 1.11610,
    digits: 5
  };
}

export function getQuotexPayout(asset: string): number {
  return getQuotexConfig(asset).payout;
}

export function getQuotexBasePrice(asset: string): number {
  return getQuotexConfig(asset).basePrice;
}

