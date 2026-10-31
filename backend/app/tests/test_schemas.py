import pytest
from pydantic import ValidationError

from app.schemas.simulation import CompareRequest, SimulationConfig


def test_defaults_match_specification():
    c = SimulationConfig()
    assert (c.scenario_name, c.num_cells, c.duration_s, c.speed_kmh) == ("Corridor mobility test", 3, 60.0, 60.0)
    assert (c.time_step_s, c.noise_std_db, c.hysteresis_db, c.ttt_s, c.exec_delay_s) == (0.5, 2.0, 3.0, 1.0, 0.5)
    assert (c.min_signal_dbm, c.tx_power_dbm, c.path_loss_ref_db, c.path_loss_exponent, c.seed) == (-110.0, -30.0, 38.0, 3.2, 42)


@pytest.mark.parametrize("field,value", [
    ("num_cells", 1), ("num_cells", 11), ("duration_s", 1), ("duration_s", 9999), ("speed_kmh", 0),
    ("speed_kmh", 1000), ("time_step_s", 0.001), ("noise_std_db", -1), ("hysteresis_db", 99),
    ("ttt_s", -1), ("exec_delay_s", 50), ("min_signal_dbm", -10), ("path_loss_exponent", 0.5), ("seed", -1),
])
def test_out_of_range_values_rejected(field, value):
    with pytest.raises(ValidationError):
        SimulationConfig(**{field: value})


def test_non_finite_numbers_rejected():
    with pytest.raises(ValidationError):
        SimulationConfig(speed_kmh=float("nan"))


@pytest.mark.parametrize("name", ["", "   ", "<script>alert(1)</script>", "bad\x00name"])
def test_scenario_name_sanitised(name):
    with pytest.raises(ValidationError):
        SimulationConfig(scenario_name=name)


def test_name_is_trimmed():
    assert SimulationConfig(scenario_name="  Test A  ").scenario_name == "Test A"


def test_unknown_fields_and_algorithms_rejected():
    with pytest.raises(ValidationError):
        SimulationConfig(shell="rm -rf /")
    with pytest.raises(ValidationError):
        SimulationConfig(algorithms=["magic"])
    with pytest.raises(ValidationError):
        SimulationConfig(algorithms=[])
    with pytest.raises(ValidationError):
        SimulationConfig(algorithms=["baseline", "baseline"])


def test_computational_load_limits():
    SimulationConfig(duration_s=600, time_step_s=0.05)  # 12000 steps x 3 cells is allowed
    with pytest.raises(ValidationError):
        SimulationConfig(duration_s=600, time_step_s=0.05, num_cells=10)  # 120000 samples > limit


def test_to_params_roundtrip():
    p = SimulationConfig(speed_kmh=90).to_params()
    assert p.speed_kmh == 90 and p.algorithms == ("baseline", "proposed")


def test_compare_request_validation():
    assert CompareRequest(experiment_ids=[1, 2]).experiment_ids == [1, 2]
    with pytest.raises(ValidationError):
        CompareRequest(experiment_ids=[1])
    with pytest.raises(ValidationError):
        CompareRequest(experiment_ids=[1, 1])
