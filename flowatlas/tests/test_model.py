"""Model tests.

The important one is test_national_calibration. The first version of the
propensity table was low by roughly half, and nothing caught it until the
output looked implausible by eye. This pins it.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from flowatlas.model import build_report, model_demand, model_supply  # noqa: E402
from flowatlas.reference import (  # noqa: E402
    BAND_KEYS,
    CALIBRATION_TARGET,
    CATEGORIES,
    CATEGORY_SHARES,
    category_for_naics,
)
from flowatlas.sources import AreaProfile, FixtureClient, SupplyRecord  # noqa: E402

# Approximate US household income distribution, share of households by band.
US_DISTRIBUTION = {
    "lt25": 0.16, "25to50": 0.19, "50to75": 0.16, "75to100": 0.13,
    "100to150": 0.16, "150to200": 0.09, "gte200": 0.11,
}


def test_national_calibration():
    """Demand per household must land near real US retail spend per household.

    US retail excluding motor vehicle dealers, plus food service and personal
    services, is on the order of $6.5T across ~132M households. A propensity
    table that does not reproduce roughly $40-55K per household is wrong, no
    matter how reasonable each individual number looks.
    """
    n = 1_000_000
    area = AreaProfile(
        name="calibration",
        households_by_band={b: int(n * s) for b, s in US_DISTRIBUTION.items()},
        total_households=n,
    )
    total = sum(e.value for e in model_demand(area).values())
    per_household = total / n
    lo, hi = CALIBRATION_TARGET
    assert lo <= per_household <= hi, (
        f"demand model produces ${per_household:,.0f}/household, "
        f"outside the plausible band ${lo:,}-${hi:,}"
    )


def test_distribution_sums_to_one():
    assert abs(sum(US_DISTRIBUTION.values()) - 1.0) < 1e-9


def test_category_shares_are_well_formed():
    """Every category needs one share per income band, and columns should be
    close to summing to 1 even though the model normalizes them."""
    for category, shares in CATEGORY_SHARES.items():
        assert len(shares) == len(BAND_KEYS), category
        assert all(0 <= s <= 1 for s in shares), category
    for i, band in enumerate(BAND_KEYS):
        column = sum(CATEGORY_SHARES[c][i] for c in CATEGORIES)
        assert 0.9 <= column <= 1.1, f"{band} column sums to {column:.3f}"


def test_naics_longest_prefix_wins():
    assert category_for_naics("4451") == "grocery"
    assert category_for_naics("7225") == "restaurants"
    assert category_for_naics("4431") == "electronics"
    # 442 maps to home furnishings, but 4431 is more specific and must win.
    assert category_for_naics("442") == "home_furnishings"
    assert category_for_naics("9999") is None
    assert category_for_naics("") is None


def test_empty_area_produces_zero_demand():
    area = AreaProfile(name="empty", households_by_band={}, total_households=0)
    assert sum(e.value for e in model_demand(area).values()) == 0


def test_suppressed_payroll_uses_fallback():
    """CBP suppresses payroll in thin cells. Supply must not read as zero."""
    records = [SupplyRecord("8121", "personal_services", 100, 0, True)]
    supply, estabs, fallback = model_supply(records)
    assert supply["personal_services"].value > 0
    assert "personal_services" in fallback
    assert estabs["personal_services"] == 100


def test_fallback_carries_wider_error():
    strong = model_supply([SupplyRecord("7225", "restaurants", 50, 20_000_000, False)])[0]
    weak = model_supply([SupplyRecord("7225", "restaurants", 50, 0, True)])[0]
    assert weak["restaurants"].error > strong["restaurants"].error


def test_conservative_gap_is_narrower_than_headline():
    """gap_low must be strictly inside gap for any category with real demand."""
    client = FixtureClient("fixtures/demo_county.json")
    report = build_report(client.area_profile("", ""), client.business_patterns("", ""))
    for r in report.results:
        if r.demand.value > 0:
            assert r.gap_low < r.gap < r.gap_high


def test_leaking_ranked_by_capital_not_raw_gap():
    """The whole point of the ranking: a small cheap gap can outrank a big
    expensive one."""
    client = FixtureClient("fixtures/demo_county.json")
    report = build_report(client.area_profile("", ""), client.business_patterns("", ""))
    leaking = report.leaking()
    assert leaking, "demo fixture should surface leakage"
    scores = [r.opportunity_score for r in leaking]
    assert scores == sorted(scores, reverse=True)
    # Confirm ordering actually differs from a raw-gap sort somewhere.
    by_gap = sorted(leaking, key=lambda r: r.gap, reverse=True)
    assert [r.category for r in by_gap] != [r.category for r in leaking]


def test_demo_fixture_finds_the_planted_gaps():
    client = FixtureClient("fixtures/demo_county.json")
    report = build_report(client.area_profile("", ""), client.business_patterns("", ""))
    leaking = {r.category for r in report.leaking()}
    # The fixture was built thin on these two on purpose.
    assert "personal_services" in leaking
    assert "grocery" in leaking


def test_report_totals_are_consistent():
    client = FixtureClient("fixtures/demo_county.json")
    report = build_report(client.area_profile("", ""), client.business_patterns("", ""))
    assert abs(report.total_demand - sum(r.demand.value for r in report.results)) < 1
    assert report.total_households == 150_000


# ---------------------------------------------------------------------------
# Service universe
# ---------------------------------------------------------------------------

from flowatlas.model import (  # noqa: E402
    affordable,
    build_service_report,
    model_service_demand,
    model_service_supply,
)
from flowatlas.reference import (  # noqa: E402
    SERVICE_CALIBRATION_TARGET,
    SERVICE_SHARES,
    SERVICE_STARTUP_CAPITAL,
    collapse_naics_hierarchy,
    service_naics_weights,
)
from flowatlas.sources import NonemployerRecord  # noqa: E402


def test_service_calibration():
    """Paid household services should land near $2-3K per household per year."""
    n = 1_000_000
    area = AreaProfile(
        name="calibration",
        households_by_band={b: int(n * s) for b, s in US_DISTRIBUTION.items()},
        total_households=n,
    )
    per_household = sum(e.value for e in model_service_demand(area).values()) / n
    lo, hi = SERVICE_CALIBRATION_TARGET
    assert lo <= per_household <= hi, f"${per_household:,.0f}/household is outside ${lo:,}-${hi:,}"


def test_service_shares_sum_to_one():
    assert abs(sum(SERVICE_SHARES.values()) - 1.0) < 1e-9


def test_shared_naics_splits_across_categories():
    """REGRESSION: 561790 holds both pool service and pressure washing.

    Mapping it to one category invented a total vacuum in the other, which the
    model reported as 100% leakage — the most dangerous possible output.
    """
    weights = service_naics_weights("561790")
    assert "pool_service" in weights and "exterior_cleaning" in weights
    assert sum(weights.values()) <= 1.0

    supply, operators = model_service_supply(
        [NonemployerRecord("561790", "pool_service", 100, 10_000_000)]
    )
    assert supply["pool_service"].value > 0
    assert supply["exterior_cleaning"].value > 0
    assert operators["pool_service"] > 0
    assert operators["exterior_cleaning"] > 0


def test_naics_hierarchy_collapse_prevents_double_count():
    """REGRESSION: NAICS 238 contains 238220. Summing both counts plumbers twice."""
    assert collapse_naics_hierarchy(["238", "238220"]) == {"238220"}
    assert collapse_naics_hierarchy(["238"]) == {"238"}
    assert collapse_naics_hierarchy(["238220", "561730"]) == {"238220", "561730"}

    both = model_service_supply([
        NonemployerRecord("238", "home_repair", 980, 88_000_000),
        NonemployerRecord("238220", "home_repair", 410, 41_000_000),
    ])[1]
    assert both["home_repair"] == 410, "parent NAICS must be dropped, not summed"


def test_zero_supply_flags_as_no_data_not_opportunity():
    """A category with demand and no observed supply is a coding gap."""
    area = AreaProfile(name="t", households_by_band={"100to150": 10_000},
                       total_households=10_000)
    results = build_service_report(area, nonemployers=[])
    for r in results:
        assert r.no_supply_data
        assert r.opportunity_score == 0.0, "no-data must never rank as opportunity"


def test_affordable_respects_capital_and_ranks_by_score():
    client = FixtureClient("fixtures/demo_county.json")
    area = client.area_profile("", "")
    results = build_service_report(area, client.nonemployers("", ""),
                                   client.business_patterns("", ""))
    picks = affordable(results, 5_000)
    assert picks, "the demo county should offer something under $5K"
    assert all(r.startup_capital <= 5_000 for r in picks)
    scores = [r.opportunity_score for r in picks]
    assert scores == sorted(scores, reverse=True)
    # Moving costs $12K and must be excluded.
    assert "moving" not in {r.category for r in picks}


def test_tiny_capital_returns_nothing():
    client = FixtureClient("fixtures/demo_county.json")
    area = client.area_profile("", "")
    results = build_service_report(area, client.nonemployers("", ""))
    assert affordable(results, 100) == []


def test_revenue_per_operator_is_sane():
    """What existing operators actually bill — the key entry number."""
    client = FixtureClient("fixtures/demo_county.json")
    area = client.area_profile("", "")
    results = build_service_report(area, client.nonemployers("", ""),
                                   client.business_patterns("", ""))
    for r in results:
        if r.operators > 0:
            assert 5_000 < r.revenue_per_operator < 5_000_000, r.label


def test_every_service_category_has_a_capital_figure():
    for category in SERVICE_SHARES:
        assert category in SERVICE_STARTUP_CAPITAL, category
