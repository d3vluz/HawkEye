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
from shaft_processing import process_shafts_complete

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

# ===================== CARREGAR MÁSCARA DE BORDA =====================

BORDER_MASK_PATH = "mascaraDaBorda.png"
BORDER_MASK = None

if os.path.exists(BORDER_MASK_PATH):
    BORDER_MASK = cv2.imread(BORDER_MASK_PATH)
    if BORDER_MASK is not None:
        print(f"✅ Máscara de borda carregada: {BORDER_MASK_PATH}")
    else:
        print(f"⚠️ Erro ao carregar máscara: {BORDER_MASK_PATH}")
else:
    print(f"⚠️ Máscara não encontrada: {BORDER_MASK_PATH}")
    print(f"   O processamento continuará sem remoção de borda.")



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

class PinClassification(BaseModel):
    total_pins: int
    valid_pins: int
    invalid_pins: int
    critical_pins: int
    damaged_threshold: float
    average_area: float

class ImageProcessResult(BaseModel):
    filename: str
    sha256: str
    timestamp: str
    original_url: str
    areas_url: str
    pins_url: str
    boxes_url: str
    shafts_url: str
    areas_count: int
    pins_count: int
    boxes_info: Dict[str, Any]
    pin_classification: Dict[str, Any]
    shaft_classification: Dict[str, Any]

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
    has_shaft_defects: bool
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


def apply_watershed(image_rgb: np.ndarray, mask_input: np.ndarray, min_area: int = 500, threshold_factor: float = 0.15) -> List[np.ndarray]:
    """Aplica o algoritmo Watershed para obter contornos que passaram pelo min_area."""
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(mask_input, cv2.MORPH_OPEN, kernel, iterations=1)
    sure_bg = cv2.dilate(opening, kernel, iterations=2)

    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, threshold_factor * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    
    image_temp = image_rgb.copy()
    markers = cv2.watershed(image_temp, markers)

    final_contours = []
    for label in np.unique(markers):
        if label <= 1:
            continue
        
        object_mask = np.zeros(mask_input.shape, dtype="uint8")
        object_mask[markers == label] = 255
        contours, _ = cv2.findContours(object_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            if cv2.contourArea(contour) > min_area:
                final_contours.append(contour)
    
    return final_contours


def process_image_pins(image: np.ndarray) -> Tuple[np.ndarray, int, List[Tuple[int, int, int, int]], Dict[str, Any]]:
    """
    Processa pins com detecção de cores erradas e danos.
    
    Retorna:
        - Imagem com contornos desenhados
        - Contagem total de pins
        - Lista de bounding boxes dos pins
        - Classificação detalhada dos pins
    """
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    hsv_image = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # --- MÁSCARAS HSV ---
    
    # Pins padrão (Amarelos)
    lower_yellow = np.array([10, 165, 100])
    upper_yellow = np.array([30, 255, 255])
    mask_yellow = cv2.inRange(hsv_image, lower_yellow, upper_yellow)
    
    # Pins fora do padrão (Azul, Vermelho, Verde)
    mask_blue = cv2.inRange(hsv_image, np.array([110, 60, 40]), np.array([125, 255, 170]))
    mask_red = cv2.inRange(hsv_image, np.array([0, 151, 82]), np.array([15, 255, 255]))
    mask_green = cv2.inRange(hsv_image, np.array([70, 0, 0]), np.array([100, 255, 255]))
    
    mask_out_of_standard = mask_blue | mask_red | mask_green
    
    # --- APLICAR WATERSHED ---
    
    # Detecta candidatos baseados na cor
    raw_out_contours = apply_watershed(image_rgb, mask_out_of_standard, min_area=300, threshold_factor=0.15)
    raw_yellow_contours = apply_watershed(image_rgb, mask_yellow, min_area=300, threshold_factor=0.20)
    
    # --- CALCULAR MÉDIA E LIMITE DE DANO ---
    
    all_detected_contours = raw_yellow_contours + raw_out_contours
    avg_area = 0.0
    damage_threshold = 0.0
    
    if len(all_detected_contours) > 0:
        all_areas = [cv2.contourArea(cnt) for cnt in all_detected_contours]
        avg_area = float(np.mean(all_areas))
        damage_threshold = avg_area * (2/3)
    
    # --- CLASSIFICAÇÃO DETALHADA (4 CATEGORIAS) ---
    
    pins_ok = []                  # Amarelos perfeitos
    pins_wrong_color = []         # Cor errada, mas não danificados
    pins_damaged_yellow = []      # Amarelos danificados
    pins_double_defect = []       # Cor errada E danificados
    
    # Analisando os Amarelos
    for cnt in raw_yellow_contours:
        area = cv2.contourArea(cnt)
        if area < damage_threshold:
            pins_damaged_yellow.append(cnt)
        else:
            pins_ok.append(cnt)
    
    # Analisando os de Cor Errada
    for cnt in raw_out_contours:
        area = cv2.contourArea(cnt)
        if area < damage_threshold:
            pins_double_defect.append(cnt)
        else:
            pins_wrong_color.append(cnt)
    
    # --- AGRUPAMENTO PARA VISUALIZAÇÃO EM 3 CORES ---
    
    # Categoria 1: VÁLIDO (Verde) -> Pino Perfeito
    final_green = pins_ok
    count_green = len(final_green)
    
    # Categoria 2: INVÁLIDO (Laranja) -> Apenas um erro (Cor Errada OU Apenas Danificado Amarelo)
    final_orange = pins_wrong_color + pins_damaged_yellow
    count_orange = len(final_orange)
    
    # Categoria 3: CRÍTICO (Vermelho) -> Defeito Duplo (Cor Errada E Danificado)
    final_red = pins_double_defect
    count_red = len(final_red)
    
    total = count_green + count_orange + count_red
    
    # --- DESENHAR RESULTADO ---
    
    image_result = image_rgb.copy()
    
    COLOR_VALID = (0, 255, 0)        # Verde: Válido (Perfeito)
    COLOR_INVALID = (255, 165, 0)    # Laranja: Inválido (Erro Único)
    COLOR_CRITICAL = (255, 0, 0)     # Vermelho: Crítico (Erro Duplo)
    
    cv2.drawContours(image_result, final_green, -1, COLOR_VALID, 3)
    cv2.drawContours(image_result, final_orange, -1, COLOR_INVALID, 3)
    cv2.drawContours(image_result, final_red, -1, COLOR_CRITICAL, 3)
    
    # Converter de volta para BGR
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)
    
    # --- EXTRAIR BOUNDING BOXES ---
    
    pin_boxes = []
    all_contours = final_green + final_orange + final_red
    for contour in all_contours:
        x, y, w, h = cv2.boundingRect(contour)
        pin_boxes.append((x, y, w, h))
    
    # --- CLASSIFICAÇÃO PARA RETORNO ---
    
    pin_classification = {
        "total_pins": total,
        "valid_pins": count_green,
        "invalid_pins": count_orange,
        "critical_pins": count_red,
        "damaged_threshold": round(damage_threshold, 2),
        "average_area": round(avg_area, 2),
        "details": {
            "pins_ok": count_green,
            "pins_wrong_color": len(pins_wrong_color),
            "pins_damaged_yellow": len(pins_damaged_yellow),
            "pins_double_defect": len(pins_double_defect)
        }
    }
    
    return image_result_bgr, total, pin_boxes, pin_classification


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
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)
    boxes_info = {"total_boxes": len(boxes), "empty_boxes": empty_count, "single_pin_boxes": single_pin_count, "multiple_pins_boxes": multiple_pins_count, "boxes": boxes_info_list}
    return image_result_bgr, boxes_info


# === ROTAS ===

@app.get("/")
def read_root():
    return {
            "message": "HawkEye Backend API", 
            "version": "2.2.1", 
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
            
            # Processamento de áreas
            areas_image, areas_count, x_positions, y_positions = process_image_areas(original_image)
            
            # Processamento de pins
            pins_image, pins_count, pin_boxes, pin_classification = process_image_pins(original_image)
            
            # Processamento de boxes
            boxes_image, boxes_info = process_image_boxes(original_image, pin_boxes, x_positions, y_positions)
            
            # Processamento de hastes
            shafts_image, shaft_classification = process_shafts_complete(
                original_image,
                border_mask=BORDER_MASK,
                apply_border_centralization=True,
                apply_border_removal=True
            )
            
            # Upload de imagens processadas
            areas_path = upload_processed_image_to_supabase(areas_image, img_info.timestamp, img_info.sha256, "areas")
            pins_path = upload_processed_image_to_supabase(pins_image, img_info.timestamp, img_info.sha256, "pins")
            boxes_path = upload_processed_image_to_supabase(boxes_image, img_info.timestamp, img_info.sha256, "boxes")
            shafts_path = upload_processed_image_to_supabase(shafts_image, img_info.timestamp, img_info.sha256, "shafts")
            
            # URLs públicas
            original_url = get_public_url_from_supabase(img_info.storage_path)
            areas_url = get_public_url_from_supabase(areas_path)
            pins_url = get_public_url_from_supabase(pins_path)
            boxes_url = get_public_url_from_supabase(boxes_path)
            shafts_url = get_public_url_from_supabase(shafts_path)
            
            results.append(ImageProcessResult(
                filename=img_info.filename, 
                sha256=img_info.sha256, 
                timestamp=img_info.timestamp, 
                original_url=original_url, 
                areas_url=areas_url, 
                pins_url=pins_url, 
                boxes_url=boxes_url,
                shafts_url=shafts_url,
                areas_count=areas_count, 
                pins_count=pins_count, 
                boxes_info=boxes_info,
                pin_classification=pin_classification,
                shaft_classification=shaft_classification
            ))
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
        
        # print(f"   ✅ Lote criado: {batch_id}")
        # print(f"\n📸 Criando captures...")
        defect_types_result = supabase.table("defect_types").select("id, code").execute()
        defect_types_map = {dt["code"]: dt["id"] for dt in defect_types_result.data} if defect_types_result.data else {}
        
        for capture in request.captures:
            capture_data = {
                            "batch_id": batch_id, 
                            "filename": capture.filename, 
                            "sha256": capture.sha256, 
                            "original_uri": get_public_url_from_supabase(capture.original_uri, SUPABASE_BUCKET_PERMANENT),
                            "processed_uri": get_public_url_from_supabase(capture.processed_uri, SUPABASE_BUCKET_PERMANENT) if capture.processed_uri else None,
                            "processed_areas_uri": get_public_url_from_supabase(capture.processed_areas_uri, SUPABASE_BUCKET_PERMANENT),
                            "processed_pins_uri": get_public_url_from_supabase(capture.processed_pins_uri, SUPABASE_BUCKET_PERMANENT),
                            "processed_shaft_uri": get_public_url_from_supabase(capture.processed_shaft_uri, SUPABASE_BUCKET_PERMANENT),
                            "is_valid": capture.is_valid,
                            "areas_detected": capture.areas_detected,
                            "pins_detected": capture.pins_detected,
                            "defects_count": capture.defects_count,
                            "has_missing_pins": capture.has_missing_pins,
                            "has_extra_pins": capture.has_extra_pins,
                            "has_damaged_pins": capture.has_damaged_pins,
                            "has_wrong_color_pins": capture.has_wrong_color_pins,
                            "has_structure_damage": capture.has_structure_damage,
                            "has_shaft_defects": capture.has_shaft_defects
                            }
            
            capture_result = supabase.table("captures").insert(capture_data).execute()
            
            if not capture_result.data or len(capture_result.data) == 0:
                raise HTTPException(status_code=500, detail=f"Erro ao criar capture {capture.filename}")
            capture_id = capture_result.data[0]["id"]
            
            print(f"   ✅ Capture: {capture.filename} ({capture_id})")
            
            compartments_map = {}
            if capture.compartments:
                print(f"      📦 Criando {len(capture.compartments)} compartimentos...")
                compartments_data = [{"capture_id": capture_id, "grid_row": comp.grid_row, "grid_col": comp.grid_col, "bbox_x": comp.bbox_x, "bbox_y": comp.bbox_y, "bbox_width": comp.bbox_width, "bbox_height": comp.bbox_height, "pins_count": comp.pins_count, "is_valid": comp.is_valid, "has_defect": comp.has_defect} for comp in capture.compartments]
                if compartments_data:
                    comp_result = supabase.table("compartments").insert(compartments_data).execute()
                    if comp_result.data:
                        print(f"      ✅ {len(comp_result.data)} compartimentos criados")
                        for comp in comp_result.data:
                            key = (comp["grid_row"], comp["grid_col"])
                            compartments_map[key] = comp["id"]
            
            defects_to_insert = []
            
            if capture.has_missing_pins and "MISSING_PIN" in defect_types_map:
                for comp in capture.compartments:
                    if comp.pins_count == 0:
                        key = (comp.grid_row, comp.grid_col)
                        compartment_id = compartments_map.get(key)
                        defects_to_insert.append({
                            "capture_id": capture_id,
                            "defect_type_id": defect_types_map["MISSING_PIN"],
                            "compartment_id": compartment_id
                        })
            
            if capture.has_extra_pins and "EXTRA_PIN" in defect_types_map:
                for comp in capture.compartments:
                    if comp.pins_count > 1:
                        key = (comp.grid_row, comp.grid_col)
                        compartment_id = compartments_map.get(key)
                        defects_to_insert.append({
                            "capture_id": capture_id,
                            "defect_type_id": defect_types_map["EXTRA_PIN"],
                            "compartment_id": compartment_id
                        })
            
            if capture.has_damaged_pins and "DAMAGED_PIN" in defect_types_map:
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["DAMAGED_PIN"],
                    "compartment_id": None
                })
            
            if capture.has_wrong_color_pins and "WRONG_COLOR" in defect_types_map:
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["WRONG_COLOR"],
                    "compartment_id": None
                })
            
            if capture.has_shaft_defects and "SHAFT_DEFECT" in defect_types_map:
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["SHAFT_DEFECT"],
                    "compartment_id": None
                })
            
            if capture.has_structure_damage and "STRUCTURE_DAMAGE" in defect_types_map:
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["STRUCTURE_DAMAGE"],
                    "compartment_id": None
                })
            
            if defects_to_insert:
                print(f"      🔴 Criando {len(defects_to_insert)} defeitos...")
                defects_result = supabase.table("defects").insert(defects_to_insert).execute()
                if defects_result.data:
                    print(f"      ✅ {len(defects_result.data)} defeitos criados")
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
    return {"status": "healthy", "supabase_connected": supabase_status, "version": "2.2.1"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)