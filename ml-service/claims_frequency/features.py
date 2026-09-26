"""Feature engineering for the two model families.

The GLM needs its non-linear effects made explicit (bands, logs), which is also
how an insurer's rating table is structured. The gradient-boosted model gets
the capped raw variables and finds the shapes itself.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Band edges are chosen where the empirical frequency changes slope, following
# Noll, Salzmann & Wüthrich (2018). Each band gets its own relativity.
DRIV_AGE_BANDS = [17, 20, 25, 30, 40, 50, 70, 91]
DRIV_AGE_LABELS = ["18-20", "21-25", "26-30", "31-40", "41-50", "51-70", "71+"]
VEH_AGE_BANDS = [-1, 0, 10, 21]
VEH_AGE_LABELS = ["0", "1-10", "11+"]
AREA_ORDER = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6}

GLM_BASE_LEVELS = {
    "DrivAgeBand": "41-50",
    "VehAgeBand": "1-10",
    "VehPowerCat": "6",
    "VehBrand": "B1",
    "VehGas": "Regular",
    "Region": "Centre",
}

GBM_NUMERIC = ["VehPower", "VehAge", "DrivAge", "BonusMalus", "LogDensity", "AreaCode"]
GBM_CATEGORICAL = ["VehBrand", "VehGas", "Region"]


def glm_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    out["DrivAgeBand"] = pd.cut(df["DrivAge"], DRIV_AGE_BANDS, labels=DRIV_AGE_LABELS).astype(str)
    out["VehAgeBand"] = pd.cut(df["VehAge"], VEH_AGE_BANDS, labels=VEH_AGE_LABELS).astype(str)
    out["VehPowerCat"] = df["VehPower"].clip(upper=9).astype(int).astype(str)
    out["BonusMalus"] = df["BonusMalus"]
    out["LogBonusMalus"] = np.log(df["BonusMalus"])
    out["LogDensity"] = np.log(df["Density"])
    out["AreaCode"] = df["Area"].map(AREA_ORDER).astype(float)
    for col in ["VehBrand", "VehGas", "Region"]:
        out[col] = df[col]
    return out


GLM_FORMULA = (
    "ClaimNb ~ C(DrivAgeBand, Treatment('41-50')) + C(VehAgeBand, Treatment('1-10'))"
    " + C(VehPowerCat, Treatment('6')) + BonusMalus + LogBonusMalus + LogDensity + AreaCode"
    " + C(VehBrand, Treatment('B1')) + C(VehGas, Treatment('Regular')) + C(Region, Treatment('Centre'))"
)


def gbm_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for col in ["VehPower", "VehAge", "DrivAge", "BonusMalus"]:
        out[col] = df[col]
    out["LogDensity"] = np.log(df["Density"])
    out["AreaCode"] = df["Area"].map(AREA_ORDER).astype(float)
    for col in GBM_CATEGORICAL:
        out[col] = df[col].astype("category")
    return out
