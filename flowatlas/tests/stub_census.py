"""Census-shaped stub responses for exercising the --live path offline.

SYNTHETIC VALUES. These mimic the SHAPE of real Census API responses — a
header row, every value a string, negative sentinels for missing cells, and
NAICS codes at several hierarchy levels in the same response — so the parser
and model can be tested end to end without network. The numbers describe no
real county.
"""

# ACS 5-year, table B19001. Real bucket boundaries:
#   014 $100-124,999   015 $125-149,999   016 $150-199,999   017 $200,000+
ACS = [
    ["NAME", "B19001_001E", "B19013_001E",
     "B19001_002E", "B19001_003E", "B19001_004E", "B19001_005E",
     "B19001_006E", "B19001_007E", "B19001_008E", "B19001_009E", "B19001_010E",
     "B19001_011E", "B19001_012E", "B19001_013E",
     "B19001_014E", "B19001_015E", "B19001_016E", "B19001_017E",
     "state", "county"],
    ["Stub County, Stub State", "100000", "80000",
     "3000", "2000", "2500", "2500",           # lt25     = 10,000
     "2000", "2000", "2000", "2000", "2000",   # 25to50   = 10,000
     "10000", "10000",                          # 50to75   = 20,000
     "20000",                                   # 75to100  = 20,000
     "10000", "10000",                          # 100to150 = 20,000  (014 + 015)
     "10000",                                   # 150to200 = 10,000  (016)
     "10000",                                   # gte200   = 10,000  (017)
     "48", "999"],
]

# CBP returns every NAICS level in one response. Grocery appears FOUR times:
# 445 (sector), 4451 (group), 44511 (industry), 445110 (national industry).
# All four describe the same stores.
CBP = [
    ["NAICS2017", "ESTAB", "PAYANN", "EMP", "state", "county"],
    ["44-45",  "5000", "900000", "90000", "48", "999"],
    ["445",     "100",  "50000",  "3000", "48", "999"],
    ["4451",    "100",  "50000",  "3000", "48", "999"],
    ["44511",   "100",  "50000",  "3000", "48", "999"],
    ["445110",  "100",  "50000",  "3000", "48", "999"],
    ["722",     "400", "120000", "12000", "48", "999"],
    ["7225",    "400", "120000", "12000", "48", "999"],
    ["8121",     "90",      "0",   "400", "48", "999"],   # payroll suppressed
]

NES = [
    ["NAICS2017", "NESTAB", "RCPTOT", "state", "county"],
    ["561730", "900", "45000", "48", "999"],
    ["561720", "600", "24000", "48", "999"],
    ["238",    "700", "63000", "48", "999"],
    ["238220", "300", "30000", "48", "999"],
    ["561790", "150", "9000",  "48", "999"],
]


def fake_get_json(url, **_):
    if "/acs/acs5" in url:
        return ACS
    if "/cbp" in url:
        return CBP
    if "/nonemp" in url:
        return NES
    raise AssertionError(f"unexpected URL in stub: {url}")
