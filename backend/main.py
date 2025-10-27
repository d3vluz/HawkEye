from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import os
import time
import hashlib
from datetime import datetime
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
    """Informações sobre uma caixa individual"""
    x: int
    y: int
    width: int
    height: int
    pins_count: int
    status: str  # "empty", "single", "multiple"


class ImageProcessResult(BaseModel):
    filename: str
    sha256: str
    timestamp: str
    original_url: str
    areas_url: str
    pins_url: str
    boxes_url: str  # Nova URL para imagem com análise de caixas
    areas_count: int
    pins_count: int
    boxes_info: Dict[str, Any]  # Informações detalhadas sobre as caixas


class ProcessImagesResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    results: List[ImageProcessResult]


# --- Funções Utilitárias ---

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


# --- Funções de Processamento de Imagem ---

def process_image_areas(image: np.ndarray) -> Tuple[np.ndarray, int, List[int], List[int]]:
    """
    Processa a imagem para detectar a grade de compartimentos usando a lógica robusta.
    Usa bilateralFilter, Canny(50, 150) e HoughLinesP com threshold=120.
    
    Retorna:
        - result_image: Imagem com as linhas desenhadas
        - total_compartimentos: Número total de compartimentos
        - x_positions: Lista de posições X das linhas verticais
        - y_positions: Lista de posições Y das linhas horizontais
    """
    if image is None:
        return np.zeros((100, 100, 3), dtype=np.uint8), 0, [], []

    image_bgr = image.copy()
    h, w = image_bgr.shape[:2]
    
    # Detecta tons de cinza (bordas cinza) - LÓGICA ROBUSTA
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)  
    _, mask_gray = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    mask_gray = cv2.morphologyEx(mask_gray, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    edges = cv2.Canny(mask_gray, 50, 150, apertureSize=3)

    # Detecção de linhas com parâmetros robustos
    lines = cv2.HoughLinesP(
        edges, rho=1, theta=np.pi/180, threshold=120,
        minLineLength=100, maxLineGap=40
    )

    if lines is None:
        return image.copy(), 0, [], []

    # Classificar linhas em verticais e horizontais
    verticais, horizontais = [], []
    for l in lines:
        x1, y1, x2, y2 = l[0]
        if abs(x1 - x2) < abs(y1 - y2):  # vertical
            verticais.append(l)
        else:
            horizontais.append(l)

    # Função para agrupar linhas próximas
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

    # Agrupar linhas próximas
    x_positions = agrupar_linhas(verticais, 'x', tol=25, min_dist=50)
    y_positions = agrupar_linhas(horizontais, 'y', tol=25, min_dist=50)

    # Contagem de compartimentos
    if len(x_positions) < 2 or len(y_positions) < 2:
        return image.copy(), 0, x_positions, y_positions

    colunas = len(x_positions) - 1
    linhas_count = len(y_positions) - 1
    total_compartimentos = colunas * linhas_count
    
    # Desenho das linhas na imagem
    result_image = image.copy()
    for x in x_positions:
        cv2.line(result_image, (x, 0), (x, h), (255, 0, 255), 2)
    
    for y in y_positions:
        cv2.line(result_image, (0, y), (w, y), (0, 255, 0), 2)
    
    return result_image, total_compartimentos, x_positions, y_positions


def process_image_pins(image: np.ndarray) -> Tuple[np.ndarray, int, List[Tuple[int, int, int, int]]]:
    """
    Processa a imagem para detectar pins usando segmentação HSV e Watershed.
    Retorna a imagem processada, contagem de pins e lista de bounding boxes dos pins.
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
    pin_boxes = []  # Lista para armazenar as bounding boxes dos pins

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
                
                # Obter bounding box do pin
                x, y, w, h = cv2.boundingRect(contour)
                pin_boxes.append((x, y, w, h))
                
    return image_with_separated_contours, pins_count, pin_boxes


def process_image_boxes(
    image: np.ndarray, 
    pin_boxes: List[Tuple[int, int, int, int]],
    x_positions: List[int],
    y_positions: List[int]
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Analisa a ocupação das caixas usando as posições da grade já detectadas.
    
    Args:
        image: Imagem original
        pin_boxes: Lista de bounding boxes dos pins detectados [(x, y, w, h), ...]
        x_positions: Posições X das linhas verticais da grade
        y_positions: Posições Y das linhas horizontais da grade
    
    Returns:
        Tupla com (imagem_processada, informações_das_caixas)
    """
    image_result = cv2.cvtColor(image.copy(), cv2.COLOR_BGR2RGB)
    
    # Verificar se temos linhas suficientes para formar caixas
    if len(x_positions) < 2 or len(y_positions) < 2:
        print("⚠️ Linhas insuficientes para formar caixas")
        return cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR), {
            "total_boxes": 0,
            "empty_boxes": 0,
            "single_pin_boxes": 0,
            "multiple_pins_boxes": 0,
            "boxes": []
        }

    # Ordenar posições
    x_positions = sorted(x_positions)
    y_positions = sorted(y_positions)

    print(f"📊 Posições X: {len(x_positions)}")
    print(f"📊 Posições Y: {len(y_positions)}")

    # Criar caixas a partir das intersecções
    boxes = []
    for i in range(len(x_positions)-1):
        for j in range(len(y_positions)-1):
            x1, x2 = x_positions[i], x_positions[i+1]
            y1, y2 = y_positions[j], y_positions[j+1]
            boxes.append((x1, y1, x2-x1, y2-y1))

    print(f"📦 Total de caixas criadas: {len(boxes)}")

    # Analisar ocupação de cada caixa
    boxes_info_list = []
    empty_count = 0
    single_pin_count = 0
    multiple_pins_count = 0

    for (x, y, w, h) in boxes:
        # Contar quantos pins estão dentro desta caixa
        pins_inside = 0
        for (px, py, pw, ph) in pin_boxes:
            cx, cy = px + pw//2, py + ph//2  # Centro do pin
            if x < cx < x + w and y < cy < y + h:
                pins_inside += 1
        
        # Determinar status e cor
        if pins_inside == 0:
            status = "empty"
            color = (255, 0, 0)  # Vermelho para vazias
            empty_count += 1
        elif pins_inside == 1:
            status = "single"
            color = (0, 255, 0)  # Verde para 1 pin
            single_pin_count += 1
        else:
            status = "multiple"
            color = (255, 165, 0)  # Laranja para múltiplos pins
            multiple_pins_count += 1
        
        # Desenhar retângulo e texto
        cv2.rectangle(image_result, (x, y), (x+w, y+h), color, 2)
        cv2.putText(
            image_result, 
            str(pins_inside), 
            (x + w//2 - 10, y + h//2),
            cv2.FONT_HERSHEY_SIMPLEX, 
            0.8, 
            color, 
            2
        )
        
        boxes_info_list.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "pins_count": int(pins_inside),
            "status": status
        })

    # Adicionar informações de resumo na imagem
    y_offset = 40
    cv2.putText(image_result, f'Total Caixas: {len(boxes)}', (20, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 40
    cv2.putText(image_result, f'Vazias: {empty_count}', (20, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
    y_offset += 40
    cv2.putText(image_result, f'1 Pin: {single_pin_count}', (20, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    y_offset += 40
    cv2.putText(image_result, f'Multiplos: {multiple_pins_count}', (20, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 165, 0), 2)

    # Converter de volta para BGR para salvar
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)

    boxes_info = {
        "total_boxes": len(boxes),
        "empty_boxes": empty_count,
        "single_pin_boxes": single_pin_count,
        "multiple_pins_boxes": multiple_pins_count,
        "boxes": boxes_info_list
    }

    print(f"✅ Análise concluída: {empty_count} vazias, {single_pin_count} com 1 pin, {multiple_pins_count} com múltiplos")

    return image_result_bgr, boxes_info


# --- Rotas da API ---

@app.get("/")
def read_root():
    return {
        "message": "HawkEye Backend API",
        "version": "3.0.0",
        "status": "online",
        "features": ["areas", "pins", "boxes_analysis"]
    }


@app.post("/upload-image/", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...), batch_timestamp: str = None):
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
        
        # Usa o timestamp do lote ou gera um novo no formato: YYYY-MM-DDTHH-MI-SS
        if batch_timestamp:
            timestamp = batch_timestamp
        else:
            timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")

        # Estrutura: timestamp/sha256/original_filename
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


@app.post("/upload-batch/")
async def upload_batch(files: List[UploadFile] = File(...)):
    """
    Faz upload de um lote de imagens com timestamp único.
    Estrutura: YYYY-MM-DDTHH-MI-SS/sha256/original_filename
    """
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")
    
    # Gera timestamp único para todo o lote no formato: YYYY-MM-DDTHH-MI-SS
    batch_timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    
    uploaded_files = []
    
    for file in files:
        valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        if file.content_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de arquivo não suportado: {file.content_type}. Use JPEG, PNG ou WEBP."
            )
        
        try:
            file_content = await file.read()
            sha256 = calculate_sha256(file_content)
            
            # Estrutura: timestamp/sha256/original_filename
            storage_path = f"{batch_timestamp}/{sha256}/original_{file.filename}"
            
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=storage_path,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
            
            uploaded_files.append({
                "filename": file.filename,
                "storage_path": storage_path,
                "sha256": sha256,
                "timestamp": batch_timestamp
            })
            
        except Exception as e:
            print(f"Erro no upload de {file.filename}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Erro no upload de {file.filename}: {str(e)}"
            )
    
    return {
        "success": True,
        "batch_timestamp": batch_timestamp,
        "total_uploaded": len(uploaded_files),
        "files": uploaded_files
    }


@app.post("/process-images/", response_model=ProcessImagesResponse)
async def process_images(request: ProcessImagesRequest):
    """
    Processa imagens do Supabase Storage:
    1. Baixa as imagens originais
    2. Processa (detecta áreas e pins)
    3. Analisa caixas e ocupação (NOVO)
    4. Faz upload das imagens processadas de volta ao Supabase
    5. Retorna URLs públicas e informações detalhadas
    """
    if not request.images:
        raise HTTPException(status_code=400, detail="Nenhuma imagem para processar.")
        
    processed_count = 0
    results = []

    try: 
        for img_info in request.images:
            print(f"\n{'='*60}")
            print(f"🔄 Processando: {img_info.filename}")
            print(f"📂 Path: {img_info.storage_path}")
            print(f"{'='*60}")
            
            # 1. Baixa a imagem original do Supabase
            original_image = download_image_from_supabase(img_info.storage_path)
            print(f"✅ Imagem baixada: {original_image.shape}")
            
            # 2. Processa a imagem para detectar áreas (retorna também as posições das linhas)
            areas_image, areas_count, x_positions, y_positions = process_image_areas(original_image)
            print(f"✅ Áreas detectadas: {areas_count}")
            print(f"   Linhas verticais: {len(x_positions)}")
            print(f"   Linhas horizontais: {len(y_positions)}")
            
            # 3. Processa a imagem para detectar pins (agora retorna também pin_boxes)
            pins_image, pins_count, pin_boxes = process_image_pins(original_image)
            print(f"✅ Pins detectados: {pins_count}")
            
            # 4. Analisa as caixas usando as posições da grade já detectadas
            boxes_image, boxes_info = process_image_boxes(original_image, pin_boxes, x_positions, y_positions)
            print(f"✅ Caixas analisadas: {boxes_info['total_boxes']}")
            
            # 5. Faz upload das imagens processadas
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
            
            # NOVO: Upload da imagem com análise de caixas
            boxes_path = upload_processed_image_to_supabase(
                boxes_image,
                img_info.timestamp,
                img_info.sha256,
                "boxes"
            )
            
            # 6. Obtém as URLs públicas
            original_url = get_public_url_from_supabase(img_info.storage_path)
            areas_url = get_public_url_from_supabase(areas_path)
            pins_url = get_public_url_from_supabase(pins_path)
            boxes_url = get_public_url_from_supabase(boxes_path)  # NOVO

            print(f"\n📊 Resultados:")
            print(f"  - Áreas: {areas_count}")
            print(f"  - Pins: {pins_count}")
            print(f"  - Caixas totais: {boxes_info['total_boxes']}")
            print(f"  - Vazias: {boxes_info['empty_boxes']}")
            print(f"  - 1 Pin: {boxes_info['single_pin_boxes']}")
            print(f"  - Múltiplos: {boxes_info['multiple_pins_boxes']}")
            print(f"\n🔗 URLs geradas:")
            print(f"  - Original: {original_url}")
            print(f"  - Áreas: {areas_url}")
            print(f"  - Pins: {pins_url}")
            print(f"  - Boxes: {boxes_url}")
            
            results.append(ImageProcessResult(
                filename=img_info.filename,
                sha256=img_info.sha256,
                timestamp=img_info.timestamp,
                original_url=original_url,
                areas_url=areas_url,
                pins_url=pins_url,
                boxes_url=boxes_url,  # NOVO
                areas_count=areas_count,
                pins_count=pins_count,
                boxes_info=boxes_info  # NOVO
            ))
            
            processed_count += 1
            print(f"✅ Processamento concluído para {img_info.filename}\n")
        
        return ProcessImagesResponse(
            success=True,
            message=f"Todas as {processed_count} imagens foram processadas com sucesso",
            processed_count=processed_count,
            results=results
        )
        
    except Exception as e:
        print(f"❌ Erro no processamento: {str(e)}")
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

    return {
        "status": "healthy", 
        "supabase_connected": supabase_status,
        "version": "3.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)