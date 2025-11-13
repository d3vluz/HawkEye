from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import os
import hashlib
from datetime import datetime
from supabase import create_client, Client
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="HawkEye Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET_TEMP = "pipeline-temp"
SUPABASE_BUCKET_PERMANENT = "pipeline-permanent"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Variáveis SUPABASE_URL e SUPABASE_KEY devem estar definidas")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# --- Modelos de Dados ---

class ImageProcessRequest(BaseModel):
    filename: str
    storage_path: str
    sha256: str
    timestamp: str


class ProcessImagesRequest(BaseModel):
    images: List[ImageProcessRequest]

class UploadResponse(BaseModel):
    filename: str
    storage_path: str
    sha256: str
    timestamp: str

class BoxInfo(BaseModel):
    x: int
    y: int
    width: int
    height: int
    pins_count: int
    status: str

class ImageProcessResult(BaseModel):
    filename: str
    sha256: str
    timestamp: str
    original_url: str
    areas_url: str
    pins_url: str
    boxes_url: str
    areas_count: int
    pins_count: int
    boxes_info: Dict[str, Any]

class ProcessImagesResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    results: List[ImageProcessResult]

class CompartmentData(BaseModel):
    grid_row: int
    grid_col: int
    bbox_x: int
    bbox_y: int
    bbox_width: int
    bbox_height: int
    pins_count: int
    is_valid: bool
    has_defect: bool

class CaptureData(BaseModel):
    filename: str
    sha256: str
    original_uri: str
    processed_uri: str
    processed_areas_uri: str
    processed_pins_uri: str
    processed_shaft_uri: str
    is_valid: bool
    areas_detected: int
    pins_detected: int
    defects_count: int
    has_missing_pins: bool
    has_extra_pins: bool
    has_damaged_pins: bool
    has_wrong_color_pins: bool
    has_structure_damage: bool
    compartments: List[CompartmentData]

class CreateBatchRequest(BaseModel):
    name: str
    description: str = ""
    captures: List[CaptureData]

class CreateBatchResponse(BaseModel):
    success: bool
    message: str
    batch_id: str
    total_captures: int
    valid_captures: int
    invalid_captures: int

class RejectBatchRequest(BaseModel):
    timestamp: str


# === FUNÇÕES UTILITÁRIAS ===

def calculate_sha256(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()

def get_public_url_from_supabase(storage_path: str, bucket: str = SUPABASE_BUCKET_TEMP) -> str:
    if not storage_path:
        return ""
    try:
        url = supabase.storage.from_(bucket).get_public_url(storage_path)
        return url
    except Exception as e:
        print(f"Erro ao obter URL pública para {storage_path}: {e}")
        return ""

def download_image_from_supabase(storage_path: str, bucket: str = SUPABASE_BUCKET_TEMP) -> np.ndarray:
    try:
        res = supabase.storage.from_(bucket).download(storage_path)
        nparr = np.frombuffer(res, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) 
        if img is None:
            raise ValueError(f"Não foi possível decodificar: {storage_path}")
        return img
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao baixar imagem: {str(e)}")

def upload_processed_image_to_supabase(image: np.ndarray, timestamp: str, sha256: str, image_type: str, bucket: str = SUPABASE_BUCKET_TEMP) -> str:
    try:
        success, buffer = cv2.imencode('.png', image)
        if not success:
            raise ValueError("Não foi possível codificar a imagem")
        image_bytes = buffer.tobytes()
        storage_path = f"{timestamp}/{sha256}/processed_{image_type}.png"
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        return storage_path
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao fazer upload: {str(e)}")

def move_file_between_buckets(source_path: str, dest_path: str, source_bucket: str, dest_bucket: str) -> bool:
    try:
        file_data = supabase.storage.from_(source_bucket).download(source_path)
        supabase.storage.from_(dest_bucket).upload(path=dest_path, file=file_data, file_options={"upsert": "true"})
        return True
    except Exception as e:
        print(f"Erro ao mover arquivo {source_path}: {str(e)}")
        return False

def delete_folder_from_bucket(timestamp: str, bucket: str) -> bool:
    try:
        files = supabase.storage.from_(bucket).list(timestamp)
        for folder in files:
            sha256_folder = folder['name']
            inner_files = supabase.storage.from_(bucket).list(f"{timestamp}/{sha256_folder}")
            files_to_delete = [f"{timestamp}/{sha256_folder}/{f['name']}" for f in inner_files]
            if files_to_delete:
                supabase.storage.from_(bucket).remove(files_to_delete)
        return True
    except Exception as e:
        print(f"Erro ao deletar pasta {timestamp}: {str(e)}")
        return False


# === PROCESSAMENTO DE IMAGEM ===

def process_image_areas(image: np.ndarray) -> Tuple[np.ndarray, int, List[int], List[int]]:
    if image is None:
        return np.zeros((100, 100, 3), dtype=np.uint8), 0, [], []
    image_bgr = image.copy()
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)  
    _, mask_gray = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask_gray = cv2.morphologyEx(mask_gray, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    edges = cv2.Canny(mask_gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi/180, threshold=120, minLineLength=100, maxLineGap=40)
    if lines is None:
        return image.copy(), 0, [], []
    verticais, horizontais = [], []
    for l in lines:
        x1, y1, x2, y2 = l[0]
        if abs(x1 - x2) < abs(y1 - y2):
            verticais.append(l)
        else:
            horizontais.append(l)
    def agrupar_linhas(linhas, eixo='x', tol=25, min_dist=50):
        if linhas is None or len(linhas) == 0:
            return []
        coords = []
        for l in linhas:
            x1, y1, x2, y2 = l[0]
            if eixo == 'x':
                coords.append((x1 + x2) / 2)
            else:
                coords.append((y1 + y2) / 2)
        coords = sorted(coords)
        agrupadas, atual = [], [coords[0]]
        for c in coords[1:]:
            if abs(c - np.mean(atual)) < tol:
                atual.append(c)
            else:
                media = int(np.mean(atual))
                if not agrupadas or abs(media - agrupadas[-1]) > min_dist:
                    agrupadas.append(media)
                atual = [c]
        media = int(np.mean(atual))
        if not agrupadas or abs(media - agrupadas[-1]) > min_dist:
            agrupadas.append(media)
        return agrupadas
    x_positions = agrupar_linhas(verticais, 'x', tol=25, min_dist=50)
    y_positions = agrupar_linhas(horizontais, 'y', tol=25, min_dist=50)
    if len(x_positions) < 2 or len(y_positions) < 2:
        return image.copy(), 0, x_positions, y_positions
    colunas = len(x_positions) - 1
    linhas_count = len(y_positions) - 1
    total_compartimentos = colunas * linhas_count
    result_image = image.copy()
    for x in x_positions:
        cv2.line(result_image, (x, 0), (x, h), (255, 0, 255), 2)
    for y in y_positions:
        cv2.line(result_image, (0, y), (w, y), (0, 255, 0), 2)
    return result_image, total_compartimentos, x_positions, y_positions

def process_image_pins(image: np.ndarray) -> Tuple[np.ndarray, int, List[Tuple[int, int, int, int]]]:
    hsv_image = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_yellow = np.array([10, 165, 100])
    upper_yellow = np.array([30, 255, 255])
    mask = cv2.inRange(hsv_image, lower_yellow, upper_yellow)
    kernel = np.ones((5,5), np.uint8)
    opening = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, 5) 
    sure_bg = cv2.dilate(opening, kernel, iterations=1)
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, 0.22 * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    image_for_watershed = image.copy()
    markers = cv2.watershed(image_for_watershed, markers)
    min_area_post_filter = 500
    image_with_separated_contours = image.copy()
    pins_count = 0
    pin_boxes = []
    for label in np.unique(markers):
        if label <= 1:
            continue
        object_mask = np.zeros(mask.shape, dtype="uint8")
        object_mask[markers == label] = 255
        contours, _ = cv2.findContours(object_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            if cv2.contourArea(contour) > min_area_post_filter:
                cv2.drawContours(image_with_separated_contours, [contour], -1, (255, 0, 255), 3)
                pins_count += 1
                x, y, w, h = cv2.boundingRect(contour)
                pin_boxes.append((x, y, w, h))
    return image_with_separated_contours, pins_count, pin_boxes

def process_image_boxes(image: np.ndarray, pin_boxes: List[Tuple[int, int, int, int]], x_positions: List[int], y_positions: List[int]) -> Tuple[np.ndarray, Dict[str, Any]]:
    image_result = cv2.cvtColor(image.copy(), cv2.COLOR_BGR2RGB)
    if len(x_positions) < 2 or len(y_positions) < 2:
        return cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR), {"total_boxes": 0, "empty_boxes": 0, "single_pin_boxes": 0, "multiple_pins_boxes": 0, "boxes": []}
    x_positions = sorted(x_positions)
    y_positions = sorted(y_positions)
    boxes = []
    for i in range(len(x_positions)-1):
        for j in range(len(y_positions)-1):
            x1, x2 = x_positions[i], x_positions[i+1]
            y1, y2 = y_positions[j], y_positions[j+1]
            boxes.append((x1, y1, x2-x1, y2-y1))
    boxes_info_list = []
    empty_count = 0
    single_pin_count = 0
    multiple_pins_count = 0
    for (x, y, w, h) in boxes:
        pins_inside = 0
        for (px, py, pw, ph) in pin_boxes:
            cx, cy = px + pw//2, py + ph//2
            if x < cx < x + w and y < cy < y + h:
                pins_inside += 1
        if pins_inside == 0:
            status = "empty"
            color = (255, 0, 0)
            empty_count += 1
        elif pins_inside == 1:
            status = "single"
            color = (0, 255, 0)
            single_pin_count += 1
        else:
            status = "multiple"
            color = (255, 165, 0)
            multiple_pins_count += 1
        cv2.rectangle(image_result, (x, y), (x+w, y+h), color, 2)
        cv2.putText(image_result, str(pins_inside), (x + w//2 - 10, y + h//2), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        boxes_info_list.append({"x": int(x), "y": int(y), "width": int(w), "height": int(h), "pins_count": int(pins_inside), "status": status})
    y_offset = 40
    cv2.putText(image_result, f'Total Caixas: {len(boxes)}', (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 40
    cv2.putText(image_result, f'Vazias: {empty_count}', (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
    y_offset += 40
    cv2.putText(image_result, f'1 Pin: {single_pin_count}', (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    y_offset += 40
    cv2.putText(image_result, f'Multiplos: {multiple_pins_count}', (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 165, 0), 2)
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)
    boxes_info = {"total_boxes": len(boxes), "empty_boxes": empty_count, "single_pin_boxes": single_pin_count, "multiple_pins_boxes": multiple_pins_count, "boxes": boxes_info_list}
    return image_result_bgr, boxes_info


# === ROTAS ===

@app.get("/")
def read_root():
    return {"message": "HawkEye Backend API", 
            "version": "2.0.0", 
            "status": "online"
            }

@app.post("/upload-image/", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...), batch_timestamp: str = None):
    valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não suportado: {file.content_type}")
    try:
        file_content = await file.read()
        sha256 = calculate_sha256(file_content)
        if batch_timestamp:
            timestamp = batch_timestamp
        else:
            timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        storage_path = f"{timestamp}/{sha256}/original_{file.filename}"
        supabase.storage.from_(SUPABASE_BUCKET_TEMP).upload(path=storage_path, file=file_content, file_options={"content-type": file.content_type, "upsert": "true"})
        return UploadResponse(filename=file.filename, storage_path=storage_path, sha256=sha256, timestamp=timestamp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")

@app.post("/upload-batch/")
async def upload_batch(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")
    batch_timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    uploaded_files = []
    for file in files:
        valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        if file.content_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Tipo não suportado: {file.content_type}")
        try:
            file_content = await file.read()
            sha256 = calculate_sha256(file_content)
            storage_path = f"{batch_timestamp}/{sha256}/original_{file.filename}"
            supabase.storage.from_(SUPABASE_BUCKET_TEMP).upload(path=storage_path, file=file_content, file_options={"content-type": file.content_type, "upsert": "true"})
            uploaded_files.append({"filename": file.filename, "storage_path": storage_path, "sha256": sha256, "timestamp": batch_timestamp})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro no upload de {file.filename}: {str(e)}")
    return {"success": True, "batch_timestamp": batch_timestamp, "total_uploaded": len(uploaded_files), "files": uploaded_files}

@app.post("/process-images/", response_model=ProcessImagesResponse)
async def process_images(request: ProcessImagesRequest):
    if not request.images:
        raise HTTPException(status_code=400, detail="Nenhuma imagem para processar")
    processed_count = 0
    results = []
    try: 
        for img_info in request.images:
            original_image = download_image_from_supabase(img_info.storage_path)
            areas_image, areas_count, x_positions, y_positions = process_image_areas(original_image)
            pins_image, pins_count, pin_boxes = process_image_pins(original_image)
            boxes_image, boxes_info = process_image_boxes(original_image, pin_boxes, x_positions, y_positions)
            areas_path = upload_processed_image_to_supabase(areas_image, img_info.timestamp, img_info.sha256, "areas")
            pins_path = upload_processed_image_to_supabase(pins_image, img_info.timestamp, img_info.sha256, "pins")
            boxes_path = upload_processed_image_to_supabase(boxes_image, img_info.timestamp, img_info.sha256, "boxes")
            original_url = get_public_url_from_supabase(img_info.storage_path)
            areas_url = get_public_url_from_supabase(areas_path)
            pins_url = get_public_url_from_supabase(pins_path)
            boxes_url = get_public_url_from_supabase(boxes_path)
            results.append(ImageProcessResult(filename=img_info.filename, sha256=img_info.sha256, timestamp=img_info.timestamp, original_url=original_url, areas_url=areas_url, pins_url=pins_url, boxes_url=boxes_url, areas_count=areas_count, pins_count=pins_count, boxes_info=boxes_info))
            processed_count += 1
        return ProcessImagesResponse(success=True, message=f"Todas as {processed_count} imagens foram processadas", processed_count=processed_count, results=results)
    except Exception as e:
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail=f"Erro ao processar: {str(e)}")
        raise e

@app.post("/api/batches/create", response_model=CreateBatchResponse)
async def create_batch(request: CreateBatchRequest):
    try:
        print(f"\n{'='*80}\n📦 Criando lote: {request.name}\n{'='*80}")
        if not request.captures:
            raise HTTPException(status_code=400, detail="Lote deve conter ao menos uma captura")
        timestamp = request.captures[0].original_uri.split('/')[0]
        print(f"\n📁 Movendo arquivos...")
        moved_captures = []
        for capture in request.captures:
            files_to_move = [(capture.original_uri, capture.original_uri), (capture.processed_areas_uri, capture.processed_areas_uri), (capture.processed_pins_uri, capture.processed_pins_uri), (capture.processed_shaft_uri, capture.processed_shaft_uri)]
            all_moved = True
            for temp_path, dest_path in files_to_move:
                if temp_path:
                    success = move_file_between_buckets(temp_path, dest_path, SUPABASE_BUCKET_TEMP, SUPABASE_BUCKET_PERMANENT)
                    if success:
                        print(f"   ✅ Movido: {temp_path}")
                    else:
                        all_moved = False
                        print(f"   ❌ Falha: {temp_path}")
            if all_moved:
                moved_captures.append(capture)
        if len(moved_captures) != len(request.captures):
            raise HTTPException(status_code=500, detail=f"Erro ao mover arquivos. Movidos: {len(moved_captures)}/{len(request.captures)}")
        total_captures = len(request.captures)
        valid_captures = sum(1 for c in request.captures if c.is_valid)
        invalid_captures = total_captures - valid_captures
        total_defects = sum(c.defects_count for c in request.captures)
        quality_score = (valid_captures / total_captures * 100) if total_captures > 0 else 0
        print(f"\n📊 Métricas: Total:{total_captures} | Válidas:{valid_captures} | Inválidas:{invalid_captures} | Defeitos:{total_defects} | Score:{quality_score:.2f}%")
        print(f"\n💾 Criando lote no banco...")
        batch_data = {"name": request.name, "description": request.description, "total_captures": total_captures, "valid_captures": valid_captures, "invalid_captures": invalid_captures, "total_defects": total_defects, "quality_score": quality_score}
        batch_result = supabase.table("batches").insert(batch_data).execute()
        if not batch_result.data or len(batch_result.data) == 0:
            raise HTTPException(status_code=500, detail="Erro ao criar lote")
        batch_id = batch_result.data[0]["id"]
        print(f"   ✅ Lote criado: {batch_id}")
        print(f"\n📸 Criando captures...")
        for capture in request.captures:
            capture_data = {"batch_id": batch_id, "filename": capture.filename, "sha256": capture.sha256, "original_uri": get_public_url_from_supabase(capture.original_uri, SUPABASE_BUCKET_PERMANENT), "processed_uri": get_public_url_from_supabase(capture.processed_uri, SUPABASE_BUCKET_PERMANENT) if capture.processed_uri else None, "processed_areas_uri": get_public_url_from_supabase(capture.processed_areas_uri, SUPABASE_BUCKET_PERMANENT), "processed_pins_uri": get_public_url_from_supabase(capture.processed_pins_uri, SUPABASE_BUCKET_PERMANENT), "processed_shaft_uri": get_public_url_from_supabase(capture.processed_shaft_uri, SUPABASE_BUCKET_PERMANENT), "is_valid": capture.is_valid, "areas_detected": capture.areas_detected, "pins_detected": capture.pins_detected, "defects_count": capture.defects_count, "has_missing_pins": capture.has_missing_pins, "has_extra_pins": capture.has_extra_pins, "has_damaged_pins": capture.has_damaged_pins, "has_wrong_color_pins": capture.has_wrong_color_pins, "has_structure_damage": capture.has_structure_damage}
            capture_result = supabase.table("captures").insert(capture_data).execute()
            if not capture_result.data or len(capture_result.data) == 0:
                raise HTTPException(status_code=500, detail=f"Erro ao criar capture {capture.filename}")
            capture_id = capture_result.data[0]["id"]
            print(f"   ✅ Capture: {capture.filename} ({capture_id})")
            if capture.compartments:
                print(f"      📦 Criando {len(capture.compartments)} compartimentos...")
                compartments_data = [{"capture_id": capture_id, "grid_row": comp.grid_row, "grid_col": comp.grid_col, "bbox_x": comp.bbox_x, "bbox_y": comp.bbox_y, "bbox_width": comp.bbox_width, "bbox_height": comp.bbox_height, "pins_count": comp.pins_count, "is_valid": comp.is_valid, "has_defect": comp.has_defect} for comp in capture.compartments]
                if compartments_data:
                    comp_result = supabase.table("compartments").insert(compartments_data).execute()
                    if comp_result.data:
                        print(f"      ✅ {len(comp_result.data)} compartimentos criados")
        print(f"\n🗑️ Deletando temporários...")
        delete_success = delete_folder_from_bucket(timestamp, SUPABASE_BUCKET_TEMP)
        if delete_success:
            print(f"   ✅ Pasta {timestamp} deletada")
        print(f"\n{'='*80}\n✅ LOTE CRIADO COM SUCESSO!\n{'='*80}\n")
        return CreateBatchResponse(success=True, message=f"Lote '{request.name}' criado com sucesso", batch_id=batch_id, total_captures=total_captures, valid_captures=valid_captures, invalid_captures=invalid_captures)
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar lote: {str(e)}")

@app.post("/api/batches/reject")
async def reject_batch(request: RejectBatchRequest):
    try:
        print(f"\n{'='*80}\n❌ Rejeitando lote: {request.timestamp}\n{'='*80}")
        print(f"\n🗑️ Deletando arquivos...")
        delete_success = delete_folder_from_bucket(request.timestamp, SUPABASE_BUCKET_TEMP)
        if not delete_success:
            raise HTTPException(status_code=500, detail=f"Erro ao deletar lote {request.timestamp}")
        print(f"   ✅ Pasta {request.timestamp} deletada\n{'='*80}\n✅ LOTE REJEITADO!\n{'='*80}\n")
        return {"success": True, "message": f"Lote {request.timestamp} rejeitado e deletado", "timestamp": request.timestamp}
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao rejeitar: {str(e)}")

@app.get("/health")
def health_check():
    try:
        supabase.storage.from_(SUPABASE_BUCKET_TEMP).list()
        supabase_status = True
    except Exception:
        supabase_status = False
    return {"status": "healthy", "supabase_connected": supabase_status, "version": "4.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)