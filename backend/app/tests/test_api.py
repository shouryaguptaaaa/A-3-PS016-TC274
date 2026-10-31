import time


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_create_run_with_defaults_and_valid_metrics(client):
    r = client.post("/api/simulations", json={})
    assert r.status_code == 201
    body = r.json()
    assert body["id"] >= 1 and body["status"] == "completed"
    for name in ("baseline", "proposed"):
        m = body["result"]["algorithms"][name]["metrics"]
        assert m["handover_count"] >= 0 and m["handover_attempts"] >= m["handover_count"]
    assert body["result"]["metadata"]["simulated"] is True


def test_validation_error_returns_422(client):
    assert client.post("/api/simulations", json={"num_cells": 99}).status_code == 422
    assert client.post("/api/simulations", json={"scenario_name": "<b>x</b>"}).status_code == 422
    assert client.post("/api/simulations", json={"unknown": 1}).status_code == 422


def test_list_get_delete_flow(client):
    created = client.post("/api/simulations", json={"scenario_name": "Flow", "duration_s": 10}).json()
    lst = client.get("/api/simulations").json()
    assert lst["total"] == 1 and lst["items"][0]["scenario_name"] == "Flow"
    assert client.get(f"/api/simulations/{created['id']}").status_code == 200
    assert client.get("/api/simulations?search=flo").json()["total"] == 1
    assert client.get("/api/simulations?search=zzz").json()["total"] == 0
    assert client.delete(f"/api/simulations/{created['id']}").status_code == 204
    assert client.get(f"/api/simulations/{created['id']}").status_code == 404
    assert client.delete(f"/api/simulations/{created['id']}").status_code == 404


def test_search_sql_injection_is_inert(client):
    client.post("/api/simulations", json={"duration_s": 10})
    r = client.get("/api/simulations", params={"search": "' OR 1=1 --"})
    assert r.status_code == 200 and r.json()["total"] == 0


def test_compare_saved_experiments(client):
    a = client.post("/api/simulations", json={"duration_s": 10, "speed_kmh": 30}).json()["id"]
    b = client.post("/api/simulations", json={"duration_s": 10, "speed_kmh": 120}).json()["id"]
    r = client.post("/api/simulations/compare", json={"experiment_ids": [a, b]})
    assert r.status_code == 200 and len(r.json()["experiments"]) == 2
    assert client.post("/api/simulations/compare", json={"experiment_ids": [a, 9999]}).status_code == 404
    assert client.post("/api/simulations/compare", json={"experiment_ids": [a]}).status_code == 422


def test_exports(client):
    exp_id = client.post("/api/simulations", json={"duration_s": 10}).json()["id"]
    csv = client.get(f"/api/simulations/{exp_id}/export/csv")
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert csv.text.splitlines()[0].startswith("time_s,x_m,y_m")
    assert "attachment" in csv.headers["content-disposition"]
    assert client.get(f"/api/simulations/{exp_id}/export/csv?kind=events").status_code == 200
    assert client.get(f"/api/simulations/{exp_id}/export/csv?kind=metrics").text.startswith("metric,")
    assert client.get(f"/api/simulations/{exp_id}/export/csv?kind=../../etc/passwd").status_code == 422
    js = client.get(f"/api/simulations/{exp_id}/export/json")
    assert js.status_code == 200 and js.json()["id"] == exp_id and "result" in js.json()
    assert client.get("/api/simulations/9999/export/json").status_code == 404
    pdf = client.get(f"/api/simulations/{exp_id}/report/pdf")
    assert pdf.status_code == 200 and pdf.content[:5] == b"%PDF-"


def _wait(client, job_id, want, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in want:
            return j
        time.sleep(0.05)
    raise AssertionError("job did not reach " + str(want))


def test_live_job_completes_and_is_saved(client):
    r = client.post("/api/jobs", json={"config": {"duration_s": 10}, "step_delay_ms": 0})
    assert r.status_code == 202
    job = _wait(client, r.json()["id"], {"completed", "failed"})
    assert job["status"] == "completed" and job["progress"]["fraction"] == 1.0
    assert len(job["samples"]) == job["progress"]["total_steps"]
    assert client.get(f"/api/simulations/{job['experiment_id']}").status_code == 200


def test_live_job_cancel_and_pause(client):
    jid = client.post("/api/jobs", json={"config": {"duration_s": 60}, "step_delay_ms": 100}).json()["id"]
    assert client.post(f"/api/jobs/{jid}/pause").json()["status"] == "paused"
    assert client.post(f"/api/jobs/{jid}/resume").json()["status"] == "running"
    client.post(f"/api/jobs/{jid}/cancel")
    job = _wait(client, jid, {"cancelled"})
    assert job["experiment_id"] is None
    assert client.get("/api/simulations").json()["total"] == 0  # cancelled runs are not saved


def test_unknown_job_404(client):
    assert client.get("/api/jobs/nope").status_code == 404


def test_overview_empty_then_filled(client):
    assert client.get("/api/stats/overview").json()["total_experiments"] == 0
    client.post("/api/simulations", json={"duration_s": 10})
    assert client.get("/api/stats/overview").json()["total_experiments"] == 1
