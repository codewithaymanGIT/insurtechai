import numpy as np
import pandas as pd
import pytest

from claims_frequency.data import clean, risk_profile_key
from claims_frequency.metrics import calibration_by_decile, gini, lorenz_curve, poisson_deviance
from claims_frequency.models import NullModel, PoissonGBM, PoissonGLM

rng = np.random.default_rng(0)


def test_deviance_is_zero_for_perfect_predictions():
    y = np.array([0.0, 1.0, 2.0, 0.0])
    assert poisson_deviance(y, np.where(y > 0, y, 1e-12)) == pytest.approx(0, abs=1e-9)


def test_deviance_matches_closed_form():
    y, mu = np.array([0.0, 2.0]), np.array([0.5, 1.0])
    expected = np.mean([2 * 0.5, 2 * (2 * np.log(2) - 1)])
    assert poisson_deviance(y, mu) == pytest.approx(expected)


def test_constant_model_has_zero_gini():
    y = rng.poisson(0.1, 5000).astype(float)
    e = rng.uniform(0.1, 1, 5000)
    assert gini(y, 0.1 * e, e) == pytest.approx(0, abs=1e-9)


def test_informative_model_beats_random_ranking():
    e = np.ones(20000)
    lam = rng.gamma(2, 0.05, 20000)
    y = rng.poisson(lam).astype(float)
    assert gini(y, lam, e) > 0.2
    assert abs(gini(y, rng.permutation(lam), e)) < 0.05


def test_lorenz_curve_runs_from_origin_to_one():
    y = rng.poisson(0.2, 1000).astype(float)
    e = np.ones(1000)
    x, c = lorenz_curve(y, rng.uniform(size=1000), e)
    assert x[0] == 0 and c[0] == 0 and c[-1] == pytest.approx(1)
    assert np.all(np.diff(c) >= -1e-12)


def test_calibration_bands_cover_all_exposure():
    e = rng.uniform(0.1, 1, 3000)
    mu = rng.uniform(0.05, 0.2, 3000) * e
    y = rng.poisson(mu).astype(float)
    cal = calibration_by_decile(y, mu, e)
    assert len(cal) == 10
    assert cal["exposure"].sum() == pytest.approx(e.sum())
    assert cal["claims"].sum() == pytest.approx(y.sum())


def synthetic_book(n=20000):
    """Small portfolio where driver age and bonus-malus drive frequency."""
    df = pd.DataFrame({
        "IDpol": np.arange(n),
        "Exposure": rng.uniform(0.05, 1.2, n),
        "VehPower": rng.integers(4, 12, n),
        "VehAge": rng.integers(0, 25, n),
        "DrivAge": rng.integers(18, 95, n),
        "BonusMalus": rng.choice([50, 50, 50, 60, 80, 100, 160], n),
        "VehBrand": rng.choice(["B1", "B2", "B12"], n),
        "VehGas": rng.choice(["Regular", "Diesel"], n),
        "Area": rng.choice(list("ABCDEF"), n),
        "Density": rng.integers(10, 20000, n),
        "Region": rng.choice(["Centre", "Bretagne", "Ile-de-France"], n),
    })
    lam = 0.06 * np.exp(0.9 * (df["DrivAge"] < 25) + 0.012 * (df["BonusMalus"].clip(upper=150) - 50))
    df["ClaimNb"] = rng.poisson(lam * df["Exposure"].clip(upper=1)).astype(float)
    return clean(df)


def test_cleaning_caps_exposure_and_ratings():
    df = synthetic_book(2000)
    assert df["Exposure"].max() <= 1 and df["BonusMalus"].max() <= 150 and df["DrivAge"].max() <= 90


def test_identical_profiles_share_a_group_key():
    df = synthetic_book(50)
    dup = pd.concat([df.iloc[[0]], df.iloc[[0]].assign(IDpol="x", Exposure=0.3)], ignore_index=True)
    keys = risk_profile_key(dup)
    assert keys[0] == keys[1]


@pytest.mark.parametrize("model", [lambda: PoissonGLM(), lambda: PoissonGBM({"num_leaves": 7, "min_data_in_leaf": 100}, 150)])
def test_models_are_calibrated_and_beat_the_null_model(model):
    df = synthetic_book()
    train, test = df.iloc[:15000], df.iloc[15000:]
    y, e = test["ClaimNb"].to_numpy(), test["Exposure"].to_numpy()
    mu = model().fit(train).predict(test)
    null = NullModel().fit(train).predict(test)
    assert poisson_deviance(y, mu) < poisson_deviance(y, null)
    assert mu.sum() / y.sum() == pytest.approx(1, abs=0.1)
    assert gini(y, mu, e) > 0.1


def test_exposure_offset_scales_predictions():
    df = synthetic_book()
    glm = PoissonGLM().fit(df)
    row = df.iloc[[0]]
    full, half = glm.predict(row.assign(Exposure=1.0)), glm.predict(row.assign(Exposure=0.5))
    assert half[0] == pytest.approx(full[0] / 2)
