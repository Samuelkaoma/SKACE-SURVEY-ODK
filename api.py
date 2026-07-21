"""FastAPI bridge exposing the paradata anomaly-detection pipeline to the web dashboard.

Endpoints consumed by SKACE-Web-Dashboard (http://localhost:8000):
    GET  /api/datasets          -> list generated synthetic data folders
    POST /api/generate-synthetic-> generate a fresh synthetic suite (seed/mode in body)
    POST /api/run-pipeline      -> run the detection pipeline over a chosen folder
    GET  /api/results           -> per-interview feature + detection records
    GET  /api/ground-truth      -> per-dataset ground-truth labels for the last run
    GET  /api/metrics           -> computed precision/recall/F1/accuracy + detection-by-type
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import os
import random
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from src.pipeline.controller import PipelineController
from src.validation.reporting import (
    compute_binary_metrics,
    compute_detection_by_type,
    load_ground_truth,
    merge_ground_truth,
)

app = FastAPI(title="SKACE Pipeline API")

# Setup CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_SYNTHETIC = Path("data/synthetic")
OUTPUT_DIR = Path("output")
RESULTS_FILE = OUTPUT_DIR / "features_output.csv"
LAST_RUN_FILE = OUTPUT_DIR / "last_run.json"
GENERATOR_SCRIPT = Path("tests") / "generate_synthetic_final.py"
GROUND_TRUTH_NAME = "ground_truth_labels.csv"


def _records(df: pd.DataFrame) -> list:
    """Convert a DataFrame to JSON-safe records (NaN/inf -> None)."""
    clean = df.replace([np.inf, -np.inf], np.nan)
    clean = clean.astype(object).where(pd.notnull(clean), None)
    return clean.to_dict(orient="records")


def _write_last_run(payload: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with LAST_RUN_FILE.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def _read_last_run() -> dict:
    if not LAST_RUN_FILE.exists():
        return {}
    try:
        with LAST_RUN_FILE.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (json.JSONDecodeError, OSError):
        return {}


def _resolve_ground_truth_path() -> Path | None:
    """Locate the ground-truth file for the last run, with sensible fallbacks."""
    last_run = _read_last_run()
    dataset_dir = last_run.get("dataset_dir")
    if dataset_dir:
        candidate = Path(dataset_dir) / GROUND_TRUTH_NAME
        if candidate.exists():
            return candidate
    # Fallback: newest synthetic folder that carries a ground-truth file.
    if DATA_SYNTHETIC.exists():
        subdirs = sorted(
            [d for d in DATA_SYNTHETIC.iterdir() if d.is_dir()],
            key=os.path.getmtime,
            reverse=True,
        )
        for d in subdirs:
            candidate = d / GROUND_TRUTH_NAME
            if candidate.exists():
                return candidate
    # Final fallback: canonical labels shipped with the repo.
    canonical = Path("data") / GROUND_TRUTH_NAME
    return canonical if canonical.exists() else None


@app.get("/api/datasets")
def list_datasets():
    if not DATA_SYNTHETIC.exists():
        return []

    datasets = []
    for d in DATA_SYNTHETIC.iterdir():
        if d.is_dir():
            csvs = list(d.glob("*.csv"))
            if csvs:
                datasets.append(
                    {
                        "id": d.name,
                        "name": d.name,
                        "created": os.path.getctime(d),
                        "file_count": len(csvs),
                    }
                )

    datasets.sort(key=lambda x: x["created"], reverse=True)
    return datasets


@app.post("/api/generate-synthetic")
def generate_synthetic(params: dict = None):
    """Generate a fresh synthetic suite into data/synthetic/<timestamp>/.

    Body: {"mode": "random" | "adversarial", "seed": <int optional>}
    A random mode picks a random seed; otherwise an explicit seed (or 42) is used.
    """
    params = params or {}
    mode = params.get("mode", "adversarial")
    seed = params.get("seed")
    if seed is None:
        seed = random.randint(1, 9999) if mode == "random" else 42

    if not GENERATOR_SCRIPT.exists():
        raise HTTPException(status_code=404, detail=f"Script not found: {GENERATOR_SCRIPT}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = DATA_SYNTHETIC / timestamp

    cmd = [
        sys.executable,
        str(GENERATOR_SCRIPT),
        "--output-dir",
        str(output_dir),
        "--seed",
        str(seed),
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr or str(e))

    return {
        "status": "success",
        "message": f"Generated {mode} data (seed {seed}).",
        "folder_name": timestamp,
        "seed": seed,
        "mode": mode,
    }


@app.post("/api/run-pipeline")
def run_pipeline(params: dict = None):
    params = params or {}
    folder_name = params.get("folder_name")

    if not DATA_SYNTHETIC.exists():
        raise HTTPException(status_code=404, detail="Synthetic data directory not found.")

    if folder_name:
        target_dir = DATA_SYNTHETIC / folder_name
        if not target_dir.is_dir():
            raise HTTPException(status_code=404, detail=f"Dataset not found: {folder_name}")
    else:
        subdirs = sorted(
            [d for d in DATA_SYNTHETIC.iterdir() if d.is_dir()],
            key=os.path.getmtime,
            reverse=True,
        )
        if not subdirs:
            raise HTTPException(status_code=404, detail="No synthetic data sets available.")
        target_dir = subdirs[0]

    # Only the paradata logs feed the pipeline; the label file is held out.
    csv_files = [f for f in target_dir.glob("*.csv") if f.name != GROUND_TRUTH_NAME]
    if not csv_files:
        raise HTTPException(status_code=404, detail="No CSV files found to process.")

    try:
        controller = PipelineController(parser_type="auto")
        detailed = controller.process_batch_detailed(csv_files)
        final_df = detailed["interview_features"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    if final_df.empty:
        raise HTTPException(status_code=500, detail="Pipeline produced no features.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    final_df.to_csv(RESULTS_FILE, index=False, na_rep="NaN")

    # Evaluate against the dataset's own ground-truth labels (never touch data/).
    metrics: dict = {}
    detection_rows: list = []
    metrics_error = None
    gt_path = target_dir / GROUND_TRUTH_NAME
    if gt_path.exists():
        try:
            ground_truth = load_ground_truth(gt_path)
            merged = merge_ground_truth(ground_truth, final_df)
            metrics = compute_binary_metrics(merged)
            detection_rows = compute_detection_by_type(merged)
        except Exception as e:  # keep the run successful even if labels don't align
            metrics_error = str(e)

    _write_last_run(
        {
            "dataset_dir": str(target_dir),
            "dataset_name": target_dir.name,
            "interviews": int(len(final_df)),
            "metrics": metrics,
            "detection_by_type": detection_rows,
            "metrics_error": metrics_error,
        }
    )

    return {
        "status": "success",
        "message": f"Processed {target_dir.name} ({len(final_df)} interviews).",
        "folder_name": target_dir.name,
    }


@app.get("/api/results")
def get_results():
    if not RESULTS_FILE.exists():
        return []
    try:
        df = pd.read_csv(RESULTS_FILE)
        return _records(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading results: {e}")


@app.get("/api/ground-truth")
def get_ground_truth():
    gt_path = _resolve_ground_truth_path()
    if gt_path is None:
        return []
    try:
        df = pd.read_csv(gt_path)
        # Force file_name so the dashboard categorises these rows as "Ground Truth".
        df["file_name"] = "ground_truth.csv"
        return _records(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading ground truth: {e}")


@app.get("/api/metrics")
def get_metrics():
    """Return computed precision/recall/F1/accuracy + detection-by-type for the last run."""
    last_run = _read_last_run()
    metrics = last_run.get("metrics") or {}
    detection = last_run.get("detection_by_type") or []

    return {
        "dataset": last_run.get("dataset_name"),
        "interviews": last_run.get("interviews", 0),
        "precision": metrics.get("precision", 0.0),
        "recall": metrics.get("recall", 0.0),
        "f1_score": metrics.get("f1_score", 0.0),
        "accuracy": metrics.get("accuracy", 0.0),
        "specificity": metrics.get("specificity", 0.0),
        "true_positive": metrics.get("true_positive", 0),
        "false_positive": metrics.get("false_positive", 0),
        "true_negative": metrics.get("true_negative", 0),
        "false_negative": metrics.get("false_negative", 0),
        "total_samples": metrics.get("total_samples", 0),
        "anomalies_true": metrics.get("anomalies_true", 0),
        "anomalies_predicted": metrics.get("anomalies_predicted", 0),
        "detection_by_type": detection,
        "available": bool(metrics),
        "error": last_run.get("metrics_error"),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
