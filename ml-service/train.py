"""Claim frequency study on freMTPL2: null model vs Poisson GLM vs Poisson GBM.

    pip install -r requirements.txt
    python train.py            # ~10 minutes on a laptop

Writes:
    reports/frequency_report.json   everything the web app's Model page shows
    reports/*.png, reports/REPORT.md  the same results for reading on GitHub
    models/glm_rating_table.json    the fitted GLM as a rating table (used by the
                                    in-browser calculator)
    models/gbm.txt                  the LightGBM model (not committed; rebuild with this script)

Method (details in REPORT.md):
    1. Clean: cap exposure at 1 year, claims at 4, extreme rating values.
    2. Split 80/20 by risk profile, so the same driver's rows never appear in
       both training and test data.
    3. Tune the GBM on a validation split carved out of training data only.
    4. 5-fold grouped cross-validation on training data for stability.
    5. Score the untouched test set once.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

from claims_frequency.data import RATING_FACTORS, SOURCE_URL, clean, load_raw, risk_profile_key
from claims_frequency.features import AREA_ORDER, GLM_BASE_LEVELS, gbm_frame
from claims_frequency.metrics import calibration_by_decile, double_lift, gini, lorenz_curve, poisson_deviance
from claims_frequency.models import NullModel, PoissonGBM, PoissonGLM

ROOT = Path(__file__).resolve().parent
REPORTS = ROOT / "reports"
MODELS = ROOT / "models"
WEB_REPORT = ROOT.parent / "frontend" / "src" / "data" / "frequency-report.json"
SEED = 42
GRID = [
    {"num_leaves": nl, "min_data_in_leaf": md}
    for nl in (15, 31, 63)
    for md in (300, 1000, 3000)
]


def r(x, n=5):
    return None if x is None else float(round(float(x), n))


def evaluate(y, mu, e, null_dev):
    dev = poisson_deviance(y, mu)
    return {
        "deviance": r(dev, 6),
        "devianceExplained": r(1 - dev / null_dev, 4),
        "gini": r(gini(y, mu, e), 4),
        "predictedToActual": r(mu.sum() / y.sum(), 4),
    }


def tune_gbm(train: pd.DataFrame, groups: np.ndarray):
    tr, va = next(GroupShuffleSplit(1, test_size=0.15, random_state=SEED).split(train, groups=groups))
    fit, val = train.iloc[tr], train.iloc[va]
    y, e = val["ClaimNb"].to_numpy(), val["Exposure"].to_numpy()
    rows = []
    for params in GRID:
        t = time.time()
        m = PoissonGBM(params).fit(fit, val)
        dev = poisson_deviance(y, m.predict(val))
        rows.append({**params, "rounds": m.num_boost_round, "validDeviance": r(dev, 6)})
        print(f"  {params} rounds={m.num_boost_round} dev={dev:.5f} ({time.time() - t:.0f}s)")
    best = min(rows, key=lambda x: x["validDeviance"])
    return {"num_leaves": best["num_leaves"], "min_data_in_leaf": best["min_data_in_leaf"]}, best["rounds"], rows


def cross_validate(train: pd.DataFrame, groups: np.ndarray, gbm_params: dict, rounds: int):
    scores = {"null": [], "glm": [], "gbm": []}
    for k, (tr, va) in enumerate(GroupKFold(n_splits=5).split(train, groups=groups)):
        a, b = train.iloc[tr], train.iloc[va]
        y, e = b["ClaimNb"].to_numpy(), b["Exposure"].to_numpy()
        null_dev = poisson_deviance(y, NullModel().fit(a).predict(b))
        for name, model in [("null", NullModel()), ("glm", PoissonGLM()), ("gbm", PoissonGBM(gbm_params, rounds))]:
            mu = model.fit(a).predict(b)
            scores[name].append(evaluate(y, mu, e, null_dev))
        print(f"  fold {k + 1}: glm {scores['glm'][-1]['deviance']:.5f}  gbm {scores['gbm'][-1]['deviance']:.5f}")
    summary = {}
    for name, folds in scores.items():
        summary[name] = {
            metric: {"mean": r(np.mean([f[metric] for f in folds]), 6), "sd": r(np.std([f[metric] for f in folds], ddof=1), 6)}
            for metric in ["deviance", "devianceExplained", "gini"]
        }
    return summary


# ---------------------------------------------------------------------------
# GLM as a rating table
# ---------------------------------------------------------------------------
TERM = re.compile(r"C\((\w+), Treatment\('[^']*'\)\)\[T\.(.+)\]")


def rating_table(glm: PoissonGLM, train: pd.DataFrame):
    params = glm.result.params
    ci = glm.result.conf_int()
    table = {"intercept": r(params["Intercept"], 8), "factors": {}, "continuous": {}}
    for name, coef in params.items():
        m = TERM.match(name)
        if m:
            factor, level = m.groups()
            table["factors"].setdefault(factor, {GLM_BASE_LEVELS[factor]: {"coef": 0.0, "lo": 0.0, "hi": 0.0}})
            table["factors"][factor][level] = {"coef": r(coef, 8), "lo": r(ci.loc[name, 0], 8), "hi": r(ci.loc[name, 1], 8)}
        elif name != "Intercept":
            table["continuous"][name] = r(coef, 8)
    return table


def relativity_views(table: dict, train: pd.DataFrame):
    """Relativities (exp of coefficients) for display, with exposure shares."""
    from claims_frequency.features import glm_frame

    g = glm_frame(train).assign(Exposure=train["Exposure"].to_numpy())
    total = g["Exposure"].sum()
    out = {}
    for factor, levels in table["factors"].items():
        share = g.groupby(factor)["Exposure"].sum() / total
        rows = [
            {"level": lvl, "relativity": r(np.exp(v["coef"]), 4), "lo": r(np.exp(v["lo"]), 4), "hi": r(np.exp(v["hi"]), 4), "exposureShare": r(share.get(lvl, 0), 4)}
            for lvl, v in levels.items()
        ]
        out[factor] = sorted(rows, key=lambda x: x["level"])
    c = table["continuous"]
    bm = np.arange(50, 151, 5)
    out["BonusMalus"] = [{"x": int(x), "relativity": r(np.exp(c["BonusMalus"] * (x - 50) + c["LogBonusMalus"] * np.log(x / 50)), 4)} for x in bm]
    dens = [10, 30, 100, 300, 1000, 3000, 10000, 27000]
    out["Density"] = [{"x": d, "relativity": r((d / 100) ** c["LogDensity"], 4)} for d in dens]
    out["Area"] = [{"x": a, "relativity": r(np.exp(c["AreaCode"] * (code - 3)), 4)} for a, code in AREA_ORDER.items()]
    # Order the banded factors naturally for charts.
    order = {"DrivAgeBand": ["18-20", "21-25", "26-30", "31-40", "41-50", "51-70", "71+"], "VehAgeBand": ["0", "1-10", "11+"]}
    for f, lv in order.items():
        out[f] = sorted(out[f], key=lambda x: lv.index(x["level"]))
    out["VehPowerCat"] = sorted(out["VehPowerCat"], key=lambda x: int(x["level"]))
    out["VehBrand"] = sorted(out["VehBrand"], key=lambda x: int(x["level"][1:]))
    out["Region"] = sorted(out["Region"], key=lambda x: -x["exposureShare"])
    return out


# ---------------------------------------------------------------------------
# SHAP
# ---------------------------------------------------------------------------
LABELS = {
    "BonusMalus": "Bonus-malus level", "DrivAge": "Driver age", "VehAge": "Vehicle age", "VehPower": "Vehicle power",
    "LogDensity": "Population density", "AreaCode": "Area type", "VehBrand": "Vehicle brand", "VehGas": "Fuel", "Region": "Region",
}


def shap_views(gbm: PoissonGBM, test: pd.DataFrame, n: int = 6000):
    sample = test.sample(n, random_state=SEED)
    X = gbm_frame(sample)
    explainer = shap.TreeExplainer(gbm.booster)
    values = explainer.shap_values(X)  # log-frequency contributions
    importance = sorted(
        ({"feature": c, "label": LABELS[c], "meanAbs": r(np.abs(values[:, i]).mean(), 5)} for i, c in enumerate(X.columns)),
        key=lambda x: -x["meanAbs"],
    )
    dependence = {}
    specs = {
        "DrivAge": lambda s: s.clip(18, 85) // 3 * 3,
        "BonusMalus": lambda s: (s // 5 * 5).clip(50, 125),
        "VehAge": lambda s: s.clip(0, 20),
        "LogDensity": lambda s: np.round(s * 2) / 2,
    }
    for col, binner in specs.items():
        i = list(X.columns).index(col)
        df = pd.DataFrame({"x": binner(X[col].astype(float)), "s": values[:, i]}).groupby("x")["s"].agg(["mean", "count"])
        df = df[df["count"] >= 25]
        xs = np.exp(df.index) if col == "LogDensity" else df.index
        dependence[col] = [{"x": r(x, 1), "effect": r(np.exp(m), 4), "n": int(c)} for x, m, c in zip(xs, df["mean"], df["count"])]
    return {"sampleSize": n, "importance": importance, "dependence": dependence}


# ---------------------------------------------------------------------------
# Charts for GitHub readers
# ---------------------------------------------------------------------------
def charts(report: dict):
    REPORTS.mkdir(exist_ok=True)
    plt.rcParams.update({"figure.dpi": 130, "font.size": 9, "axes.spines.top": False, "axes.spines.right": False})
    colors = {"null": "#9aa0a6", "glm": "#4c78a8", "gbm": "#e45756"}

    lz = report["lorenz"]
    fig, ax = plt.subplots(figsize=(4.6, 4.2))
    ax.plot([0, 1], [0, 1], color=colors["null"], lw=1, ls="--", label="No model (Gini 0)")
    for k in ("glm", "gbm"):
        g = next(m for m in report["models"] if m["id"] == k)["test"]["gini"]
        ax.plot(lz["x"], lz[k], color=colors[k], lw=1.6, label=f"{k.upper()} (Gini {g:.3f})")
    ax.set(xlabel="Share of exposure, lowest predicted risk first", ylabel="Share of claims", title="Lorenz curve, test set")
    ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(REPORTS / "lorenz.png"); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 3.6))
    cal = report["calibration"]
    x = np.arange(1, 11)
    ax.bar(x - 0.2, [c["observed"] for c in cal["gbm"]], width=0.4, color="#c7c7c7", label="Observed")
    ax.plot(x, [c["predicted"] for c in cal["gbm"]], "o-", color=colors["gbm"], label="GBM predicted")
    ax.plot(x, [c["predicted"] for c in cal["glm"]], "s--", color=colors["glm"], ms=3, label="GLM predicted")
    ax.set(xlabel="Decile of predicted frequency (equal exposure)", ylabel="Claims per policy-year", title="Calibration by decile, test set")
    ax.set_xticks(x); ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(REPORTS / "calibration.png"); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 3.6))
    dl = report["doubleLift"]
    ax.plot(x, [d["observed"] for d in dl], "o-", color="#333", label="Observed")
    ax.plot(x, [d["glm"] for d in dl], "s--", color=colors["glm"], label="GLM")
    ax.plot(x, [d["gbm"] for d in dl], "^-", color=colors["gbm"], label="GBM")
    ax.set(xlabel="Decile of GBM ÷ GLM prediction", ylabel="Claims per policy-year", title="Double lift: where the models disagree")
    ax.set_xticks(x); ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(REPORTS / "double_lift.png"); plt.close(fig)


def markdown(report: dict) -> str:
    ds, sp = report["dataset"], report["split"]
    rows = "\n".join(
        f"| {m['name']} | {m['test']['deviance']:.5f} | {m['test']['devianceExplained'] * 100:.2f}% | {m['test']['gini']:.3f} | "
        f"{m['test']['predictedToActual']:.3f} | {m['cv']['deviance']['mean']:.5f} ± {m['cv']['deviance']['sd']:.5f} |"
        for m in report["models"]
    )
    imp = "\n".join(f"| {i['label']} | {i['meanAbs']:.3f} |" for i in report["shap"]["importance"])
    grid = "\n".join(f"| {g['num_leaves']} | {g['min_data_in_leaf']} | {g['rounds']} | {g['validDeviance']:.5f} |" for g in report["gbm"]["tuning"])
    return f"""# Claim frequency model: GLM vs gradient boosting on freMTPL2

Generated by `train.py` on {report['generatedAt']}.

## Data
- **freMTPL2freq** (CASdatasets): {ds['policies']:,} French motor TPL policies, {ds['exposureYears']:,.0f} policy-years, {ds['claims']:,.0f} claims, portfolio frequency {ds['frequency']:.4f} claims per year.
- Cleaning: exposure capped at 1 year, claim count at 4, vehicle age at 20, driver age at 90, bonus-malus at 150.
- Split: {sp['method']} Train {sp['trainPolicies']:,} / test {sp['testPolicies']:,} policies. The test set was scored once, after all tuning.

## Models
All three predict expected claims with log(exposure) as an offset.
1. **Null**: portfolio average frequency for everyone.
2. **Poisson GLM**: banded driver age, vehicle age and power, bonus-malus (linear + log), log density, area (ordinal), brand, fuel, region. This is how most insurers file rates.
3. **Poisson GBM** (LightGBM): capped raw variables, monotone increasing in bonus-malus, early stopping on a validation split of the training data.

## Results (test set)

| Model | Mean Poisson deviance | Deviance explained | Gini | Predicted ÷ actual claims | 5-fold CV deviance |
|---|---|---|---|---|---|
{rows}

![Lorenz](lorenz.png)
![Calibration](calibration.png)
![Double lift](double_lift.png)

## GBM tuning (validation split inside training data)

| num_leaves | min_data_in_leaf | rounds | validation deviance |
|---|---|---|---|
{grid}

## What drives the GBM (mean |SHAP| on log-frequency, {report['shap']['sampleSize']:,} test policies)

| Feature | Mean abs. SHAP |
|---|---|
{imp}

## Caveats
- French data from the 2000s. It demonstrates the method; the relativities don't apply to Indian motor pricing.
- Frequency only. A full technical price also needs a severity model (claim cost), expenses and loadings.
- Deviance differences look small because most policies have no claim; relative gains and the Gini are the fairer comparison.
"""


def main():
    t0 = time.time()
    df = clean(load_raw())
    groups = risk_profile_key(df)
    tr, te = next(GroupShuffleSplit(1, test_size=0.2, random_state=SEED).split(df, groups=groups))
    train, test = df.iloc[tr].reset_index(drop=True), df.iloc[te].reset_index(drop=True)
    g_train = groups[tr]
    print(f"train {len(train):,}  test {len(test):,}")

    print("Tuning GBM")
    gbm_params, rounds, tuning = tune_gbm(train, g_train)
    print(f"  best {gbm_params} rounds={rounds}")

    print("5-fold grouped CV")
    cv = cross_validate(train, g_train, gbm_params, rounds)

    print("Final fit and test")
    null = NullModel().fit(train)
    glm = PoissonGLM().fit(train)
    gbm = PoissonGBM(gbm_params, rounds).fit(train)
    y, e = test["ClaimNb"].to_numpy(), test["Exposure"].to_numpy()
    preds = {"null": null.predict(test), "glm": glm.predict(test), "gbm": gbm.predict(test)}
    null_dev = poisson_deviance(y, preds["null"])
    names = {"null": "No model (portfolio average)", "glm": "Poisson GLM", "gbm": "Poisson GBM (LightGBM)"}
    models = [{"id": k, "name": names[k], "test": evaluate(y, preds[k], e, null_dev), "cv": cv[k]} for k in preds]

    grid, lz = {}, {}
    for k in preds:
        x, yy = lorenz_curve(y, preds[k], e)
        grid, lz[k] = x, yy
    table = rating_table(glm, train)

    report = {
        "generatedAt": date.today().isoformat(),
        "dataset": {
            "name": "freMTPL2freq",
            "source": SOURCE_URL,
            "citation": "Dutang, C. & Charpentier, A. CASdatasets: Insurance datasets (R package).",
            "policies": int(len(df)),
            "exposureYears": r(df["Exposure"].sum(), 1),
            "claims": r(df["ClaimNb"].sum(), 0),
            "frequency": r(df["ClaimNb"].sum() / df["Exposure"].sum(), 5),
            "ratingFactors": RATING_FACTORS,
        },
        "split": {
            "method": "80/20 split by risk profile (rows with identical rating factors stay together), seed 42.",
            "trainPolicies": int(len(train)),
            "testPolicies": int(len(test)),
            "riskProfiles": int(len(np.unique(groups))),
        },
        "models": models,
        "gbm": {"params": {**PoissonGBM.BASE, **gbm_params, "monotone": "BonusMalus increasing"}, "rounds": int(rounds), "logBaseFrequency": r(gbm.base, 8), "tuning": tuning},
        "lorenz": {"x": [r(v, 3) for v in grid], **{k: [r(v, 4) for v in lz[k]] for k in lz}},
        "calibration": {
            k: [{"decile": int(b + 1), "observed": r(o, 5), "predicted": r(p, 5)} for b, o, p in calibration_by_decile(y, preds[k], e)[["band", "observed_freq", "predicted_freq"]].itertuples(index=False)]
            for k in ("glm", "gbm")
        },
        "doubleLift": [
            {"decile": int(b + 1), "observed": r(o, 5), "glm": r(a, 5), "gbm": r(g, 5)}
            for b, o, a, g in double_lift(y, preds["glm"], preds["gbm"], e)[["band", "claims_freq", "a_freq", "b_freq"]].itertuples(index=False)
        ],
        "glm": {"ratingTable": table, "relativities": relativity_views(table, train), "baseLevels": GLM_BASE_LEVELS},
        "shap": shap_views(gbm, test),
        # Test rows with the GLM's own predictions, so the in-browser calculator
        # can be checked against statsmodels (frontend unit test).
        "calculatorChecks": [
            {**{k: (row[k] if isinstance(row[k], str) else float(row[k])) for k in RATING_FACTORS}, "frequency": r(glm.predict(row.to_frame().T.assign(Exposure=1.0).astype(test.dtypes.to_dict()))[0], 8)}
            for _, row in test.sample(8, random_state=SEED).iterrows()
        ],
    }

    REPORTS.mkdir(exist_ok=True)
    MODELS.mkdir(exist_ok=True)
    (REPORTS / "frequency_report.json").write_text(json.dumps(report, indent=1))
    (MODELS / "glm_rating_table.json").write_text(json.dumps(table, indent=1))
    gbm.booster.save_model(str(MODELS / "gbm.txt"), num_iteration=rounds)
    WEB_REPORT.parent.mkdir(parents=True, exist_ok=True)
    WEB_REPORT.write_text(json.dumps(report, separators=(",", ":")))
    charts(report)
    (REPORTS / "REPORT.md").write_text(markdown(report))
    for m in models:
        print(f"{m['name']:32s} dev {m['test']['deviance']:.5f}  D2 {m['test']['devianceExplained']:.4f}  gini {m['test']['gini']:.4f}  P/A {m['test']['predictedToActual']:.4f}")
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
