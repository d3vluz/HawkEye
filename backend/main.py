from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import time
import hashlib
from supabase import create_client, Client
import cv2
import numpy as np
from dotenv import load_dotenv
import io

load_dotenv()

app = FastAPI(title="HawkEye Backend API")

# --- Configuração da API e Supabase ---

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = "pipeline-temp"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Variáveis SUPABASE_URL e SUPABASE_KEY devem estar definidas")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


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


class ImageProcessResult(BaseModel):
    filename: str
    sha256: str
    timestamp: str
    original_url: str
    areas_url: str
    pins_url: str
    areas_count: int
    pins_count: int


class ProcessImagesResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    results: List[ImageProcessResult]



def calculate_sha256(file_content: bytes) -> str:
    """Calcula o hash SHA256 do conteúdo do arquivo."""
    return hashlib.sha256(file_content).hexdigest()

def get_public_url_from_supabase(storage_path: str) -> str:
    """Obtém a URL pública de um arquivo no Supabase Storage."""
    if not storage_path:
        return ""
    try:
        url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
        return url
    except Exception as e:
        print(f"Erro ao obter URL pública para {storage_path}: {e}")
        return ""

def download_image_from_supabase(storage_path: str) -> np.ndarray:
    """
    Baixa uma imagem do Supabase Storage, decodifica e retorna como array numpy.
    """
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).download(storage_path)
        nparr = np.frombuffer(res, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) 
        
        if img is None:
            raise ValueError(f"Não foi possível decodificar a imagem: {storage_path}")
        
        return img
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao baixar imagem '{storage_path}' do Supabase: {str(e)}"
        )

def process_image_areas(image: np.ndarray) -> tuple[np.ndarray, int]:
    """
    Processa a imagem para detectar a grade de compartimentos (áreas) 
    usando binarização, morfologia, Canny e Hough Lines P.
    """
    MORPH_KERNEL_SIZE = 7
    MORPH_ITERATIONS = 2
    MIN_BLOB_AREA = 400
    CANNY_LOW = 3
    CANNY_HIGH = 20
    HOUGH_THRESHOLD = 25
    HOUGH_MIN_LINE_FRAC = 0.125
    HOUGH_MAX_GAP = 30
    VERT_TOL = 8
    HORZ_TOL = 10
    GROUP_TOL = 80
    
    if image is None:
        return np.zeros((100, 100, 3), dtype=np.uint8), 0

    h, w = image.shape[:2]

    # 1. Conversão para tons de cinza + binarização
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 2. Operações morfológicas para limpeza
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (MORPH_KERNEL_SIZE, MORPH_KERNEL_SIZE))
    binary_clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=MORPH_ITERATIONS)

    # 3. Filtragem de blobs pequenos
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary_clean)
    mask = np.zeros_like(binary_clean)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] > MIN_BLOB_AREA:
            mask[labels == i] = 255
    binary_clean = mask

    # 4. Detecção de bordas e linhas
    edges = cv2.Canny(binary_clean, CANNY_LOW, CANNY_HIGH)
    minLineLength = int(HOUGH_MIN_LINE_FRAC * min(h, w)) 
    
    lines = cv2.HoughLinesP(
        edges, 1, np.pi/180, HOUGH_THRESHOLD,
        minLineLength=minLineLength, maxLineGap=HOUGH_MAX_GAP
    )
    
    if lines is None:
        return image.copy(), 0

    # 5. Classificação entre linhas verticais e horizontais
    vertical_lines, horizontal_lines = [], []
    for (x1, y1, x2, y2) in lines[:, 0, :]:
        if abs(x1 - x2) < VERT_TOL:
            vertical_lines.append((x1, y1, x2, y2))
        elif abs(y1 - y2) < HORZ_TOL:
            horizontal_lines.append((x1, y1, x2, y2))

    # 6. Função auxiliar para agrupar linhas próximas (agrupamento de grade)
    def agrupar(linhas, eixo='x'):
        grupos = []
        key = lambda x: x[0] if eixo == 'x' else x[1]
        
        temp_groups = []
        for l in sorted(linhas, key=key):
            valor = key(l)
            for g in temp_groups:
                current_avg = np.mean([key(lin) for lin in g['linhas']])
                if abs(current_avg - valor) < GROUP_TOL:
                    g['linhas'].append(l)
                    break
            else:
                temp_groups.append({'linhas': [l]})
        
        for g in temp_groups:
            grupos.append({'valor': int(np.mean([key(lin) for lin in g['linhas']]))})

        return grupos

    vertical_groups = agrupar(vertical_lines, 'x')
    horizontal_groups = agrupar(horizontal_lines, 'y')

    # 7. Contagem de compartimentos
    if len(vertical_groups) < 2 or len(horizontal_groups) < 2:
        return image.copy(), 0

    colunas = len(vertical_groups) - 1
    linhas = len(horizontal_groups) - 1
    total_compartimentos = colunas * linhas
    
    # 8. Desenho das Linhas Finais na Imagem
    result_image = image.copy() 
    for g in vertical_groups:
        x = g['valor']
        cv2.line(result_image, (x, 0), (x, h), (255, 0, 255), 2) 
        
    for g in horizontal_groups:
        y = g['valor']
        cv2.line(result_image, (0, y), (w, y), (0, 255, 0), 2)
        
    return result_image, total_compartimentos

def process_image_pins(image: np.ndarray) -> tuple[np.ndarray, int]:
    """
    Processa a imagem para detectar pins usando segmentação HSV e Watershed.
    """
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
                
    return image_with_separated_contours, pins_count

def upload_processed_image_to_supabase(
    image: np.ndarray,
    timestamp: str,
    sha256: str,
    image_type: str
) -> str:
    """
    Faz upload de uma imagem processada para o Supabase Storage em formato PNG
    """
    try:
        success, buffer = cv2.imencode('.png', image)
        
        if not success:
            raise ValueError("Não foi possível codificar a imagem")
        
        image_bytes = buffer.tobytes()
        storage_path = f"{timestamp}/{sha256}/processed_{image_type}.png"
        
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        
        return storage_path
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao fazer upload da imagem processada: {str(e)}"
        )

# --- Rotas da API ---

@app.get("/")
def read_root():
    return {
        "message": "HawkEye Backend API",
        "version": "2.0.0",
        "status": "online"
    }


@app.post("/upload-image/", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """Faz upload de uma única imagem para o Supabase Storage e retorna os metadados."""
    valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não suportado: {file.content_type}. Use JPEG, PNG ou WEBP."
        )

    try:
        file_content = await file.read()
        sha256 = calculate_sha256(file_content)
        timestamp = str(int(time.time() * 1000))

        storage_path = f"{timestamp}/{sha256}/original_{file.filename}"
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        return UploadResponse(
            filename=file.filename,
            storage_path=storage_path,
            sha256=sha256,
            timestamp=timestamp
        )
    except Exception as e:
        print(f"Erro no upload para o Supabase: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no upload para o Supabase: {str(e)}"
        )


@app.post("/process-images/", response_model=ProcessImagesResponse)
async def process_images(request: ProcessImagesRequest):
    """
    Processa imagens do Supabase Storage:
    1. Baixa as imagens originais
    2. Processa (detecta áreas e pins)
    3. Faz upload das imagens processadas de volta ao Supabase
    4. Retorna URLs públicas e informações detalhadas
    """
    if not request.images:
        raise HTTPException(status_code=400, detail="Nenhuma imagem para processar.")
        
    processed_count = 0
    results = []

    try: 
        for img_info in request.images:
            print(f"Processando: {img_info.filename} (Path: {img_info.storage_path})")
            
            # 1. Baixa a imagem original do Supabase
            original_image = download_image_from_supabase(img_info.storage_path)
            
            # 2. Processa a imagem para detectar áreas e pins
            areas_image, areas_count = process_image_areas(original_image)
            pins_image, pins_count = process_image_pins(original_image)
            
            # 3. Faz upload das imagens processadas
            areas_path = upload_processed_image_to_supabase(
                areas_image,
                img_info.timestamp,
                img_info.sha256,
                "areas"
            )
            
            pins_path = upload_processed_image_to_supabase(
                pins_image,
                img_info.timestamp,
                img_info.sha256,
                "pins"
            )
            
            # 4. Obtém as URLs públicas (NOVO)
            original_url = get_public_url_from_supabase(img_info.storage_path)
            areas_url = get_public_url_from_supabase(areas_path)
            pins_url = get_public_url_from_supabase(pins_path)

            print(f"✔ Processado: {img_info.filename}")
            print(f"  - Áreas: {areas_count} | URL: {areas_url}")
            print(f"  - Pins: {pins_count} | URL: {pins_url}")
            
            results.append(ImageProcessResult(
                filename=img_info.filename,
                sha256=img_info.sha256,
                timestamp=img_info.timestamp,
                original_url=original_url,
                areas_url=areas_url,
                pins_url=pins_url,
                areas_count=areas_count,
                pins_count=pins_count
            ))
            
            processed_count += 1
        
        return ProcessImagesResponse(
            success=True,
            message=f"Todas as {processed_count} imagens foram processadas com sucesso",
            processed_count=processed_count,
            results=results
        )
        
    except Exception as e:
        print(f"Erro no processamento: {str(e)}")
        if not isinstance(e, HTTPException):
            raise HTTPException( 
                status_code=500,
                detail=f"Erro ao processar imagens: {str(e)}"
            )
        raise e


@app.get("/health")
def health_check():
    """Endpoint de health check"""
    try:
        supabase.storage.from_(SUPABASE_BUCKET).list()
        supabase_status = True
    except Exception:
        supabase_status = False

    return {"status": "healthy", "supabase_connected": supabase_status}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)