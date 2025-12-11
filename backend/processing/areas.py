"""
Processamento de áreas/compartimentos na imagem.
Detecta linhas verticais e horizontais para formar uma grade.
"""
import cv2
import numpy as np
from typing import Tuple, List


def _group_lines(
    lines: List, 
    axis: str = 'x', 
    tolerance: int = 25, 
    min_distance: int = 50
) -> List[int]:
    """
    Agrupa linhas próximas e retorna as posições médias.
    
    Args:
        lines: Lista de linhas detectadas pelo HoughLinesP
        axis: Eixo para agrupamento ('x' para verticais, 'y' para horizontais)
        tolerance: Tolerância para considerar linhas no mesmo grupo
        min_distance: Distância mínima entre grupos
    
    Returns:
        Lista de posições agrupadas
    """
    if lines is None or len(lines) == 0:
        return []
    
    coords = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if axis == 'x':
            coords.append((x1 + x2) / 2)
        else:
            coords.append((y1 + y2) / 2)
    
    coords = sorted(coords)
    grouped = []
    current_group = [coords[0]]
    
    for coord in coords[1:]:
        if abs(coord - np.mean(current_group)) < tolerance:
            current_group.append(coord)
        else:
            mean_val = int(np.mean(current_group))
            if not grouped or abs(mean_val - grouped[-1]) > min_distance:
                grouped.append(mean_val)
            current_group = [coord]
    
    # Processar último grupo
    mean_val = int(np.mean(current_group))
    if not grouped or abs(mean_val - grouped[-1]) > min_distance:
        grouped.append(mean_val)
    
    return grouped


def process_areas(
    image: np.ndarray
) -> Tuple[np.ndarray, int, List[int], List[int]]:
    """
    Processa a imagem para detectar áreas/compartimentos.
    
    Usa detecção de bordas e transformada de Hough para encontrar
    linhas verticais e horizontais que formam uma grade.
    
    Args:
        image: Imagem BGR de entrada
    
    Returns:
        Tuple contendo:
        - Imagem com linhas desenhadas
        - Total de compartimentos detectados
        - Lista de posições X (linhas verticais)
        - Lista de posições Y (linhas horizontais)
    """
    if image is None:
        return np.zeros((100, 100, 3), dtype=np.uint8), 0, [], []
    
    image_bgr = image.copy()
    h, w = image_bgr.shape[:2]
    
    # Pré-processamento
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    _, mask_gray = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask_gray = cv2.morphologyEx(mask_gray, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    
    # Detecção de bordas e linhas
    edges = cv2.Canny(mask_gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 
        rho=1, 
        theta=np.pi/180, 
        threshold=120, 
        minLineLength=100, 
        maxLineGap=40
    )
    
    if lines is None:
        return image.copy(), 0, [], []
    
    # Separar linhas verticais e horizontais
    vertical_lines = []
    horizontal_lines = []
    
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if abs(x1 - x2) < abs(y1 - y2):
            vertical_lines.append(line)
        else:
            horizontal_lines.append(line)
    
    # Agrupar linhas
    x_positions = _group_lines(vertical_lines, 'x', tolerance=25, min_distance=50)
    y_positions = _group_lines(horizontal_lines, 'y', tolerance=25, min_distance=50)
    
    if len(x_positions) < 2 or len(y_positions) < 2:
        return image.copy(), 0, x_positions, y_positions
    
    # Calcular total de compartimentos
    columns = len(x_positions) - 1
    rows = len(y_positions) - 1
    total_compartments = columns * rows
    
    # Desenhar resultado
    result_image = image.copy()
    
    for x in x_positions:
        cv2.line(result_image, (x, 0), (x, h), (255, 0, 255), 2)
    
    for y in y_positions:
        cv2.line(result_image, (0, y), (w, y), (0, 255, 0), 2)
    
    return result_image, total_compartments, x_positions, y_positions