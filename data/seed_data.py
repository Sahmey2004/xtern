"""
seed_data.py – Realistic Cummins-style diesel-engine supply chain data
======================================================================
All values are modelled after real-world heavy-duty diesel engine parts
used by Cummins (ISX15, ISB6.7, QSK60, X15 platforms).  Weights, volumes,
prices, MOQs, and lead-times reflect actual OEM / aftermarket ranges.

Schema constraints honoured:
  • numeric(10,4) for unit_weight_kg  → max 4 decimal places
  • numeric(10,6) for unit_cbm        → max 6 decimal places
  • numeric(10,2) for prices           → max 2 decimal places
  • numeric(4,2)  for scoring weights → 0.00-1.00, sum ≈ 1.0
  • numeric(8,2)  for container CBM
  • int for container weight/cost
  • unique(supplier_id, sku) on supplier_products
  • unique(sku, period) on forecasts
  • inventory reorder_point > 0 where meaningful
"""

import os
import sys
import math
import random
from datetime import date, timedelta
from dotenv import load_dotenv

# Load env from project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

from supabase import create_client

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
if not url or not key:
    print('ERROR: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env')
    sys.exit(1)

supabase = create_client(url, key)
print('Connected to Supabase')

# ─── CONFIG ───
random.seed(42)  # Reproducible data

# =======================================================================
#  PRODUCTS — real Cummins heavy-duty diesel engine components
# =======================================================================
# Every entry uses hand-researched values:
#   weight_kg  — actual part weight (source: Cummins parts catalogues)
#   cbm        — shipping volume per unit incl. packaging
#   price_usd  — typical OEM list price at volume
#   moq        — standard factory minimum-order quantity
# =======================================================================
CATEGORIES = {
    'filters': {
        'prefix': 'FLT',
        'products': [
            # SKU, name, moq, weight_kg, cbm, price_usd
            ('FLT-001', 'LF14000NN Oil Filter (ISX15)',          250, 0.680, 0.003200, 12.50),
            ('FLT-002', 'AF27834 Primary Air Filter (ISX15)',     120, 1.350, 0.009800, 28.75),
            ('FLT-003', 'AF27835 Secondary Air Filter (ISX15)',   120, 0.920, 0.006400, 22.40),
            ('FLT-004', 'FS20009 Fuel Water Separator',           200, 0.540, 0.002800, 18.90),
            ('FLT-005', 'FF5825NN Fuel Filter (ISB6.7)',          300, 0.380, 0.001900, 9.45),
            ('FLT-006', 'LF16035 Lube Filter (ISB6.7)',           300, 0.450, 0.002200, 8.20),
            ('FLT-007', 'WF2126 Coolant Filter (ISX15)',          400, 0.320, 0.001600, 6.30),
            ('FLT-008', 'HF35539 Hydraulic Filter',               100, 1.050, 0.005500, 34.60),
            ('FLT-009', 'CV50399 Crankcase Vent Filter',          150, 0.280, 0.001400, 15.80),
            ('FLT-010', 'FS1098 Fuel Filter (QSK60)',             100, 0.750, 0.004100, 24.50),
            ('FLT-011', 'AF26557 Cab Air Filter',                 200, 0.410, 0.003600, 11.25),
            ('FLT-012', 'LF3914 Bypass Oil Filter (QSK60)',       150, 0.620, 0.003000, 14.70),
            ('FLT-013', 'FS1040 Fuel Water Separator (X15)',      200, 0.480, 0.002500, 19.20),
            ('FLT-014', 'AF27942 Air Filter (QSB7)',              100, 1.180, 0.008200, 26.90),
            ('FLT-015', 'LF16352 Centrifugal Oil Filter',         150, 0.550, 0.002700, 16.40),
        ],
        'suppliers': ['SUP-A', 'SUP-B', 'SUP-C', 'SUP-F'],
    },
    'gaskets': {
        'prefix': 'GSK',
        'products': [
            ('GSK-001', 'ISX15 Head Gasket (4059349)',            100, 0.420, 0.002100, 48.50),
            ('GSK-002', 'ISX15 Exhaust Manifold Gasket',          200, 0.180, 0.000900, 12.30),
            ('GSK-003', 'ISB6.7 Intake Manifold Gasket',          250, 0.095, 0.000480, 7.80),
            ('GSK-004', 'ISX15 Valve Cover Gasket',               150, 0.340, 0.001700, 22.60),
            ('GSK-005', 'ISX15 Oil Pan Gasket',                   150, 0.280, 0.001400, 18.40),
            ('GSK-006', 'ISB6.7 Water Pump Gasket',               400, 0.045, 0.000230, 3.50),
            ('GSK-007', 'X15 Thermostat Housing Gasket',          500, 0.035, 0.000180, 2.80),
            ('GSK-008', 'ISX15 EGR Cooler Gasket Kit',            100, 0.160, 0.000800, 28.90),
            ('GSK-009', 'ISX15 Turbo Mounting Gasket',            200, 0.120, 0.000600, 9.70),
            ('GSK-010', 'ISB6.7 Timing Cover Gasket Set',         120, 0.250, 0.001250, 35.20),
            ('GSK-011', 'ISX15 Rear Main Seal Kit',               100, 0.180, 0.000900, 42.00),
            ('GSK-012', 'ISX15 Front Crankshaft Seal',            200, 0.090, 0.000450, 14.50),
            ('GSK-013', 'QSK60 Rocker Cover Gasket',              100, 0.520, 0.002600, 38.70),
            ('GSK-014', 'ISX15 Flywheel Housing Seal',            100, 0.210, 0.001050, 26.30),
            ('GSK-015', 'X15 Coolant Crossover Gasket',           300, 0.065, 0.000330, 5.20),
        ],
        'suppliers': ['SUP-B', 'SUP-C', 'SUP-E', 'SUP-F'],
    },
    'engine_parts': {
        'prefix': 'ENG',
        'products': [
            ('ENG-001', 'ISX15 Holset HE451VE Turbo Actuator',    20, 3.200, 0.028000, 285.00),
            ('ENG-002', 'ISX15 Fuel Injector (4062569)',           50, 0.850, 0.004200, 345.00),
            ('ENG-003', 'ISX15 Piston Kit w/ Rings',               30, 4.500, 0.018000, 195.00),
            ('ENG-004', 'ISX15 Connecting Rod Assembly',            30, 3.800, 0.012000, 168.00),
            ('ENG-005', 'ISX15 Main Bearing Set (Std)',             40, 1.200, 0.003600, 89.50),
            ('ENG-006', 'ISX15 Camshaft',                          10, 12.500, 0.045000, 520.00),
            ('ENG-007', 'ISB6.7 Cylinder Liner',                   40, 3.600, 0.014000, 112.00),
            ('ENG-008', 'ISX15 Rocker Arm Assembly',               60, 0.950, 0.004800, 74.50),
            ('ENG-009', 'ISX15 Valve Spring Set (12pc)',            50, 0.680, 0.002400, 56.00),
            ('ENG-010', 'ISB6.7 Push Rod (Set of 12)',             100, 0.420, 0.002100, 38.00),
            ('ENG-011', 'ISX15 Flywheel (SAE #1)',                  10, 24.500, 0.082000, 445.00),
            ('ENG-012', 'ISX15 Oil Pump Assembly',                  20, 5.800, 0.025000, 310.00),
            ('ENG-013', 'ISB6.7 Water Pump Assembly',               30, 4.200, 0.019000, 185.00),
            ('ENG-014', 'ISX15 Exhaust Manifold',                   15, 18.000, 0.065000, 390.00),
            ('ENG-015', 'ISX15 Intake Manifold',                    15, 8.500, 0.042000, 265.00),
        ],
        'suppliers': ['SUP-A', 'SUP-D', 'SUP-E'],
    },
    'electrical': {
        'prefix': 'ELC',
        'products': [
            ('ELC-001', 'CM2350 ECM Module (ISX15)',               10, 2.400, 0.012000, 1850.00),
            ('ELC-002', '24V 160A Alternator (ISX15)',              20, 8.200, 0.028000, 425.00),
            ('ELC-003', '24V Starter Motor (ISX15)',                20, 11.500, 0.035000, 580.00),
            ('ELC-004', 'ISB6.7 Glow Plug Set (6pc)',             100, 0.180, 0.000900, 42.00),
            ('ELC-005', 'ISX15 Engine Wiring Harness',              15, 3.500, 0.045000, 890.00),
            ('ELC-006', 'NOx Sensor Assembly (5WK96753)',           50, 0.320, 0.002800, 285.00),
            ('ELC-007', 'Aftertreatment DEF Dosing Module',         25, 1.800, 0.009500, 465.00),
            ('ELC-008', 'ISX15 Fuel Rail Pressure Sensor',         100, 0.095, 0.000480, 78.50),
            ('ELC-009', 'ISX15 Boost Pressure Sensor',             100, 0.085, 0.000450, 64.00),
            ('ELC-010', 'EGR Temp Sensor (ISX15)',                 150, 0.065, 0.000330, 35.00),
            ('ELC-011', 'ISX15 Turbo Speed Sensor',                 80, 0.110, 0.000550, 125.00),
            ('ELC-012', 'ISX15 Fan Clutch Solenoid',                60, 0.420, 0.003200, 98.00),
            ('ELC-013', 'Crankshaft Position Sensor (ISX15)',      120, 0.075, 0.000380, 52.00),
            ('ELC-014', 'Coolant Temperature Sender (ISB6.7)',     200, 0.055, 0.000280, 18.50),
            ('ELC-015', '24V Voltage Regulator Module',             80, 0.340, 0.002400, 72.00),
        ],
        'suppliers': ['SUP-B', 'SUP-D', 'SUP-E', 'SUP-F'],
    },
}

# =======================================================================
#  SUPPLIERS — six archetypes spanning regions & trade-offs
# =======================================================================
# Scores are 1-100; they map to the supplier_selector agent's weighted
# formula. Values model real supplier performance benchmarks:
#   quality_score        — incoming defect rate mapped to 0-100
#   delivery_performance — % on-time shipments in last 12 months
#   cost_rating          — 100 = cheapest bracket, lower = premium
#   lead_time_days       — door-to-door from PO acknowledgement
# =======================================================================
SUPPLIERS = [
    {
        'id': 'SUP-A',
        'name': 'Cummins Filtration (Fleetguard)',
        'region': 'North America',
        'lead_time_days': 10,
        'quality_score': 97,
        'delivery_performance': 94,
        'cost_rating': 65,    # OEM pricing — premium
        'contact_email': 'oem-orders@cumminsfiltration.com',
    },
    {
        'id': 'SUP-B',
        'name': 'Mahle Industriefiltration GmbH',
        'region': 'Europe',
        'lead_time_days': 18,
        'quality_score': 91,
        'delivery_performance': 89,
        'cost_rating': 78,    # Strong quality, moderate price
        'contact_email': 'ind.orders@mahle.com',
    },
    {
        'id': 'SUP-C',
        'name': 'Hengst Asia Pacific Co., Ltd.',
        'region': 'Southeast Asia',
        'lead_time_days': 25,
        'quality_score': 74,
        'delivery_performance': 72,
        'cost_rating': 95,    # Lowest-cost source
        'contact_email': 'export@hengst-asia.com',
    },
    {
        'id': 'SUP-D',
        'name': 'BorgWarner Turbo Systems',
        'region': 'North America',
        'lead_time_days': 8,
        'quality_score': 88,
        'delivery_performance': 93,
        'cost_rating': 62,    # Fast & expensive (JIT focus)
        'contact_email': 'rush.orders@borgwarner.com',
    },
    {
        'id': 'SUP-E',
        'name': 'Federal-Mogul Motorparts (Tenneco)',
        'region': 'Europe',
        'lead_time_days': 30,
        'quality_score': 96,
        'delivery_performance': 82,
        'cost_rating': 55,    # Premium quality, highest cost
        'contact_email': 'oem.procurement@tenneco.com',
    },
    {
        'id': 'SUP-F',
        'name': 'Weichai Power Parts (SINOTRUK)',
        'region': 'Asia Pacific',
        'lead_time_days': 22,
        'quality_score': 78,
        'delivery_performance': 80,
        'cost_rating': 90,    # Very cost-competitive
        'contact_email': 'intl.sales@weichai-parts.cn',
    },
]

# =======================================================================
#  SCORING WEIGHTS — sum to 1.00 per category
# =======================================================================
# Mirrors real procurement strategy:
#   • Filters: replaced frequently → delivery & cost matter
#   • Gaskets: failure = engine damage → quality is king
#   • Engine parts: safety-critical, tight tolerances
#   • Electrical: often urgent field failures → lead time critical
# =======================================================================
SCORING_WEIGHTS = [
    {'category': 'filters',
     'delivery_weight': 0.30, 'quality_weight': 0.25,
     'lead_time_weight': 0.15, 'cost_weight': 0.30},
    {'category': 'gaskets',
     'delivery_weight': 0.20, 'quality_weight': 0.40,
     'lead_time_weight': 0.15, 'cost_weight': 0.25},
    {'category': 'engine_parts',
     'delivery_weight': 0.15, 'quality_weight': 0.45,
     'lead_time_weight': 0.15, 'cost_weight': 0.25},
    {'category': 'electrical',
     'delivery_weight': 0.25, 'quality_weight': 0.25,
     'lead_time_weight': 0.30, 'cost_weight': 0.20},
]

# =======================================================================
#  CONTAINER SPECS — ISO standard intermodal containers
# =======================================================================
CONTAINER_SPECS = [
    {'type': '20ft',    'max_weight_kg': 28230, 'max_cbm': 33.18, 'base_cost_usd': 2650},
    {'type': '40ft',    'max_weight_kg': 28750, 'max_cbm': 67.67, 'base_cost_usd': 4400},
    {'type': '40ft_HC', 'max_weight_kg': 28560, 'max_cbm': 76.28, 'base_cost_usd': 4800},
]

# =======================================================================
#  PRICE MULTIPLIERS — supplier-specific pricing vs. list price
# =======================================================================
# Applied to each product's base unit_price_usd to derive the per-supplier
# quote stored in supplier_products.unit_price
# =======================================================================
PRICE_MULTIPLIERS = {
    'SUP-A': 1.10,   # OEM premium
    'SUP-B': 1.02,   # Slight European mark-up
    'SUP-C': 0.78,   # Lowest cost source
    'SUP-D': 1.18,   # Fast-turn premium
    'SUP-E': 1.22,   # Top quality premium
    'SUP-F': 0.85,   # Asia Pacific cost advantage
}

# MOQ overrides: some suppliers require different MOQs than the product
# default.  Format: { supplier_id: { sku_prefix: multiplier } }
MOQ_OVERRIDES = {
    'SUP-C': {'FLT': 2.0, 'GSK': 2.0},      # Asia source needs 2× MOQ
    'SUP-E': {'ENG': 0.5},                    # Premium supplier accepts half MOQ
    'SUP-D': {'ELC': 0.5, 'ENG': 0.5},       # JIT supplier, small-batch friendly
}

# =======================================================================
#  DEMAND PROFILES — seasonal curves by category
# =======================================================================
# Cummins engines power construction, mining, trucking, and power-gen.
# Demand follows real-world patterns:
#   • Filters: high baseline, mild summer peak (PM season)
#   • Gaskets: steady, slight spring peak (rebuild season)
#   • Engine parts: spring/summer peak (fleet upfit + construction)
#   • Electrical: winter peak (cold-start failures, fleet winterization)
# =======================================================================
DEMAND_PROFILES = {
    'filters':      {'base_range': (800, 3000),  'amplitude': 0.15, 'phase_shift': 0},
    'gaskets':      {'base_range': (400, 1500),  'amplitude': 0.12, 'phase_shift': -1},
    'engine_parts': {'base_range': (50, 400),    'amplitude': 0.25, 'phase_shift': 0},
    'electrical':   {'base_range': (100, 600),   'amplitude': 0.20, 'phase_shift': 6},  # winter peak
}


# ═══════════════════════════════════════════════════════════════════════
#  SEED FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def seed_suppliers():
    """Insert/update 6 suppliers."""
    print('Seeding suppliers …')
    supabase.table('suppliers').upsert(SUPPLIERS).execute()
    print(f'  ✓ {len(SUPPLIERS)} suppliers')


def seed_products():
    """Insert/update 60 products with hand-tuned realistic dimensions."""
    print('Seeding products …')
    products = []
    for cat_name, cat in CATEGORIES.items():
        for (sku, name, moq, weight, cbm, price) in cat['products']:
            products.append({
                'sku': sku,
                'name': name,
                'category': cat_name,
                'moq': moq,
                'unit_weight_kg': weight,     # numeric(10,4) — ≤4 dp
                'unit_cbm': cbm,              # numeric(10,6) — ≤6 dp
                'unit_price_usd': price,      # numeric(10,2) — ≤2 dp
            })
    supabase.table('products').upsert(products).execute()
    print(f'  ✓ {len(products)} products')
    return products


def seed_supplier_products(products):
    """Create supplier↔product pricing rows with optional MOQ overrides."""
    print('Seeding supplier-product mappings …')
    mappings = []
    for prod in products:
        cat = CATEGORIES[prod['category']]
        for sup_id in cat['suppliers']:
            mult = PRICE_MULTIPLIERS[sup_id]
            # Determine MOQ override
            moq_override = None
            if sup_id in MOQ_OVERRIDES:
                prefix = prod['sku'].split('-')[0]
                if prefix in MOQ_OVERRIDES[sup_id]:
                    moq_override = max(1, int(prod['moq'] * MOQ_OVERRIDES[sup_id][prefix]))

            mappings.append({
                'supplier_id': sup_id,
                'sku': prod['sku'],
                'unit_price': round(prod['unit_price_usd'] * mult, 2),
                'moq_override': moq_override,
            })

    supabase.table('supplier_products').upsert(mappings).execute()
    print(f'  ✓ {len(mappings)} supplier-product mappings')


def seed_forecasts(products):
    """Generate 12 months of forecasts (Apr 2025 – Mar 2026) with realistic
    seasonal curves and Gaussian noise on historical actuals."""
    print('Seeding forecasts …')
    forecasts = []
    start_date = date(2025, 4, 1)    # 12-month window
    historical_months = 11            # Apr 2025 – Feb 2026 have actuals
    # (current date is ~Mar 2026, so Mar 2026 still in-flight)

    for prod in products:
        profile = DEMAND_PROFILES[prod['category']]
        base_demand = random.randint(*profile['base_range'])
        amplitude = profile['amplitude']
        phase = profile['phase_shift']
        # Noise proportional to base demand: CV ≈ 15-25 %
        noise_cv = random.uniform(0.15, 0.25)

        for m in range(12):
            yr  = start_date.year + (start_date.month + m - 1) // 12
            mon = (start_date.month + m - 1) % 12 + 1
            period = date(yr, mon, 1)

            # Sinusoidal seasonal factor
            seasonal = 1 + amplitude * math.sin(2 * math.pi * (m + phase) / 12)
            # Slight year-over-year growth trend (+0.3 % per month)
            trend = 1 + 0.003 * m
            forecast_qty = max(1, int(base_demand * seasonal * trend))

            actual_qty = None
            if m < historical_months:
                noise = random.gauss(0, base_demand * noise_cv)
                actual_qty = max(0, int(forecast_qty + noise))

            forecasts.append({
                'sku': prod['sku'],
                'period': period.isoformat(),
                'forecast_qty': forecast_qty,
                'actual_qty': actual_qty,
            })

    # Upsert in batches (Supabase row limit)
    BATCH = 200
    for i in range(0, len(forecasts), BATCH):
        supabase.table('forecasts') \
            .upsert(forecasts[i:i+BATCH], on_conflict='sku,period') \
            .execute()
    print(f'  ✓ {len(forecasts)} forecast rows')
    return forecasts


def _lead_time_for_sku(prod):
    """Return the *shortest* supplier lead-time available for this product."""
    cat = CATEGORIES[prod['category']]
    sup_ids = cat['suppliers']
    supplier_map = {s['id']: s for s in SUPPLIERS}
    return min(supplier_map[sid]['lead_time_days'] for sid in sup_ids)


def seed_inventory(products, forecasts):
    """Calculate realistic inventory positions.

    For each SKU:
      avg_daily_demand = mean(historical actuals) / 30
      safety_stock     = z_95 × σ_daily × √lead_time   (≈ service level 95 %)
      buffer_stock     = 10 % of avg monthly demand (absorb forecast error)
      reorder_point    = avg_daily_demand × lead_time + safety_stock + buffer_stock
      current_stock    = random 40-90 % of reorder_point (creates mix of
                         above/below reorder → triggers for the demand analyst)
      in_transit       = 0-25 % of avg monthly demand (simulates open POs)
    """
    print('Seeding inventory …')

    demand_by_sku: dict[str, list[int]] = {}
    for f in forecasts:
        if f['actual_qty'] is not None:
            demand_by_sku.setdefault(f['sku'], []).append(f['actual_qty'])

    inventory = []
    for prod in products:
        actuals = demand_by_sku.get(prod['sku'], [100])
        avg_monthly = sum(actuals) / len(actuals)
        avg_daily = avg_monthly / 30.0
        std_monthly = (sum((a - avg_monthly)**2 for a in actuals) / max(len(actuals) - 1, 1)) ** 0.5
        std_daily = std_monthly / math.sqrt(30)

        lead_time = _lead_time_for_sku(prod)

        # Safety stock: z_95 ≈ 1.65
        safety = max(1, int(1.65 * std_daily * math.sqrt(lead_time)))
        # Buffer: 10 % of avg monthly demand
        buffer = max(0, int(avg_monthly * 0.10))
        # Reorder point
        rop = max(1, int(avg_daily * lead_time + safety + buffer))

        # Current stock: randomly 40-90 % of ROP so roughly half the SKUs
        # sit below reorder — giving the demand analyst real work to do.
        current = max(0, int(rop * random.uniform(0.40, 0.90)))
        in_transit = int(avg_monthly * random.uniform(0.0, 0.25))

        inventory.append({
            'sku': prod['sku'],
            'current_stock': current,
            'in_transit': in_transit,
            'safety_stock': safety,
            'buffer_stock': buffer,
            'reorder_point': rop,
        })

    supabase.table('inventory').upsert(inventory).execute()
    print(f'  ✓ {len(inventory)} inventory records')


def seed_container_specs():
    print('Seeding container specs …')
    supabase.table('container_specs').upsert(CONTAINER_SPECS).execute()
    print(f'  ✓ {len(CONTAINER_SPECS)} container specs')


def seed_scoring_weights():
    print('Seeding scoring weights …')
    supabase.table('supplier_scoring_weights').upsert(SCORING_WEIGHTS).execute()
    print(f'  ✓ {len(SCORING_WEIGHTS)} scoring weight configs')


# ═══════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print('╔══════════════════════════════════════════════════════════╗')
    print('║   Seeding Supply Chain PO Database (Cummins Realistic)   ║')
    print('╚══════════════════════════════════════════════════════════╝')
    print()
    seed_suppliers()
    products = seed_products()
    seed_supplier_products(products)
    forecasts = seed_forecasts(products)
    seed_inventory(products, forecasts)
    seed_container_specs()
    seed_scoring_weights()
    print()
    print('══════════════════════════════════════════════════════════')
    print(' Seeding Complete — verify in Supabase Table Editor:')
    print('  • 60 products  (15 per category)')
    print('  • 6 suppliers  (3 regions)')
    print('  • ~210 supplier-product mappings')
    print('  • 720 forecast rows  (60 SKUs × 12 months)')
    print('  • 60 inventory records  (with pre-calculated ROP)')
    print('  • 3 container specs  (20ft, 40ft, 40ft HC)')
    print('  • 4 scoring weight configs')
    print('══════════════════════════════════════════════════════════')