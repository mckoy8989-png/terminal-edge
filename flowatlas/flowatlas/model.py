"""The gap model.

    GAP(category, area) = modeled demand - estimated supply

Demand comes from household counts by income band times a spend propensity
times a category split. Supply comes from local payroll times an industry
revenue-to-payroll ratio.

Both sides are models stacked on models, so every output carries a confidence
band and a note about which estimator was used. A single hard number here would
be false precision — see `Estimate.range_str`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .reference import (
    BAND_KEYS,
    BAND_MIDPOINT,
    CATEGORIES,
    CATEGORY_LABEL,
    CATEGORY_SHARES,
    CHAIN_DOMINATED,
    MEAN_REVENUE_PER_ESTABLISHMENT,
    RETAIL_PROPENSITY,
    REVENUE_PER_PAYROLL,
    STARTUP_CAPITAL,
)
from .sources import AreaProfile, SupplyRecord

# Stacked-model uncertainty. Demand is the more stable side (ACS counts are
# real; only the spend shares are modeled). Supply carries more error because
# the revenue-to-payroll ratio is a national average.
DEMAND_ERROR = 0.15
SUPPLY_ERROR_PAYROLL = 0.25
SUPPLY_ERROR_ESTAB = 0.45  # the fallback estimator is much weaker


@dataclass
class Estimate:
    value: float
    error: float  # fractional, symmetric

    @property
    def low(self) -> float:
        return self.value * (1 - self.error)

    @property
    def high(self) -> float:
        return self.value * (1 + self.error)

    def range_str(self) -> str:
        return f"{_money(self.low)} – {_money(self.high)}"


@dataclass
class CategoryResult:
    category: str
    label: str
    demand: Estimate
    supply: Estimate
    establishments: int
    used_fallback: bool
    chain_dominated: bool

    @property
    def gap(self) -> float:
        return self.demand.value - self.supply.value

    @property
    def gap_low(self) -> float:
        """Conservative gap: low demand against high supply."""
        return self.demand.low - self.supply.high

    @property
    def gap_high(self) -> float:
        return self.demand.high - self.supply.low

    @property
    def leakage_ratio(self) -> float:
        """Share of local demand not served locally. Negative means surplus."""
        if self.demand.value <= 0:
            return 0.0
        return self.gap / self.demand.value

    @property
    def startup_capital(self) -> int:
        return STARTUP_CAPITAL.get(self.category, 250_000)

    @property
    def opportunity_score(self) -> float:
        """Gap per dollar of capital required to enter.

        This is the ranking that matters. Sorting by raw gap tells everyone to
        open a grocery store; this tells them what they could actually start.
        Uses the conservative gap so the ranking is not driven by model error.
        """
        if self.gap_low <= 0:
            return 0.0
        return self.gap_low / self.startup_capital

    @property
    def confident(self) -> bool:
        """True when the gap survives the full error band in both directions."""
        return self.gap_low > 0 or self.gap_high < 0


@dataclass
class GapReport:
    area_name: str
    total_households: int
    median_income: int | None
    results: list[CategoryResult] = field(default_factory=list)

    @property
    def total_demand(self) -> float:
        return sum(r.demand.value for r in self.results)

    @property
    def total_supply(self) -> float:
        return sum(r.supply.value for r in self.results)

    def leaking(self) -> list[CategoryResult]:
        """Categories where money is confidently leaving, best opportunity first."""
        out = [r for r in self.results if r.gap_low > 0]
        return sorted(out, key=lambda r: r.opportunity_score, reverse=True)

    def surplus(self) -> list[CategoryResult]:
        """Categories that confidently draw spending in from outside."""
        out = [r for r in self.results if r.gap_high < 0]
        return sorted(out, key=lambda r: r.gap)


# ---------------------------------------------------------------------------


def model_demand(area: AreaProfile) -> dict[str, Estimate]:
    """Households x income x propensity x category share."""
    totals = {c: 0.0 for c in CATEGORIES}

    for band_index, band in enumerate(BAND_KEYS):
        households = area.households_by_band.get(band, 0)
        if households <= 0:
            continue
        income = BAND_MIDPOINT[band]
        addressable = households * income * RETAIL_PROPENSITY[band]

        # Normalize the column so shares sum to 1 even if the table drifts.
        column = {c: CATEGORY_SHARES[c][band_index] for c in CATEGORIES}
        denom = sum(column.values()) or 1.0
        for category, share in column.items():
            totals[category] += addressable * (share / denom)

    return {c: Estimate(v, DEMAND_ERROR) for c, v in totals.items()}


def model_supply(records: list[SupplyRecord]) -> tuple[dict[str, Estimate], dict[str, int], set[str]]:
    """Payroll x revenue-to-payroll, falling back to establishment counts.

    Returns (supply by category, establishment counts, categories that needed
    the weaker fallback estimator).
    """
    payroll: dict[str, int] = {c: 0 for c in CATEGORIES}
    estabs: dict[str, int] = {c: 0 for c in CATEGORIES}
    suppressed: dict[str, int] = {c: 0 for c in CATEGORIES}

    for rec in records:
        if rec.category not in payroll:
            continue
        payroll[rec.category] += rec.annual_payroll
        estabs[rec.category] += rec.establishments
        if rec.payroll_suppressed:
            suppressed[rec.category] += rec.establishments

    supply: dict[str, Estimate] = {}
    fallback: set[str] = set()

    for category in CATEGORIES:
        if payroll[category] > 0:
            value = payroll[category] * REVENUE_PER_PAYROLL[category]
            error = SUPPLY_ERROR_PAYROLL
            # Some establishments in this category had payroll suppressed, so
            # the payroll figure understates true supply. Top up with the
            # fallback estimator for just those establishments.
            if suppressed[category]:
                value += suppressed[category] * MEAN_REVENUE_PER_ESTABLISHMENT[category] * 0.4
                error = (SUPPLY_ERROR_PAYROLL + SUPPLY_ERROR_ESTAB) / 2
                fallback.add(category)
        elif estabs[category] > 0:
            value = estabs[category] * MEAN_REVENUE_PER_ESTABLISHMENT[category]
            error = SUPPLY_ERROR_ESTAB
            fallback.add(category)
        else:
            value, error = 0.0, SUPPLY_ERROR_ESTAB

        supply[category] = Estimate(value, error)

    return supply, estabs, fallback


def build_report(area: AreaProfile, records: list[SupplyRecord]) -> GapReport:
    demand = model_demand(area)
    supply, estabs, fallback = model_supply(records)

    results = [
        CategoryResult(
            category=c,
            label=CATEGORY_LABEL[c],
            demand=demand[c],
            supply=supply[c],
            establishments=estabs[c],
            used_fallback=c in fallback,
            chain_dominated=c in CHAIN_DOMINATED,
        )
        for c in CATEGORIES
    ]

    return GapReport(
        area_name=area.name,
        total_households=area.total_households,
        median_income=area.median_income,
        results=results,
    )


# ---------------------------------------------------------------------------


def _money(v: float) -> str:
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1_000_000_000:
        return f"{sign}${a/1_000_000_000:.2f}B"
    if a >= 1_000_000:
        return f"{sign}${a/1_000_000:.1f}M"
    if a >= 1_000:
        return f"{sign}${a/1_000:.0f}K"
    return f"{sign}${a:.0f}"


money = _money


# ==========================================================================
# THE SERVICE UNIVERSE
#
# Parallel model for businesses that have no storefront. Demand is paid
# household services; supply comes from Nonemployer Statistics receipts, which
# are actual revenue rather than a payroll-ratio estimate.
#
# This is where a person with a few thousand dollars actually competes.
# ==========================================================================

from .reference import (  # noqa: E402
    SERVICE_CATEGORIES,
    SERVICE_LABEL,
    SERVICE_LICENSE_NOTE,
    SERVICE_PROPENSITY,
    SERVICE_REVENUE_PER_PAYROLL,
    SERVICE_SHARES,
    SERVICE_STARTUP_CAPITAL,
    collapse_naics_hierarchy,
    service_naics_weights,
)
from .sources import NonemployerRecord  # noqa: E402

# Nonemployer receipts are reported, not modeled, so the supply side here is
# tighter than anything in the retail universe.
SUPPLY_ERROR_RECEIPTS = 0.10


@dataclass
class ServiceResult:
    category: str
    label: str
    demand: Estimate
    supply: Estimate
    operators: int
    license_note: str | None

    @property
    def gap(self) -> float:
        return self.demand.value - self.supply.value

    @property
    def gap_low(self) -> float:
        return self.demand.low - self.supply.high

    @property
    def leakage_ratio(self) -> float:
        if self.demand.value <= 0:
            return 0.0
        return self.gap / self.demand.value

    @property
    def no_supply_data(self) -> bool:
        """True when we observed no supply at all for a category with demand.

        This is almost never a real vacuum. It means the trade has no clean
        NAICS code, or Census suppressed the cell. Reporting it as 100%
        leakage would be the single most dangerous output this tool could
        produce, so it is flagged and excluded from the ranking instead.
        """
        return self.supply.value <= 0 and self.demand.value > 0

    @property
    def startup_capital(self) -> int:
        return SERVICE_STARTUP_CAPITAL.get(self.category, 5_000)

    @property
    def revenue_per_operator(self) -> float:
        """What the average existing operator actually bills.

        The single most useful number on this page for someone deciding
        whether to enter: it is roughly what you would be joining, not what
        the market could theoretically support.
        """
        if self.operators <= 0:
            return 0.0
        return self.supply.value / self.operators

    @property
    def operators_supportable(self) -> float:
        """How many more operators the unserved demand could carry."""
        rpo = self.revenue_per_operator
        if rpo <= 0 or self.gap_low <= 0:
            return 0.0
        return self.gap_low / rpo

    @property
    def opportunity_score(self) -> float:
        if self.gap_low <= 0 or self.no_supply_data:
            return 0.0
        return self.gap_low / self.startup_capital


def model_service_demand(area: AreaProfile) -> dict[str, Estimate]:
    totals = {c: 0.0 for c in SERVICE_CATEGORIES}
    for band in BAND_KEYS:
        households = area.households_by_band.get(band, 0)
        if households <= 0:
            continue
        spend = households * BAND_MIDPOINT[band] * SERVICE_PROPENSITY[band]
        denom = sum(SERVICE_SHARES.values()) or 1.0
        for category, share in SERVICE_SHARES.items():
            totals[category] += spend * (share / denom)
    return {c: Estimate(v, DEMAND_ERROR) for c, v in totals.items()}


def model_service_supply(
    nonemployers: list[NonemployerRecord],
    employers: list[SupplyRecord] | None = None,
) -> tuple[dict[str, Estimate], dict[str, int]]:
    """Nonemployer receipts, plus any employer firms in the same trades."""
    receipts = {c: 0.0 for c in SERVICE_CATEGORIES}
    operators = {c: 0.0 for c in SERVICE_CATEGORIES}

    # Drop parent NAICS codes when their children are also present, or every
    # business inside the child gets counted twice.
    keep = collapse_naics_hierarchy([r.naics for r in nonemployers])
    for rec in nonemployers:
        if rec.naics not in keep:
            continue
        for category, weight in service_naics_weights(rec.naics).items():
            if category in receipts:
                receipts[category] += rec.receipts * weight
                operators[category] += rec.establishments * weight

    # Employer firms in these trades compete for the same work — a 30-crew
    # landscaping company wants the same lawns as the guy with one trailer.
    emp = employers or []
    emp_keep = collapse_naics_hierarchy([r.naics for r in emp])
    for rec in emp:
        if rec.naics not in emp_keep or not rec.annual_payroll:
            continue
        for category, weight in service_naics_weights(rec.naics).items():
            if category in receipts:
                ratio = SERVICE_REVENUE_PER_PAYROLL.get(category, 2.6)
                receipts[category] += rec.annual_payroll * ratio * weight
                operators[category] += rec.establishments * weight

    supply = {c: Estimate(receipts[c], SUPPLY_ERROR_RECEIPTS)
              for c in SERVICE_CATEGORIES}
    return supply, {c: int(round(v)) for c, v in operators.items()}


def build_service_report(
    area: AreaProfile,
    nonemployers: list[NonemployerRecord],
    employers: list[SupplyRecord] | None = None,
) -> list[ServiceResult]:
    demand = model_service_demand(area)
    supply, operators = model_service_supply(nonemployers, employers)
    return [
        ServiceResult(
            category=c,
            label=SERVICE_LABEL[c],
            demand=demand[c],
            supply=supply[c],
            operators=operators[c],
            license_note=SERVICE_LICENSE_NOTE.get(c),
        )
        for c in SERVICE_CATEGORIES
    ]


def affordable(results: list[ServiceResult], capital: float) -> list[ServiceResult]:
    """What this much money can actually start, best opportunity first."""
    reachable = [r for r in results if r.startup_capital <= capital]
    return sorted(reachable, key=lambda r: r.opportunity_score, reverse=True)
