"""The three models compared: a no-information baseline, a Poisson GLM (how
most insurers still file their rates) and a Poisson gradient-boosted model.

Every model predicts the expected number of claims for a policy's own
exposure, via log(exposure) as an offset, so a policy on cover for three
months is expected to claim a quarter as often as a full-year one.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import lightgbm as lgb
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

from .features import GBM_CATEGORICAL, GLM_FORMULA, gbm_frame, glm_frame


class NullModel:
    """Portfolio average frequency for everyone: the bar any model must clear."""

    def fit(self, df: pd.DataFrame) -> "NullModel":
        self.freq = df["ClaimNb"].sum() / df["Exposure"].sum()
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        return self.freq * df["Exposure"].to_numpy()


class PoissonGLM:
    def fit(self, df: pd.DataFrame) -> "PoissonGLM":
        data = glm_frame(df).assign(ClaimNb=df["ClaimNb"].to_numpy())
        self.result = smf.glm(GLM_FORMULA, data=data, family=sm.families.Poisson(), offset=np.log(df["Exposure"].to_numpy())).fit()
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        return np.asarray(self.result.predict(glm_frame(df), offset=np.log(df["Exposure"].to_numpy())))


@dataclass
class PoissonGBM:
    params: dict = field(default_factory=dict)
    num_boost_round: int | None = None
    base: float = 0.0

    BASE = dict(
        objective="poisson",
        learning_rate=0.05,
        feature_fraction=0.8,
        bagging_fraction=0.8,
        bagging_freq=1,
        lambda_l2=1.0,
        max_cat_to_onehot=4,
        cat_smooth=50,
        verbose=-1,
        num_threads=2,
        seed=7,
    )

    def _params(self, columns: list[str]) -> dict:
        # A worse bonus-malus score should never lower the predicted frequency:
        # the constraint keeps the model consistent with how the rating works.
        mono = [1 if c == "BonusMalus" else 0 for c in columns]
        return {**self.BASE, **self.params, "monotone_constraints": mono}

    def _dataset(self, df: pd.DataFrame, reference=None) -> lgb.Dataset:
        # Offset = log(exposure) + log(portfolio frequency), so the trees start
        # from the average risk and only have to learn deviations from it.
        X = gbm_frame(df)
        return lgb.Dataset(
            X, label=df["ClaimNb"].to_numpy(), init_score=np.log(df["Exposure"].to_numpy()) + self.base,
            categorical_feature=GBM_CATEGORICAL, reference=reference, free_raw_data=False,
        )

    def fit(self, df: pd.DataFrame, valid: pd.DataFrame | None = None, max_rounds: int = 3000) -> "PoissonGBM":
        self.base = float(np.log(df["ClaimNb"].sum() / df["Exposure"].sum()))
        train = self._dataset(df)
        params = self._params(list(gbm_frame(df.head(1)).columns))
        if valid is not None:
            val = self._dataset(valid, reference=train)
            self.booster = lgb.train(
                params, train, num_boost_round=max_rounds, valid_sets=[val],
                callbacks=[lgb.early_stopping(100, verbose=False)],
            )
            self.num_boost_round = self.booster.best_iteration
        else:
            self.booster = lgb.train(params, train, num_boost_round=self.num_boost_round or 500)
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        raw = self.booster.predict(gbm_frame(df), num_iteration=self.num_boost_round, raw_score=True)
        return np.exp(raw + self.base) * df["Exposure"].to_numpy()
