# Flow Atlas — Phase 0

Retail gap analysis for any US county, built on free public data.

Answers one question: **for each spending category, how much money do local
households send outside this area, and what would it cost to keep it here?**

Phase 0 of the build spec. No paid data, no API keys beyond a free Census key,
no dependencies outside the Python standard library.

## Run it now

```bash
python3 -m flowatlas                      # synthetic demo county, runs offline
python3 run_tests.py                      # 11 tests, no pytest needed
```

## Run it on a real place

Get a free Census API key at https://api.census.gov/data/key_signup.html

```bash
export CENSUS_API_KEY=...
python3 -m flowatlas --live --county 06073 --csv sandiego.csv
```

`--county` takes a 5-digit FIPS code: first two digits state, last three
county. San Diego is `06073`, Cook County IL is `17031`.

## What it does

```
GAP(category, area) = modeled demand − estimated supply
```

**Demand** — Census ACS gives households by income band for the county. Each
band gets a propensity (what share of income is spendable at local businesses)
and a category split. Sums to dollars per category per year.

**Supply** — Census County Business Patterns gives establishments and annual
payroll by NAICS. Payroll times an industry revenue-to-payroll ratio estimates
local revenue. Payroll beats a national revenue-per-store average because it
reflects actual local scale.

CBP suppresses payroll in thin cells for disclosure. The model detects this,
falls back to establishment counts times a national mean, and widens the error
band for that category — every affected row is flagged `weak supply estimate`.

**Ranking** — by gap ÷ startup capital, not by gap alone. Sorting on raw gap
tells everyone to open a grocery store. Sorting on gap per dollar of capital
tells a person what they could actually start.

Every figure is reported as a range. Three stacked models cannot produce a
point estimate honestly.

## The calibration trap

The first version of `RETAIL_PROPENSITY` was low by about half, and nothing
caught it until the output looked implausible by eye — supply came out at
twice demand for a generic county.

`tests/test_model.py::test_national_calibration` now pins it: run the demand
model against a nationally representative income distribution and it must
produce $40–55K of retail-addressable spend per household, because US retail
excluding motor vehicle dealers plus food service runs about $6.5T across
~132M households.

**Re-run that test after touching any reference table.** Every number in
`reference.py` is a tunable assumption, and a plausible-looking individual
value can still break the aggregate.

## Reading the output — the part that matters

A large gap in a low-income area is usually *why the gap still exists*. Those
numbers were visible to everyone who looked before, and the market did not
fill them, because absolute purchasing power is low and margins are thin.

So the tool never reports a gap alone. It reports:

- the gap, as a range, with a conservative floor
- the capital required to enter
- whether the category is chain-dominated (a local entrant is unlikely to win)
- whether the supply estimate is weak

A ranking like this can be read in both directions — as where to invest, or
as where to avoid. That second reading is redlining with better data. Keep the
defaults pointed at underserved density as opportunity, and do not add a raw
"avoid" score.

## Layout

```
flowatlas/
  reference.py   spend propensities, category splits, NAICS crosswalk,
                 revenue ratios, startup capital — all the assumptions
  sources.py     Census ACS + CBP clients, disk cache, offline fixtures,
                 plus USAspending and FDIC helpers for context
  model.py       demand, supply, gap, confidence bands, ranking
  cli.py         terminal report and CSV export
fixtures/
  demo_county.json   SYNTHETIC. Never quote as a finding about a real place.
tests/
```

## Known gaps in this phase

- **Trade area is the whole county.** Real trade areas are drive-time
  isochrones. Hook OSRM or Valhalla against OpenStreetMap and swap the
  geography; the model doesn't care what shape the area is.
- **No POI layer yet.** Overture Maps and Foursquare OS Places give ~100M
  permissively-licensed US points. That upgrades establishment counts from
  CBP's suppressed bands to actual named businesses at actual addresses.
- **No commercial rent or vacancy.** A perfect gap with no leasable storefront
  is not an opportunity.
- **ACS margins of error are not propagated.** Block-group estimates are wide;
  the current error bands cover model error only, not sampling error.
- **CBP data runs ~2 years behind.** Label the vintage in any UI.

## Note on this environment

Built in a sandbox where `api.census.gov`, `api.usaspending.gov` and
`banks.data.fdic.gov` are blocked by egress policy, so `--live` has never been
executed against the real APIs. The request shapes follow current public API
documentation but should be verified on first real run. The offline path is
fully exercised.
