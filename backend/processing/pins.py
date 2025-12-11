"""
Processamento de pins na imagem.
Detecta, classifica e conta pins por cor e condição.
"""
import cv2
import numpy as np
from typing import Tuple, List, Dict, Any


# === Constantes de cor (HSV) ===

# Pins padrão (Amarelos)
LOWER_YELLOW = np.array([10, 165, 100])
UPPER_YELLOW = np.array([30, 255, 255])

# Pins fora do padrão
LOWER_BLUE = np.array([110, 60, 40])
UPPER_BLUE = np.array([125, 255, 170])

LOWER_RED = np.array([0, 151, 82])
UPPER_RED = np.array([15, 255, 255])

LOWER_GREEN = np.array([70, 0, 0])
UPPER_GREEN = np.array([100, 255, 255])

# === Cores de visualização (RGB) ===

COLOR_VALID = (0, 255, 0)       # Verde: Válido (Perfeito)
COLOR_INVALID = (255, 165, 0)   # Laranja: Inválido (Erro Único)
COLOR_CRITICAL = (255, 0, 0)    # Vermelho: Crítico (Erro Duplo)


def _apply_watershed(
    image_rgb: np.ndarray,
    mask_input: np.ndarray,
    min_area: int = 500,
    threshold_factor: float = 0.15
) -> List[np.ndarray]:
    """
    Aplica o algoritmo Watershed para separar objetos conectados.
    
    Args:
        image_rgb: Imagem RGB de entrada
        mask_input: Máscara binária dos objetos
        min_area: Área mínima para considerar um contorno válido
        threshold_factor: Fator para threshold da transformada de distância
    
    Returns:
        Lista de contornos que passaram pelo filtro de área mínima
    """
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(mask_input, cv2.MORPH_OPEN, kernel, iterations=1)
    sure_bg = cv2.dilate(opening, kernel, iterations=2)
    
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(
        dist_transform, 
        threshold_factor * dist_transform.max(), 
        255, 
        0
    )
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
        contours, _ = cv2.findContours(
            object_mask, 
            cv2.RETR_EXTERNAL, 
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        for contour in contours:
            if cv2.contourArea(contour) > min_area:
                final_contours.append(contour)
    
    return final_contours


def process_pins(
    image: np.ndarray
) -> Tuple[np.ndarray, int, List[Tuple[int, int, int, int]], Dict[str, Any]]:
    """
    Processa pins com detecção de cores erradas e danos.
    
    Classifica pins em 4 categorias:
    - OK: Amarelos perfeitos
    - Cor errada: Azul/Vermelho/Verde, mas não danificados
    - Danificados: Amarelos com área abaixo do limiar
    - Defeito duplo: Cor errada E danificados
    
    Para visualização, agrupa em 3 cores:
    - Verde (válido): Pins perfeitos
    - Laranja (inválido): Erro único (cor OU dano)
    - Vermelho (crítico): Erro duplo (cor E dano)
    
    Args:
        image: Imagem BGR de entrada
    
    Returns:
        Tuple contendo:
        - Imagem com contornos desenhados
        - Contagem total de pins
        - Lista de bounding boxes (x, y, w, h)
        - Dicionário com classificação detalhada
    """
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    hsv_image = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # --- Criar máscaras HSV ---
    
    mask_yellow = cv2.inRange(hsv_image, LOWER_YELLOW, UPPER_YELLOW)
    
    mask_blue = cv2.inRange(hsv_image, LOWER_BLUE, UPPER_BLUE)
    mask_red = cv2.inRange(hsv_image, LOWER_RED, UPPER_RED)
    mask_green = cv2.inRange(hsv_image, LOWER_GREEN, UPPER_GREEN)
    mask_out_of_standard = mask_blue | mask_red | mask_green
    
    # --- Aplicar Watershed ---
    
    raw_out_contours = _apply_watershed(
        image_rgb, mask_out_of_standard, min_area=300, threshold_factor=0.15
    )
    raw_yellow_contours = _apply_watershed(
        image_rgb, mask_yellow, min_area=300, threshold_factor=0.20
    )
    
    # --- Calcular média e limiar de dano ---
    
    all_detected_contours = raw_yellow_contours + raw_out_contours
    avg_area = 0.0
    damage_threshold = 0.0
    
    if len(all_detected_contours) > 0:
        all_areas = [cv2.contourArea(cnt) for cnt in all_detected_contours]
        avg_area = float(np.mean(all_areas))
        damage_threshold = avg_area * (2/3)
    
    # --- Classificação detalhada (4 categorias) ---
    
    pins_ok = []              # Amarelos perfeitos
    pins_wrong_color = []     # Cor errada, mas não danificados
    pins_damaged_yellow = []  # Amarelos danificados
    pins_double_defect = []   # Cor errada E danificados
    
    # Analisar amarelos
    for cnt in raw_yellow_contours:
        area = cv2.contourArea(cnt)
        if area < damage_threshold:
            pins_damaged_yellow.append(cnt)
        else:
            pins_ok.append(cnt)
    
    # Analisar cores erradas
    for cnt in raw_out_contours:
        area = cv2.contourArea(cnt)
        if area < damage_threshold:
            pins_double_defect.append(cnt)
        else:
            pins_wrong_color.append(cnt)
    
    # --- Agrupamento para visualização (3 cores) ---
    
    # Verde: Válido (Pino Perfeito)
    final_green = pins_ok
    count_green = len(final_green)
    
    # Laranja: Inválido (Apenas um erro)
    final_orange = pins_wrong_color + pins_damaged_yellow
    count_orange = len(final_orange)
    
    # Vermelho: Crítico (Defeito Duplo)
    final_red = pins_double_defect
    count_red = len(final_red)
    
    total = count_green + count_orange + count_red
    
    # --- Desenhar resultado ---
    
    image_result = image_rgb.copy()
    
    cv2.drawContours(image_result, final_green, -1, COLOR_VALID, 3)
    cv2.drawContours(image_result, final_orange, -1, COLOR_INVALID, 3)
    cv2.drawContours(image_result, final_red, -1, COLOR_CRITICAL, 3)
    
    # Converter de volta para BGR
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)
    
    # --- Extrair bounding boxes ---
    
    pin_boxes = []
    all_contours = final_green + final_orange + final_red
    for contour in all_contours:
        x, y, w, h = cv2.boundingRect(contour)
        pin_boxes.append((x, y, w, h))
    
    # --- Classificação para retorno ---
    
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