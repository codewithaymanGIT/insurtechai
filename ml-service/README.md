# Claim frequency model

How often does a motor policy claim? This compares three models on **freMTPL2**, the standard public
benchmark for claim frequency (677,991 French motor third-party liability policies, CASdatasets):

| Model | Test Poisson deviance | Deviance explained | Gini |
|---|---|---|---|
| No model (portfolio average) | 0.25490 | 0.00% | 0.000 |
| Poisson GLM | 0.24402 | 4.27% | 0.280 |
| Poisson GBM (LightGBM) | 0.24012 | 5.80% | 0.317 |

The GBM explains about 36% more deviance than the GLM and ranks risk better, and the double-lift chart
shows the extra structure is real: where the two models disagree, observed claims follow the GBM. Full
results, charts and tuning grid: [reports/REPORT.md](reports/REPORT.md). The web app shows them
interactively at `/insurers/model`, including the GLM as a live rating-table calculator.

This is a method study. It does not price the Indian estimates in the rest of the app.

## Method
- **Cleaning:** exposure capped at 1 year, claims at 4; vehicle age at 20, driver age at 90, bonus-malus at 150.
- **Offset:** every model predicts claims for the policy's own exposure via `log(exposure)`.
- **Leakage:** the dataset repeats drivers across rows with identical rating factors; the 80/20 split and every
  CV fold keep those rows together (`GroupShuffleSplit` / `GroupKFold` on a risk-profile key).
- **GLM:** banded driver age, vehicle age and power; bonus-malus (linear + log); log density; ordinal area;
  brand, fuel and region. Fitted with statsmodels, so coefficients come with confidence intervals.
- **GBM:** LightGBM Poisson objective, starting from the portfolio average, monotone increasing in bonus-malus,
  9-point grid on a validation split carved from training data with early stopping.
- **Evaluation:** 5-fold grouped CV on training data, then the test set scored once. Poisson deviance, deviance
  explained, exposure-weighted Gini (Lorenz curve), calibration by decile, double lift, SHAP.

## Run it
```bash
cd ml-service
python -m venv .venv && .venv\Scripts\activate      # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python train.py        # downloads the data (~9 MB) on first run; ~5 minutes
pytest                 # metric and model sanity tests
```
`train.py` writes `reports/` (JSON, charts, REPORT.md), `models/glm_rating_table.json`, and
`frontend/src/data/frequency-report.json`, which the web app reads. The frontend test
`frequencyModel.test.ts` checks the in-browser GLM against statsmodels' predictions.

## Layout
```
claims_frequency/data.py      download, cleaning, risk-profile grouping key
claims_frequency/features.py  GLM bands and GBM features
claims_frequency/models.py    null model, Poisson GLM, Poisson GBM
claims_frequency/metrics.py   deviance, Gini/Lorenz, calibration, double lift
train.py                      tuning, CV, test evaluation, report
tests/                        pytest
```

## Data
Dutang, C. & Charpentier, A. *CASdatasets: Insurance datasets* (R package),
https://github.com/dutangc/CASdatasets. Not redistributed here; `train.py` downloads it.

## References
- Noll, A., Salzmann, R. & Wüthrich, M. V. (2018). *Case Study: French Motor Third-Party Liability Claims.* SSRN 3164764.
- Wüthrich, M. V. & Merz, M. (2023). *Statistical Foundations of Actuarial Learning and its Applications.* Springer.
