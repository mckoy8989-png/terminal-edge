"""Static reference tables — the modeling assumptions.

Nothing here needs a network. This module is the actual intellectual content of
the gap model: how much of a household's income is addressable by local
business, how that splits by category, how to turn payroll into a revenue
estimate, and what it costs to open the door.

Every number is a tunable assumption, not a fact. Sources and the method for
replacing each with better data are given per table. Treat the defaults as a
starting calibration that you should re-fit against local reality in Phase 0.
"""

from __future__ import annotations

# --------------------------------------------------------------------------
# Income bands. Keyed to Census ACS table B19001 (household income in the past
# 12 months), collapsed from its 16 buckets into 7 workable bands.
# --------------------------------------------------------------------------

INCOME_BANDS = [
    # (band key, midpoint income used for modeling, B19001 variable suffixes)
    ("lt25",     15_000, ["002", "003", "004", "005"]),
    ("25to50",   37_500, ["006", "007", "008", "009", "010"]),
    ("50to75",   62_500, ["011", "012"]),
    ("75to100",  87_500, ["013"]),
    ("100to150", 125_000, ["014"]),
    ("150to200", 175_000, ["015"]),
    ("gte200",   275_000, ["016", "017"]),
]

BAND_KEYS = [b[0] for b in INCOME_BANDS]
BAND_MIDPOINT = {k: m for k, m, _ in INCOME_BANDS}

# --------------------------------------------------------------------------
# Retail propensity: share of PRE-TAX household income spent in the
# retail-addressable universe (NAICS 44-45 retail, 722 food service,
# 812 personal services). Excludes housing, insurance, pensions, tuition and
# medical services, none of which a storefront captures.
#
# Falls with income because higher-income households route a larger share into
# savings, investment, housing and services outside this universe.
#
# Source to replace with: BLS Consumer Expenditure Survey public-use microdata,
# cross-tabbed by income decile. Refit annually.
# --------------------------------------------------------------------------

# CALIBRATION NOTE (Phase 0): the first pass of this table ran roughly half
# what it should. Sanity check that catches it — US retail sales excluding
# motor vehicle dealers, plus food service and personal services, run on the
# order of $6.5T against ~132M households, i.e. roughly $45-50K per household
# per year. Any propensity table that does not reproduce that on a nationally
# representative income distribution is wrong. See tests/test_model.py.
RETAIL_PROPENSITY = {
    "lt25":     1.05,   # spends more than measured income; the deficit is
                        # covered by transfers and credit, which are real money
    "25to50":   0.80,
    "50to75":   0.66,
    "75to100":  0.58,
    "100to150": 0.49,
    "150to200": 0.41,
    "gte200":   0.28,
}

# Target band for the calibration test: dollars of retail-addressable spend
# per household per year, on a nationally representative distribution.
CALIBRATION_TARGET = (40_000, 55_000)

# --------------------------------------------------------------------------
# Category split of retail-addressable spend, by income band.
#
# Shares need not sum to exactly 1.0 — they are normalized at runtime — but
# they should be close, and a large drift means the table needs refitting.
#
# The gradient across bands is the part that matters: grocery and fuel shares
# fall with income while restaurants, home improvement and recreation rise.
# --------------------------------------------------------------------------

CATEGORY_SHARES = {
    #                   lt25  25to50 50to75 75to100 100to150 150to200 gte200
    "grocery":          [0.22, 0.20, 0.18, 0.16, 0.15, 0.14, 0.13],
    "restaurants":      [0.11, 0.12, 0.14, 0.15, 0.16, 0.17, 0.17],
    "gasoline":         [0.11, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06],
    "auto_service":     [0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.06],
    "health_personal":  [0.08, 0.08, 0.07, 0.07, 0.07, 0.06, 0.06],
    "general_merch":    [0.12, 0.12, 0.11, 0.10, 0.10, 0.09, 0.09],
    "apparel":          [0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
    "home_furnishings": [0.04, 0.04, 0.05, 0.05, 0.05, 0.06, 0.06],
    "electronics":      [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
    "building_garden":  [0.06, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11],
    "sporting_hobby":   [0.03, 0.03, 0.04, 0.04, 0.04, 0.05, 0.05],
    "personal_services":[0.04, 0.04, 0.05, 0.05, 0.05, 0.06, 0.06],
    "entertainment":    [0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06],
}

CATEGORIES = list(CATEGORY_SHARES.keys())

CATEGORY_LABEL = {
    "grocery":           "Grocery & food at home",
    "restaurants":       "Restaurants & bars",
    "gasoline":          "Fuel",
    "auto_service":      "Auto parts & repair",
    "health_personal":   "Pharmacy & personal care",
    "general_merch":     "General merchandise",
    "apparel":           "Apparel",
    "home_furnishings":  "Furniture & home",
    "electronics":       "Electronics & appliances",
    "building_garden":   "Building materials & garden",
    "sporting_hobby":    "Sporting goods, hobby, books",
    "personal_services": "Personal services",
    "entertainment":     "Entertainment & recreation",
}

# --------------------------------------------------------------------------
# NAICS -> category crosswalk. Supply side.
#
# Prefixes are matched longest-first, so a more specific code wins. CBP reports
# at 2- through 6-digit NAICS; which level is available depends on how much
# disclosure suppression applies to the geography.
# --------------------------------------------------------------------------

NAICS_TO_CATEGORY = {
    "445": "grocery",          # food and beverage retailers
    "4451": "grocery",
    "4452": "grocery",
    "722": "restaurants",      # food services and drinking places
    "7225": "restaurants",
    "7224": "restaurants",
    "457": "gasoline",         # gasoline stations (2022 NAICS)
    "4471": "gasoline",        # 2017 NAICS equivalent
    "8111": "auto_service",
    "4413": "auto_service",
    "456": "health_personal",  # health and personal care (2022 NAICS)
    "4461": "health_personal", # 2017 NAICS equivalent
    "455": "general_merch",    # general merchandise (2022 NAICS)
    "452": "general_merch",    # 2017 NAICS equivalent
    "458": "apparel",          # clothing and accessories (2022 NAICS)
    "448": "apparel",          # 2017 NAICS equivalent
    "449": "home_furnishings", # furniture, home furnishings, electronics (2022)
    "442": "home_furnishings", # 2017 NAICS equivalent
    "4431": "electronics",
    "444": "building_garden",
    "4451X": "grocery",
    "459": "sporting_hobby",   # sporting goods, hobby, books (2022 NAICS)
    "451": "sporting_hobby",   # 2017 NAICS equivalent
    "8121": "personal_services",
    "8123": "personal_services",
    "713": "entertainment",
}


def category_for_naics(code: str) -> str | None:
    """Longest-prefix match of a NAICS code to a spend category."""
    code = (code or "").strip()
    for length in range(len(code), 1, -1):
        hit = NAICS_TO_CATEGORY.get(code[:length])
        if hit:
            return hit
    return None


# --------------------------------------------------------------------------
# Supply estimation.
#
# Primary method: annual payroll x revenue-to-payroll ratio. Payroll comes from
# CBP for the actual geography, so it reflects local scale rather than a
# national average — this is why it beats revenue-per-establishment.
#
# Fallback: establishment count x national mean revenue, used when CBP has
# suppressed payroll for disclosure (common in small geographies and thin
# industries). The fallback is materially less accurate; the model flags every
# category where it had to be used.
#
# Source to replace with: Economic Census revenue-to-payroll by NAICS, or state
# sales-tax collections by category where published.
# --------------------------------------------------------------------------

REVENUE_PER_PAYROLL = {
    "grocery":            9.0,
    "restaurants":        3.2,
    "gasoline":          18.0,
    "auto_service":       3.0,
    "health_personal":   11.0,
    "general_merch":      7.0,
    "apparel":            5.0,
    "home_furnishings":   5.0,
    "electronics":        6.0,
    "building_garden":    6.0,
    "sporting_hobby":     4.5,
    "personal_services":  2.5,
    "entertainment":      3.0,
}

MEAN_REVENUE_PER_ESTABLISHMENT = {
    "grocery":           4_500_000,
    "restaurants":       1_100_000,
    "gasoline":          4_500_000,
    "auto_service":        700_000,
    "health_personal":   5_000_000,
    "general_merch":    12_000_000,
    "apparel":           1_200_000,
    "home_furnishings":  1_800_000,
    "electronics":       2_500_000,
    "building_garden":   5_500_000,
    "sporting_hobby":    1_500_000,
    "personal_services":   350_000,
    "entertainment":     1_400_000,
}

# --------------------------------------------------------------------------
# Startup capital for a single independent unit, in dollars.
#
# This is what converts "there is a gap" into "you could fill it." Ranking by
# raw gap sends everyone to open a grocery store; ranking by gap per dollar of
# capital tells a person what is actually reachable.
#
# Midpoint of a typical range. Wildly location-dependent — replace with local
# build-out costs and lease rates as soon as you have them.
# --------------------------------------------------------------------------

STARTUP_CAPITAL = {
    "grocery":           650_000,
    "restaurants":       425_000,
    "gasoline":        1_500_000,
    "auto_service":      150_000,
    "health_personal":   500_000,
    "general_merch":     500_000,
    "apparel":           110_000,
    "home_furnishings":  180_000,
    "electronics":       160_000,
    "building_garden":   400_000,
    "sporting_hobby":    140_000,
    "personal_services":  95_000,
    "entertainment":     300_000,
}

# Categories where a single national or regional operator typically dominates,
# so a local gap is less likely to be fillable by an independent entrant.
CHAIN_DOMINATED = {"general_merch", "gasoline", "health_personal", "electronics"}


# ==========================================================================
# THE SERVICE UNIVERSE
#
# Everything above models the storefront economy: NAICS 44-45 retail, 722 food
# service, 812 personal services. That universe has a floor around $95,000 of
# startup capital, which made the model useless to anyone asking what they
# could start with a few thousand dollars.
#
# The omission was structural, not incidental. County Business Patterns counts
# only establishments WITH PAYROLL — about 8.1M of them. Census Nonemployer
# Statistics counts businesses with no employees: roughly 29M. Nonemployers are
# about 77% of all US businesses by count and only a few percent of receipts.
#
# That is precisely the world someone with $5,000 is entering, and the retail
# model could not see any of it. These tables fix that.
# ==========================================================================

# Share of PRE-TAX household income spent on PAID household services —
# lawn, cleaning, repair, pool, pest, hauling, moving, detailing.
#
# The gradient here is steeper than anything in the retail table, and the
# reason is the unpaid economy: low-income households mow their own lawn and
# clean their own house. Demand for these services is substitution of paid
# labor for unpaid household labor, so it scales with income far faster than
# population does.
#
# Calibration target: roughly $2,000-3,000 per household per year on a
# nationally representative income distribution.
SERVICE_PROPENSITY = {
    "lt25":     0.004,
    "25to50":   0.008,
    "50to75":   0.014,
    "75to100":  0.019,
    "100to150": 0.026,
    "150to200": 0.033,
    "gte200":   0.042,
}

SERVICE_CALIBRATION_TARGET = (1_500, 3_500)

# Category split of paid household services. Flat across bands — the income
# effect is already carried by SERVICE_PROPENSITY above.
#
# REGIONAL WARNING: pool_service is the one line that must be adjusted by
# geography. Texas, Arizona, Florida and Nevada carry several times the
# national pool density; the Northeast and Midwest carry a fraction of it.
# Scale it against local housing stock before trusting any pool number.
SERVICE_SHARES = {
    "lawn_landscape":    0.30,
    "home_repair":       0.20,
    "cleaning":          0.16,
    "pest_control":      0.09,
    "pool_service":      0.08,
    "auto_detailing":    0.05,
    "moving":            0.05,
    "junk_hauling":      0.04,
    "exterior_cleaning": 0.03,
}

SERVICE_CATEGORIES = list(SERVICE_SHARES.keys())

SERVICE_LABEL = {
    "lawn_landscape":    "Lawn & landscape",
    "home_repair":       "Handyman & home repair",
    "cleaning":          "House cleaning",
    "pest_control":      "Pest control",
    "pool_service":      "Pool service",
    "auto_detailing":    "Mobile auto detailing",
    "moving":            "Moving & hauling",
    "junk_hauling":      "Junk removal",
    "exterior_cleaning": "Pressure washing",
}

# NAICS -> service category. Used against BOTH Nonemployer Statistics and CBP,
# because these trades exist in both universes — one truck or forty.
SERVICE_NAICS = {
    "5617": "lawn_landscape",
    "56173": "lawn_landscape",
    "56172": "cleaning",          # janitorial
    "561720": "cleaning",
    "81411": "cleaning",          # private household services
    "56171": "pest_control",
    "561710": "pest_control",
    "23822": "home_repair",
    "238": "home_repair",         # specialty trade contractors, broad
    "81121": "auto_detailing",
    "811192": "auto_detailing",   # car washes / detailing
    "48421": "moving",
    "484210": "moving",
    "562111": "junk_hauling",
    "56292": "junk_hauling",
    "561790": "exterior_cleaning",
    "56179": "exterior_cleaning", # other services to buildings — pools land here too
}


# Some NAICS codes contain more than one of our categories and the official
# classification does not separate them. 561790 "Other Services to Buildings
# and Dwellings" holds BOTH pool cleaning and pressure washing, plus a
# remainder we do not model. Mapping it to a single category invents a total
# vacuum in the other one, which reads as 100% leakage — a spectacularly
# wrong signal to hand someone deciding where to put their savings.
#
# So a code may split across categories by weight. Weights need not sum to 1;
# the shortfall is the part of that NAICS we do not model.
SERVICE_NAICS_SPLIT = {
    "561790": {"pool_service": 0.55, "exterior_cleaning": 0.25},
    "56179":  {"pool_service": 0.55, "exterior_cleaning": 0.25},
}


def service_naics_weights(code: str) -> dict[str, float]:
    """Category weights for a NAICS code. Empty when nothing is modeled."""
    code = (code or "").strip()
    for length in range(len(code), 2, -1):
        prefix = code[:length]
        if prefix in SERVICE_NAICS_SPLIT:
            return dict(SERVICE_NAICS_SPLIT[prefix])
        hit = SERVICE_NAICS.get(prefix)
        if hit:
            return {hit: 1.0}
    return {}


def service_category_for_naics(code: str) -> str | None:
    """Single best category, for callers that cannot handle a split."""
    weights = service_naics_weights(code)
    if not weights:
        return None
    return max(weights.items(), key=lambda kv: kv[1])[0]


def collapse_naics_hierarchy(codes: list[str]) -> set[str]:
    """Keep only the most detailed NAICS level present.

    NAICS is a hierarchy and Census reports parents AND children in the same
    response: 238 "Specialty Trade Contractors" contains 238220 "Plumbing and
    HVAC". Summing both double-counts every plumber. Whenever a code is a
    strict prefix of another code in the same pull, the parent is dropped.
    """
    codes = [c for c in codes if c]
    keep = set(codes)
    for code in codes:
        for other in codes:
            if other != code and other.startswith(code) and len(other) > len(code):
                keep.discard(code)
                break
    return keep


# Startup capital for a single operator. Midpoint of a realistic range,
# assuming a usable vehicle is already owned — where it is not, add $6-12K and
# most of this list becomes unreachable.
SERVICE_STARTUP_CAPITAL = {
    "cleaning":            1_200,
    "pool_service":        2_200,
    "junk_hauling":        2_000,
    "exterior_cleaning":   3_200,
    "auto_detailing":      3_800,
    "home_repair":         4_000,
    "lawn_landscape":      4_500,
    "pest_control":        8_000,
    "moving":             12_000,
}

# Revenue-to-receipts is not needed for nonemployers — Nonemployer Statistics
# reports actual receipts. These ratios are only used when a service category
# has to be estimated from CBP payroll instead.
SERVICE_REVENUE_PER_PAYROLL = {
    "lawn_landscape":    2.6,
    "home_repair":       2.8,
    "cleaning":          2.2,
    "pest_control":      2.9,
    "pool_service":      2.6,
    "auto_detailing":    2.8,
    "moving":            2.7,
    "junk_hauling":      2.9,
    "exterior_cleaning": 2.7,
}

# Categories that need a state license somewhere beyond a business
# registration. Checked per state before any of this is actionable.
SERVICE_LICENSE_NOTE = {
    "pest_control":   "applicator license required in most states",
    "moving":         "state DOT / household goods carrier authority",
    "home_repair":    "varies sharply — some states license general contractors, Texas does not",
    "lawn_landscape": "pesticide application is licensed even where mowing is not",
}


# ==========================================================================
# SATURATION AND ENTRY BARRIER
#
# The first service model ranked by unserved demand per dollar of capital and
# returned lawn care, house cleaning and pressure washing — the three most
# recommended low-capital businesses in existence. That is not a finding. It
# is what any list returns, and those trades sit at subsistence margins
# precisely BECAUSE the ranking that produced them is the ranking everyone
# else runs too.
#
# The missing variable is the entry barrier. A trade anyone can start on
# Monday with a credit card saturates to the floor by definition. A trade
# requiring a license obtainable in three weeks for $900 has a fraction of the
# competition — not because it is harder, but because the barrier filters out
# the impulse entrant.
#
# So the screen is: real demand, LOW operator density, and a barrier that a
# committed person can clear inside their budget.
# ==========================================================================

BARRIER_NONE = "none"          # start Monday, no credential
BARRIER_EQUIPMENT = "equipment"  # capital specificity is the only filter
BARRIER_LICENSE = "license"      # state credential, weeks to obtain
BARRIER_MANDATE = "mandate"      # licensed AND demand is legally recurring

BARRIER_RANK = {
    BARRIER_NONE: 0,
    BARRIER_EQUIPMENT: 1,
    BARRIER_LICENSE: 2,
    BARRIER_MANDATE: 3,
}

ENTRY_BARRIER = {
    # The obvious tier — zero credential, maximum competition
    "cleaning":          BARRIER_NONE,
    "lawn_landscape":    BARRIER_NONE,
    "exterior_cleaning": BARRIER_NONE,
    "junk_hauling":      BARRIER_NONE,
    "auto_detailing":    BARRIER_NONE,
    "home_repair":       BARRIER_NONE,
    "moving":            BARRIER_LICENSE,
    "pool_service":      BARRIER_EQUIPMENT,
    "pest_control":      BARRIER_LICENSE,
}

# Operators per 1,000 households above which a trade is treated as saturated.
# Calibrated so the three universally-recommended gigs land above the line.
SATURATION_BENCHMARK = {
    "cleaning":          4.0,
    "lawn_landscape":    6.0,
    "exterior_cleaning": 1.0,
    "junk_hauling":      0.6,
    "auto_detailing":    1.2,
    "home_repair":       3.0,
    "moving":            0.8,
    "pool_service":      1.5,
    "pest_control":      1.0,
}


# ==========================================================================
# COMPLIANCE TRADES
#
# Demand here is created by regulation, not preference. That makes it
# inelastic, calendar-driven and recurring, and it is invisible to anyone
# searching "business to start with $5000" because it is not consumer-facing.
#
# Demand scales with COMMERCIAL ESTABLISHMENTS and building stock, not with
# household income — so these need a different driver than the service model.
#
# LICENSING CHANGES. Every entry below must be verified with the named agency
# before a dollar is committed. Figures are typical, not quoted.
# ==========================================================================

COMPLIANCE_CATEGORIES = [
    "backflow_testing",
    "fire_extinguisher",
    "appliance_repair",
    "rrp_lead_renovation",
    "hood_cleaning",
]

COMPLIANCE_LABEL = {
    "backflow_testing":    "Backflow assembly testing",
    "fire_extinguisher":   "Fire extinguisher service",
    "appliance_repair":    "Appliance repair",
    "rrp_lead_renovation": "Lead-safe renovation (RRP)",
    "hood_cleaning":       "Kitchen exhaust hood cleaning",
}

COMPLIANCE_STARTUP = {
    "backflow_testing":    2_600,   # course + test gauge + license
    "fire_extinguisher":   3_400,   # license + recharge gear + stock
    "appliance_repair":    4_000,   # tools, meters, training, parts float
    "rrp_lead_renovation":   900,   # EPA firm + renovator certification
    "hood_cleaning":       9_000,   # over a $5K budget — shown for contrast
}

COMPLIANCE_BARRIER = {c: BARRIER_MANDATE for c in COMPLIANCE_CATEGORIES}
COMPLIANCE_BARRIER["appliance_repair"] = BARRIER_EQUIPMENT

# What creates the demand, and how it is computed from available data.
COMPLIANCE_DRIVER = {
    "backflow_testing": {
        "per_establishment": 1.3,     # assemblies per commercial site
        "per_household": 0.18,        # share of homes with irrigation backflow
        "annual_price": 95.0,
        "frequency": 1.0,             # annual test required by the water utility
    },
    "fire_extinguisher": {
        "per_establishment": 4.2,     # extinguishers per commercial site
        "per_household": 0.0,
        # Blended annual revenue per extinguisher: the $14 inspection tag plus
        # amortised 6-year maintenance, hydrotest and recharge work, which is
        # where the actual margin sits.
        "annual_price": 26.0,
        "frequency": 1.0,             # annual inspection required
    },
    "appliance_repair": {
        "per_establishment": 0.0,
        "per_household": 0.42,        # service calls per household per year
        "annual_price": 215.0,
        "frequency": 1.0,
    },
    "rrp_lead_renovation": {
        "per_establishment": 0.0,
        "per_household": 0.05,        # pre-1978 stock share needing certified work
        "annual_price": 620.0,
        "frequency": 1.0,
    },
    "hood_cleaning": {
        "per_establishment": 0.0,
        "per_food_establishment": 1.0,
        "annual_price": 450.0,
        "frequency": 3.2,             # NFPA 96 interval by cooking volume
    },
}

COMPLIANCE_AUTHORITY = {
    "backflow_testing":    "TCEQ backflow prevention assembly tester licence; water utility enforces the annual test",
    "fire_extinguisher":   "State Fire Marshal licence; annual inspection required in commercial occupancies",
    "appliance_repair":    "no licence in most states; the barrier is skill and the aging technician base",
    "rrp_lead_renovation": "EPA RRP firm + certified renovator; required for paid work on pre-1978 housing",
    "hood_cleaning":       "NFPA 96 interval; insurers demand the certificate",
}

WHY_UNCROWDED = {
    "backflow_testing":    "annual legal mandate, a licence that filters casual entrants, and a 20-minute job that bills like an hour",
    "fire_extinguisher":   "route density compounds — one strip mall is a dozen accounts on one visit",
    "appliance_repair":    "the technician base is aging out faster than it is replaced while appliances get harder to self-repair",
    "rrp_lead_renovation": "cheapest credential here, and it converts an unlicensed handyman into a legal bidder on older housing",
    "hood_cleaning":       "mandated frequency, insurance-enforced, and the equipment cost keeps the field thin",
}
