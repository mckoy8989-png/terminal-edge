"""Exercise the --live code path end to end against Census-shaped stubs.

The live path cannot reach the real APIs from the build environment, and the
synthetic fixture bypasses the parsers entirely — so two real bugs survived
until the live path was driven with realistic response shapes.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "tests"))

import flowatlas.sources as S  # noqa: E402
from stub_census import fake_get_json  # noqa: E402

S._get_json = fake_get_json

from flowatlas.cli import main  # noqa: E402
from flowatlas.model import build_report, build_service_report, model_supply  # noqa: E402


def _client():
    return S.CensusClient()


def test_acs_income_buckets_map_to_the_right_bands():
    """REGRESSION: B19001_015 is $125-150K and _016 is $150-200K."""
    bands = _client().area_profile("48", "999").households_by_band
    assert bands["100to150"] == 20_000
    assert bands["150to200"] == 10_000
    assert bands["gte200"] == 10_000
    assert sum(bands.values()) == 100_000


def test_acs_parses_total_and_median():
    area = _client().area_profile("48", "999")
    assert area.total_households == 100_000
    assert area.median_income == 80_000
    assert area.name == "Stub County, Stub State"


def test_storefront_supply_does_not_count_hierarchy_levels_twice():
    """REGRESSION: grocery appears at four NAICS levels in one CBP response."""
    _, estabs, _ = model_supply(_client().business_patterns("48", "999"))
    assert estabs["grocery"] == 100
    assert estabs["restaurants"] == 400


def test_cbp_payroll_is_thousands_of_dollars():
    recs = {r.naics: r for r in _client().business_patterns("48", "999")}
    assert recs["445110"].annual_payroll == 50_000_000


def test_cbp_suppressed_payroll_is_detected():
    recs = {r.naics: r for r in _client().business_patterns("48", "999")}
    assert recs["8121"].payroll_suppressed


def test_nes_receipts_are_thousands_and_hierarchy_collapses():
    nes = _client().nonemployers("48", "999")
    by = {r.naics: r for r in nes}
    assert by["561730"].receipts == 45_000_000
    area = _client().area_profile("48", "999")
    services = {r.category: r for r in build_service_report(area, nes)}
    assert services["home_repair"].operators == 300  # 238220 only, not 238 + 238220


def test_full_live_cli_runs_end_to_end(capsys):
    code = main(["--live", "--county", "48999", "--screen", "--capital", "5000"])
    out = capsys.readouterr().out
    assert code == 0
    assert "SCREEN" in out
    assert "Stub County" in out or "SCREEN" in out


def test_storefront_report_builds_from_live_shapes():
    c = _client()
    report = build_report(c.area_profile("48", "999"), c.business_patterns("48", "999"))
    assert report.total_demand > 0
    assert report.total_supply > 0
