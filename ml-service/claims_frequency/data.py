"""Loading and cleaning the freMTPL2 motor third-party liability dataset.

freMTPL2freq (CASdatasets, Dutang & Charpentier) holds 677,991 French motor
policies observed over roughly one year: exposure in years, number of claims,
and nine rating variables. It's the standard public benchmark for claim
frequency modelling (Noll, Salzmann & Wüthrich, 2018; Wüthrich & Merz, 2023).
"""
from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

SOURCE_URL = "https://raw.githubusercontent.com/dutangc/CASdatasets/master/data/freMTPL2freq.rda"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "freMTPL2freq.rda"
CACHE_PATH = DATA_DIR / "freMTPL2freq.pkl"

RATING_FACTORS = ["VehPower", "VehAge", "DrivAge", "BonusMalus", "VehBrand", "VehGas", "Area", "Density", "Region"]


def download(force: bool = False) -> Path:
    DATA_DIR.mkdir(exist_ok=True)
    if force or not RAW_PATH.exists():
        print(f"Downloading {SOURCE_URL}")
        urllib.request.urlretrieve(SOURCE_URL, RAW_PATH)
    return RAW_PATH


def load_raw() -> pd.DataFrame:
    """The dataset as published, cached as a pickle after the first (slow) read."""
    if CACHE_PATH.exists():
        return pd.read_pickle(CACHE_PATH)
    import rdata  # pure-Python .rda reader; only needed once

    download()
    df = next(iter(rdata.read_rda(str(RAW_PATH)).values()))
    df.to_pickle(CACHE_PATH)
    return df


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    """Standard corrections from the actuarial literature:

    - Exposure above one year is a data error for annual contracts: cap at 1.
    - A handful of policies report 5-16 claims in under a year, far outside
      what the rest of the book supports; cap the count at 4.
    - Cap extreme rating values that only a few policies have (vehicle age 20,
      driver age 90, bonus-malus 150), so no model leans on a few outliers.
    """
    df = raw.copy()
    df["IDpol"] = df["IDpol"].astype(str)
    df["ClaimNb"] = df["ClaimNb"].astype(float).clip(upper=4)
    df["Exposure"] = df["Exposure"].astype(float).clip(upper=1.0)
    for col, cap in {"VehAge": 20, "DrivAge": 90, "BonusMalus": 150, "VehPower": 15}.items():
        df[col] = df[col].astype(float).clip(upper=cap)
    df["Density"] = df["Density"].astype(float)
    for col in ["VehBrand", "VehGas", "Area", "Region"]:
        df[col] = df[col].astype(str)
    return df.reset_index(drop=True)


def risk_profile_key(df: pd.DataFrame) -> np.ndarray:
    """A key shared by rows with identical rating factors.

    The dataset is known to contain the same driver split across several policy
    rows (renewals and mid-term changes) with identical rating factors. If those
    rows land on both sides of a random split, the test set leaks training
    information. Splitting by this key keeps every such group on one side.
    """
    joined = df[RATING_FACTORS].astype(str).agg("|".join, axis=1)
    return joined.map(lambda s: int(hashlib.md5(s.encode()).hexdigest()[:12], 16)).to_numpy()
