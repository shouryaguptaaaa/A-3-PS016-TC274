"""PDF report generation (ReportLab + Matplotlib) from a saved experiment."""
from __future__ import annotations

import io
from typing import Any, Dict, List

LIMITATIONS = [
    "Simplified log-distance path-loss model; no shadowing, fast fading, interference, load or antenna patterns.",
    "Straight-line corridor with constant speed and regularly spaced cells.",
    "Handover success/failure uses deterministic threshold rules, not a full protocol model.",
    "Results describe this scenario and random seed only and are not a validated real-network prediction.",
    "No 6G compliance, telecom certification or real-network integration is claimed.",
]


def _fmt(v: Any, digits: int = 3) -> str:
    if v is None:
        return "n/a"
    if isinstance(v, float):
        return f"{v:.{digits}f}"
    return str(v)


def _charts(result: Dict[str, Any]) -> List[io.BytesIO]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    t = result["trajectory"]["time_s"]
    imgs: List[io.BytesIO] = []
    fig, ax = plt.subplots(figsize=(7, 3))
    for c, series in enumerate(result["signal"]["true_dbm"]):
        ax.plot(t, series, label=f"Cell {c}")
    ax.set_xlabel("Time (s)"); ax.set_ylabel("True RSRP (dBm)"); ax.set_title("Signal strength vs time")
    ax.legend(fontsize=7); ax.grid(alpha=0.3)
    b = io.BytesIO(); fig.tight_layout(); fig.savefig(b, format="png", dpi=130); plt.close(fig); b.seek(0); imgs.append(b)
    fig, ax = plt.subplots(figsize=(7, 2.8))
    for name, a in result["algorithms"].items():
        ax.step(t, a["serving_cell"], where="post", label=name)
    ax.set_xlabel("Time (s)"); ax.set_ylabel("Serving cell (-1 = none)"); ax.set_title("Serving-cell timeline")
    ax.legend(fontsize=7); ax.grid(alpha=0.3)
    b = io.BytesIO(); fig.tight_layout(); fig.savefig(b, format="png", dpi=130); plt.close(fig); b.seek(0); imgs.append(b)
    return imgs


def build_pdf(detail: Dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    res, cfg = detail["result"], detail["config"]
    styles = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm, title="HandoverLab report")
    S: list = []

    def table(data, widths=None):
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b2447")),
                               ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 8),
                               ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                               ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white])]))
        return t

    S += [Paragraph("HandoverLab - Experiment Report", styles["Title"]),
          Paragraph("PS-016: Simulation-Based Handover Decision Evaluation for High-Mobility Users", styles["Heading3"]),
          Paragraph("Team Hackgen (A3-PS016-TC274) &middot; AIORI-3 Hackathon", styles["Normal"]), Spacer(1, 6),
          Paragraph("<b>Simulated results.</b> " + escape(res["metadata"]["disclaimer"]), styles["Normal"]), Spacer(1, 8),
          Paragraph("Experiment information", styles["Heading2"]),
          table([["Field", "Value"], ["Experiment ID", detail["id"]], ["Scenario", escape(detail["scenario_name"])],
                 ["Created (UTC)", detail["created_at"]], ["Status", detail["status"]],
                 ["Algorithms", ", ".join(detail["algorithms"])], ["Engine version", res["metadata"]["engine_version"]]],
                [50 * mm, 110 * mm]),
          Paragraph("Configuration parameters", styles["Heading2"]),
          table([["Parameter", "Value"]] + [[k, escape(str(v))] for k, v in cfg.items() if k != "scenario_name"],
                [70 * mm, 90 * mm]),
          Paragraph("Simulation assumptions", styles["Heading2"])]
    S += [Paragraph("&bull; " + escape(a), styles["Normal"]) for a in res["metadata"]["assumptions"]]
    algos = list(res["algorithms"].keys())
    keys = ["handover_attempts", "handover_count", "handover_failures", "failure_rate", "ping_pong_events",
            "ping_pong_rate", "outage_duration_s", "interruption_s", "rlf_count", "mean_decision_delay_s",
            "mean_serving_rsrp_dbm"]
    S += [Paragraph("Metrics", styles["Heading2"]),
          table([["Metric"] + algos] + [[k] + [_fmt(res["algorithms"][a]["metrics"].get(k)) for a in algos] for k in keys],
                [70 * mm] + [45 * mm] * len(algos))]
    if res.get("comparison"):
        S.append(Paragraph("Comparison findings (this scenario only)", styles["Heading2"]))
        for row in res["comparison"]:
            S.append(Paragraph(f"<b>{escape(row['label'])}</b>: baseline {_fmt(row['baseline'])}, proposed "
                               f"{_fmt(row['proposed'])} &rarr; winner: {row['winner']}. {escape(row['explanation'])}",
                               styles["Normal"]))
            S.append(Spacer(1, 3))
    S.append(Paragraph("Charts", styles["Heading2"]))
    for img in _charts(res):
        S += [Image(img, width=170 * mm, height=170 * mm * 0.41), Spacer(1, 6)]
    S.append(Paragraph("Limitations", styles["Heading2"]))
    S += [Paragraph("&bull; " + escape(x), styles["Normal"]) for x in LIMITATIONS]
    doc.build(S)
    return buf.getvalue()
