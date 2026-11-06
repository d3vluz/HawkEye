from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import storage
from pipeline import run_pipeline

app = FastAPI(title="HawkEye Worker", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ImageInput(BaseModel):
    filename: str
    storage_path: str
    sha256: str
    timestamp: str


class ProcessRequest(BaseModel):
    images: List[ImageInput]


@app.post("/process")
def process(req: ProcessRequest):
    results = []
    for img in req.images:
        original = storage.download_image(img.storage_path)
        ctx = run_pipeline(original)

        areas_key = storage.upload_processed_image(ctx.areas_img, img.timestamp, img.sha256, "areas")
        pins_key = storage.upload_processed_image(ctx.pins_img, img.timestamp, img.sha256, "pins")
        boxes_key = storage.upload_processed_image(ctx.boxes_img, img.timestamp, img.sha256, "boxes")
        shafts_key = storage.upload_processed_image(ctx.shafts_img, img.timestamp, img.sha256, "shafts")

        results.append({
            "filename": img.filename,
            "sha256": img.sha256,
            "timestamp": img.timestamp,
            "original_url": storage.get_public_url(img.storage_path),
            "areas_url": storage.get_public_url(areas_key),
            "pins_url": storage.get_public_url(pins_key),
            "boxes_url": storage.get_public_url(boxes_key),
            "shafts_url": storage.get_public_url(shafts_key),
            "areas_count": ctx.areas_count,
            "grid_rows": ctx.grid.rows,
            "grid_cols": ctx.grid.cols,
            "missing_dividers": ctx.grid.missing_segments,
            "pins_count": ctx.pins_count,
            "boxes_info": ctx.boxes_info,
            "pin_classification": ctx.pin_classification,
            "shaft_classification": ctx.shaft_classification,
        })

    return {"success": True, "processed_count": len(results), "results": results}


@app.get("/health")
def health():
    return {"status": "ok"}
