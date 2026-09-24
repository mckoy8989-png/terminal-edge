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
