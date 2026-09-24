"""Command line entry point.

    python -m flowatlas --fixture fixtures/demo_county.json
    python -m flowatlas --county 06073 --live --csv out.csv
"""

from __future__ import annotations

import argparse
import csv
import sys

from .model import GapReport, build_report, money
from .sources import CensusClient, FixtureClient, SourceError

BAR_WIDTH = 22


def _bar(ratio: float) -> str:
    """Signed bar: leakage right of centre, surplus left."""
    filled = int(min(abs(ratio), 1.0) * BAR_WIDTH)
    return ("+" if ratio > 0 else "-") * max(filled, 1)


def render(report: GapReport, *, top: int) -> str:
    L: list[str] = []
    add = L.append

    add("=" * 78)
    add(f"  {report.area_name}")
    add("=" * 78)
    add(f"  Households         {report.total_households:,}")
    if report.median_income:
        add(f"  Median income      ${report.median_income:,}")
    add(f"  Addressable demand {money(report.total_demand)}/yr")
    add(f"  Estimated supply   {money(report.total_supply)}/yr")
    net = report.total_demand - report.total_supply
    verdict = "net leakage OUT of the area" if net > 0 else "net draw INTO the area"
    add(f"  Net                {money(net)}/yr — {verdict}")
    add("")

    leaking = report.leaking()
    add("-" * 78)
    add("  LEAKAGE — demand this area does not serve locally")
    add("  ranked by gap per dollar of startup capital, not by gap alone")
    add("-" * 78)
    if not leaking:
        add("  (none survive the confidence band)")
    for r in leaking[:top]:
        flags = []
        if r.chain_dominated:
            flags.append("chain-dominated")
        if r.used_fallback:
            flags.append("weak supply estimate")
        flag = f"  [{'; '.join(flags)}]" if flags else ""
        add("")
        add(f"  {r.label}{flag}")
        add(f"    gap          {money(r.gap)}   (conservative {money(r.gap_low)})")
        add(f"    leakage      {r.leakage_ratio*100:.0f}% of local demand  {_bar(r.leakage_ratio)}")
        add(f"    demand       {r.demand.range_str()}")
        add(f"    supply       {r.supply.range_str()}   across {r.establishments} establishments")
        add(f"    entry cost   {money(r.startup_capital)}  ->  score {r.opportunity_score:.2f}")

    surplus = report.surplus()
    add("")
    add("-" * 78)
    add("  SURPLUS — categories already drawing spending in from outside")
    add("-" * 78)
    if not surplus:
        add("  (none)")
    for r in surplus[:6]:
        add(f"  {r.label:<32} {money(-r.gap):>10} drawn in   "
            f"{r.establishments} establishments")

    add("")
    add("-" * 78)
    add("  READ THIS BEFORE ACTING ON ANY LINE ABOVE")
    add("-" * 78)
    add("  A large gap in a low-income area is usually why the gap still exists.")
    add("  Absolute leakage does not mean the market supports a new entrant:")
    add("  check demand DENSITY, whether a storefront is even available, and")
    add("  whether the category is chain-dominated before treating any row as")
    add("  an opportunity. Every figure is a modeled range, not a measurement.")
    add("=" * 78)
    return "\n".join(L)


def write_csv(report: GapReport, path: str) -> None:
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow([
            "category", "label", "demand", "demand_low", "demand_high",
            "supply", "supply_low", "supply_high", "establishments",
            "gap", "gap_conservative", "leakage_ratio",
            "startup_capital", "opportunity_score",
            "chain_dominated", "weak_supply_estimate",
        ])
        for r in sorted(report.results, key=lambda x: x.opportunity_score, reverse=True):
            w.writerow([
                r.category, r.label,
                round(r.demand.value), round(r.demand.low), round(r.demand.high),
                round(r.supply.value), round(r.supply.low), round(r.supply.high),
                r.establishments,
                round(r.gap), round(r.gap_low), round(r.leakage_ratio, 4),
                r.startup_capital, round(r.opportunity_score, 4),
                r.chain_dominated, r.used_fallback,
            ])


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="flowatlas",
        description="Retail gap analysis for any US county, on free public data.",
    )
    p.add_argument("--county", help="5-digit county FIPS, e.g. 06073 for San Diego")
    p.add_argument("--live", action="store_true",
                   help="pull from the Census API instead of a fixture")
    p.add_argument("--fixture", default="fixtures/demo_county.json",
                   help="path to a fixture file (default: the synthetic demo county)")
    p.add_argument("--census-key", help="Census API key; or set CENSUS_API_KEY")
    p.add_argument("--acs-year", type=int, default=2022)
    p.add_argument("--cbp-year", type=int, default=2022)
    p.add_argument("--top", type=int, default=8, help="how many leakage rows to print")
    p.add_argument("--csv", help="also write the full table to this path")
    args = p.parse_args(argv)

    if args.live:
        if not args.county or len(args.county) != 5:
            p.error("--live needs --county as a 5-digit FIPS code")
        state, county = args.county[:2], args.county[2:]
        client = CensusClient(api_key=args.census_key,
                              acs_year=args.acs_year, cbp_year=args.cbp_year)
    else:
        state = county = ""
        client = FixtureClient(args.fixture)

    try:
        area = client.area_profile(state, county)
        records = client.business_patterns(state, county)
    except SourceError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if area.is_empty:
        print("error: no households returned for that area — check the FIPS code",
              file=sys.stderr)
        return 3

    report = build_report(area, records)
    print(render(report, top=args.top))

    if args.csv:
        write_csv(report, args.csv)
        print(f"\nwrote {args.csv}")
    if not args.live:
        print("\nNOTE: synthetic fixture data. Re-run with --live --county <FIPS> "
              "for a real place.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
