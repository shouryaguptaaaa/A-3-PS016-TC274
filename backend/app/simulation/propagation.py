"""Log-distance path-loss model.

    PL(d) = PL_ref + 10 * n * log10(max(d, d0) / d0)        [dB]
    RSRP(d) = P_tx - PL(d)                                    [dBm]

d0 is the reference distance at which the path loss equals PL_ref. For
distances below d0 the loss is held at PL_ref (flat near field) to avoid
log10 of zero and unrealistically small losses. No shadowing or fast fading
is modelled; measurement noise is added separately by the engine.
"""
from __future__ import annotations

import numpy as np


def path_loss_db(distance_m, pl_ref_db: float, exponent: float, ref_distance_m: float):
    d = np.maximum(np.asarray(distance_m, dtype=float), ref_distance_m)
    return pl_ref_db + 10.0 * exponent * np.log10(d / ref_distance_m)


def received_power_dbm(
    distance_m, tx_power_dbm: float, pl_ref_db: float, exponent: float, ref_distance_m: float
):
    return tx_power_dbm - path_loss_db(distance_m, pl_ref_db, exponent, ref_distance_m)
