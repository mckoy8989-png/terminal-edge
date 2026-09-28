"""Data source clients.

Every client has two modes:

  live     hits the real public API (needs network + a Census API key)
  fixture  reads a local JSON file, so the pipeline runs end to end offline

The fixture shipped in this repo is SYNTHETIC. It exists to exercise the model,
not to describe any real place. Nothing in fixtures/ should ever be quoted as a
finding about an actual county.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from .reference import INCOME_BANDS, category_for_naics, service_category_for_naics

CENSUS_BASE = "https://api.census.gov/data"
USASPENDING_BASE = "https://api.usaspending.gov/api/v2"
FDIC_BASE = "https://banks.data.fdic.gov/api"

CACHE_DIR = Path(os.environ.get("FLOWATLAS_CACHE", ".cache"))


class SourceError(RuntimeError):
    pass


# ---------------------------------------------------------------------------


def _get_json(url: str, *, timeout: int = 60, retries: int = 3):
    """GET with a disk cache and linear backoff.

    The cache matters more than it looks: ACS and CBP pulls are slow and you
    will re-run the model many times while calibrating. Delete .cache to force
    a refresh.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = urllib.parse.quote(url, safe="")[:180]
    cached = CACHE_DIR / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text())

    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "flowatlas/0.1"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            cached.write_text(json.dumps(payload))
            return payload
        except Exception as exc:  # noqa: BLE001 - surfaced below with context
            last = exc
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    raise SourceError(f"GET failed after {retries} tries: {url}\n  {last}")


# ---------------------------------------------------------------------------


@dataclass
class AreaProfile:
    """Demand-side inputs for one geography."""

    name: str
    households_by_band: dict[str, int] = field(default_factory=dict)
    total_households: int = 0
    median_income: int | None = None

    @property
    def is_empty(self) -> bool:
        return self.total_households == 0


@dataclass
class NonemployerRecord:
    """One NAICS line from Census Nonemployer Statistics.

    Nonemployers are businesses with no payroll — sole proprietors, one-truck
    operations, the single-operator trades. About 29M of them nationally
    against ~8.1M employer establishments, so they are roughly 77% of all US
    businesses by count and only a few percent of receipts.

    Unlike CBP this reports ACTUAL RECEIPTS, so no payroll-ratio estimate is
    needed. It is the better supply measurement wherever it is available.
    """

    naics: str
    category: str
    establishments: int
    receipts: int  # dollars


@dataclass
class SupplyRecord:
    """One NAICS line of supply-side input, already mapped to a category."""

    naics: str
    category: str
    establishments: int
    annual_payroll: int  # dollars; 0 means suppressed for disclosure
    payroll_suppressed: bool


# ---------------------------------------------------------------------------


class CensusClient:
    """Census ACS (demand side) and County Business Patterns (supply side)."""

    def __init__(self, api_key: str | None = None, acs_year: int = 2022,
                 cbp_year: int = 2022, nes_year: int = 2021):
        self.api_key = api_key or os.environ.get("CENSUS_API_KEY")
        self.acs_year = acs_year
        self.cbp_year = cbp_year
        self.nes_year = nes_year

    def _key_param(self) -> str:
        return f"&key={self.api_key}" if self.api_key else ""

    # -- demand -----------------------------------------------------------

    def area_profile(self, state_fips: str, county_fips: str) -> AreaProfile:
        """Households by income band, from ACS table B19001."""
        var_ids = []
        for _, _, suffixes in INCOME_BANDS:
            var_ids.extend(f"B19001_{s}E" for s in suffixes)
        # B19001_001E is the universe total; B19013_001E is median income.
        get = ",".join(["NAME", "B19001_001E", "B19013_001E", *var_ids])
        url = (
            f"{CENSUS_BASE}/{self.acs_year}/acs/acs5"
            f"?get={get}&for=county:{county_fips}&in=state:{state_fips}"
            f"{self._key_param()}"
        )
        rows = _get_json(url)
        header, values = rows[0], rows[1]
        rec = dict(zip(header, values))

        def as_int(v):
            try:
                n = int(v)
            except (TypeError, ValueError):
                return 0
            # Census uses large negative sentinels for missing/suppressed.
            return n if n > -1_000_000 else 0

        by_band: dict[str, int] = {}
        for band, _mid, suffixes in INCOME_BANDS:
            by_band[band] = sum(as_int(rec.get(f"B19001_{s}E")) for s in suffixes)

        median = as_int(rec.get("B19013_001E")) or None
        return AreaProfile(
            name=rec.get("NAME", f"{state_fips}{county_fips}"),
            households_by_band=by_band,
            total_households=as_int(rec.get("B19001_001E")),
            median_income=median,
        )

    # -- supply -----------------------------------------------------------

    def business_patterns(self, state_fips: str, county_fips: str) -> list[SupplyRecord]:
        """Establishments and annual payroll by NAICS, from CBP."""
        url = (
            f"{CENSUS_BASE}/{self.cbp_year}/cbp"
            f"?get=NAICS2017,ESTAB,PAYANN,EMP"
            f"&for=county:{county_fips}&in=state:{state_fips}"
            f"{self._key_param()}"
        )
        rows = _get_json(url)
        header = rows[0]
        out: list[SupplyRecord] = []
        for values in rows[1:]:
            rec = dict(zip(header, values))
            naics = (rec.get("NAICS2017") or "").strip()
            category = category_for_naics(naics)
            if not category:
                continue
            estab = _safe_int(rec.get("ESTAB"))
            # CBP reports payroll in THOUSANDS of dollars.
            payroll_k = _safe_int(rec.get("PAYANN"))
            out.append(
                SupplyRecord(
                    naics=naics,
                    category=category,
                    establishments=estab,
                    annual_payroll=payroll_k * 1000,
                    payroll_suppressed=(payroll_k == 0 and estab > 0),
                )
            )
        return out

    def nonemployers(self, state_fips: str, county_fips: str) -> list[NonemployerRecord]:
        """Nonemployer businesses and their receipts, by NAICS.

        NES runs further behind than CBP — typically three to four years — so
        nes_year defaults lower. Label the vintage anywhere you show it.
        """
        url = (
            f"{CENSUS_BASE}/{self.nes_year}/nonemp"
            f"?get=NAICS2017,NESTAB,RCPTOT"
            f"&for=county:{county_fips}&in=state:{state_fips}"
            f"{self._key_param()}"
        )
        rows = _get_json(url)
        header = rows[0]
        out: list[NonemployerRecord] = []
        for values in rows[1:]:
            rec = dict(zip(header, values))
            naics = (rec.get("NAICS2017") or "").strip()
            category = service_category_for_naics(naics)
            if not category:
                continue
            out.append(
                NonemployerRecord(
                    naics=naics,
                    category=category,
                    establishments=_safe_int(rec.get("NESTAB")),
                    # NES reports receipts in THOUSANDS of dollars.
                    receipts=_safe_int(rec.get("RCPTOT")) * 1000,
                )
            )
        return out




def _safe_int(v) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 0
    return max(n, 0)


# ---------------------------------------------------------------------------


class FixtureClient:
    """Reads the same shapes from a local JSON file. Synthetic data only."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        if not self.path.exists():
            raise SourceError(f"fixture not found: {self.path}")
        self.blob = json.loads(self.path.read_text())

    def area_profile(self, state_fips: str, county_fips: str) -> AreaProfile:
        a = self.blob["area"]
        return AreaProfile(
            name=a["name"],
            households_by_band=a["households_by_band"],
            total_households=a["total_households"],
            median_income=a.get("median_income"),
        )

    def nonemployers(self, state_fips: str, county_fips: str) -> list[NonemployerRecord]:
        out = []
        for r in self.blob.get("nonemployers", []):
            category = service_category_for_naics(r["naics"])
            if not category:
                continue
            out.append(
                NonemployerRecord(
                    naics=r["naics"], category=category,
                    establishments=r["establishments"], receipts=r["receipts"],
                )
            )
        return out

    def business_patterns(self, state_fips: str, county_fips: str) -> list[SupplyRecord]:
        out = []
        for r in self.blob["business_patterns"]:
            category = category_for_naics(r["naics"])
            if not category:
                continue
            out.append(
                SupplyRecord(
                    naics=r["naics"],
                    category=category,
                    establishments=r["establishments"],
                    annual_payroll=r["annual_payroll"],
                    payroll_suppressed=bool(r.get("payroll_suppressed")),
                )
            )
        return out


# ---------------------------------------------------------------------------
# Context sources. Not used by the gap model itself — these answer "where is
# the money" rather than "where is the gap" — but the CLI reports them because
# they are what tells you whether a gap is fillable.
# ---------------------------------------------------------------------------


def federal_inflow(state_fips: str, county_fips: str, fiscal_year: int = 2024) -> dict:
    """Federal award dollars with place-of-performance in this county.

    POSTs to USAspending; no API key required.
    """
    body = {
        "filters": {
            "time_period": [{"start_date": f"{fiscal_year-1}-10-01",
                             "end_date": f"{fiscal_year}-09-30"}],
            "place_of_performance_locations": [
                {"country": "USA", "state": state_fips, "county": county_fips}
            ],
        },
        "category": "awarding_agency",
        "limit": 25,
    }
    req = urllib.request.Request(
        f"{USASPENDING_BASE}/search/spending_by_category/awarding_agency/",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "flowatlas/0.1"},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode())


def branch_deposits(state_abbr: str, county_name: str) -> list[dict]:
    """Deposits held at each bank branch in a county, from FDIC SOD.

    The closest thing that exists to a public answer for "where is the money
    around me." No API key required.
    """
    params = urllib.parse.urlencode({
        "filters": f'STALPBR:"{state_abbr}" AND CNTYNAMB:"{county_name}"',
        "fields": "NAMEFULL,CITYBR,CNTYNAMB,DEPSUMBR,ADDRESBR",
        "limit": 1000,
        "format": "json",
    })
    payload = _get_json(f"{FDIC_BASE}/sod?{params}")
    return [row.get("data", row) for row in payload.get("data", [])]
