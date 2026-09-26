"""Evaluation metrics for exposure-weighted claim frequency models.

All predictions here are expected claim counts for the policy's own exposure
(frequency x exposure), so actual and predicted totals are directly comparable.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def poisson_deviance(y: np.ndarray, mu: np.ndarray) -> float:
    """Mean unit Poisson deviance per policy (lower is better).

    2 * [y log(y/mu) - (y - mu)], with y log y = 0 when y = 0.
    """
    y = np.asarray(y, float)
    mu = np.clip(np.asarray(mu, float), 1e-12, None)
    term = np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0.0)
    return float(np.mean(2 * (term - (y - mu))))


def _ordered_cumulative(y, mu, exposure):
    """Cumulative exposure and claim shares, policies ordered by predicted
    frequency. Tied predictions are pooled so their order can't matter
    (a constant model then scores exactly 0)."""
    freq = np.round(np.asarray(mu, float) / exposure, 12)
    df = pd.DataFrame({"f": freq, "e": exposure, "y": y}).groupby("f", sort=True)[["e", "y"]].sum()
    cum_exp = np.concatenate([[0.0], np.cumsum(df["e"].to_numpy()) / exposure.sum()])
    cum_claims = np.concatenate([[0.0], np.cumsum(df["y"].to_numpy()) / np.sum(y)])
    return cum_exp, cum_claims


def lorenz_curve(y: np.ndarray, mu: np.ndarray, exposure: np.ndarray, points: int = 51):
    """Cumulative share of claims against cumulative share of exposure, with
    policies ordered from lowest to highest predicted frequency."""
    cum_exp, cum_claims = _ordered_cumulative(y, mu, exposure)
    grid = np.linspace(0, 1, points)
    return grid, np.interp(grid, cum_exp, cum_claims)


def gini(y: np.ndarray, mu: np.ndarray, exposure: np.ndarray) -> float:
    """Exposure-weighted Gini index: 1 - 2 x area under the Lorenz curve.

    0 means the model can't rank risks at all; higher means the riskiest
    predicted policies really do carry more of the claims.
    """
    cum_exp, cum_claims = _ordered_cumulative(y, mu, exposure)
    return float(1 - 2 * np.trapezoid(cum_claims, cum_exp))


def calibration_by_decile(y, mu, exposure, deciles: int = 10) -> pd.DataFrame:
    """Observed vs predicted frequency in equal-exposure bands of predicted frequency."""
    freq = mu / exposure
    order = np.argsort(freq, kind="stable")
    cum = np.cumsum(exposure[order]) / exposure.sum()
    band = np.minimum((cum * deciles).astype(int), deciles - 1)
    df = pd.DataFrame({"band": band, "y": y[order], "mu": mu[order], "e": exposure[order]})
    g = df.groupby("band").agg(claims=("y", "sum"), predicted=("mu", "sum"), exposure=("e", "sum"))
    g["observed_freq"] = g["claims"] / g["exposure"]
    g["predicted_freq"] = g["predicted"] / g["exposure"]
    return g.reset_index()


def double_lift(y, mu_a, mu_b, exposure, bands: int = 10) -> pd.DataFrame:
    """Sort by the ratio of model B to model A and compare both against actuals.

    Where the two models disagree most, whichever tracks the observed
    frequency is the better model.
    """
    ratio = mu_b / mu_a
    order = np.argsort(ratio, kind="stable")
    cum = np.cumsum(exposure[order]) / exposure.sum()
    band = np.minimum((cum * bands).astype(int), bands - 1)
    df = pd.DataFrame({"band": band, "y": y[order], "a": mu_a[order], "b": mu_b[order], "e": exposure[order]})
    g = df.groupby("band").agg(claims=("y", "sum"), a=("a", "sum"), b=("b", "sum"), exposure=("e", "sum"))
    for c in ["claims", "a", "b"]:
        g[c + "_freq"] = g[c] / g["exposure"]
    return g.reset_index()
