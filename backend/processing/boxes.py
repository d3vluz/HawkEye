"""
Processamento de boxes/compartimentos.
Analisa cada compartimento da grade e conta pins dentro dele.
"""
import cv2
import numpy as np
from typing import Tuple, List, Dict, Any


# === Cores de visualização (RGB) ===

COLOR_EMPTY = (255, 0, 0)       # Vermelho: Compartimento vazio
COLOR_SINGLE = (0, 255, 0)      # Verde: Compartimento com 1 pin
COLOR_MULTIPLE = (255, 165, 0)  # Laranja: Compartimento com múltiplos pins


def process_boxes(
    image: np.ndarray,
    pin_boxes: List[Tuple[int, int, int, int]],
    x_positions: List[int],
    y_positions: List[int]
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Processa os compartimentos da grade e conta pins em cada um.
    
    Classifica cada compartimento como:
    - empty: Sem pins (defeito)
    - single: Exatamente 1 pin (correto)
    - multiple: Mais de 1 pin (defeito)
    
    Args:
        image: Imagem BGR de entrada
        pin_boxes: Lista de bounding boxes dos pins (x, y, w, h)
        x_positions: Posições X das linhas verticais da grade
        y_positions: Posições Y das linhas horizontais da grade
    
    Returns:
        Tuple contendo:
        - Imagem com compartimentos desenhados
        - Dicionário com informações dos boxes
    """
    image_result = cv2.cvtColor(image.copy(), cv2.COLOR_BGR2RGB)
    
    # Validar posições
    if len(x_positions) < 2 or len(y_positions) < 2:
        return cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR), {
            "total_boxes": 0,
            "empty_boxes": 0,
            "single_pin_boxes": 0,
            "multiple_pins_boxes": 0,
            "boxes": []
        }
    
    x_positions = sorted(x_positions)
    y_positions = sorted(y_positions)
    
    # Criar lista de boxes a partir da grade
    boxes = []
    for i in range(len(x_positions) - 1):
        for j in range(len(y_positions) - 1):
            x1, x2 = x_positions[i], x_positions[i + 1]
            y1, y2 = y_positions[j], y_positions[j + 1]
            boxes.append((x1, y1, x2 - x1, y2 - y1))
    
    # Analisar cada box
    boxes_info_list = []
    empty_count = 0
    single_pin_count = 0
    multiple_pins_count = 0
    
    for (x, y, w, h) in boxes:
        # Contar pins cujo centro está dentro do box
        pins_inside = 0
        for (px, py, pw, ph) in pin_boxes:
            cx, cy = px + pw // 2, py + ph // 2
            if x < cx < x + w and y < cy < y + h:
                pins_inside += 1
        
        # Classificar e definir cor
        if pins_inside == 0:
            status = "empty"
            color = COLOR_EMPTY
            empty_count += 1
        elif pins_inside == 1:
            status = "single"
            color = COLOR_SINGLE
            single_pin_count += 1
        else:
            status = "multiple"
            color = COLOR_MULTIPLE
            multiple_pins_count += 1
        
        # Desenhar retângulo e contagem
        cv2.rectangle(image_result, (x, y), (x + w, y + h), color, 2)
        cv2.putText(
            image_result,
            str(pins_inside),
            (x + w // 2 - 10, y + h // 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            color,
            2
        )
        
        # Adicionar info do box
        boxes_info_list.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "pins_count": int(pins_inside),
            "status": status
        })
    
    # Converter de volta para BGR
    image_result_bgr = cv2.cvtColor(image_result, cv2.COLOR_RGB2BGR)
    
    # Montar resultado
    boxes_info = {
        "total_boxes": len(boxes),
        "empty_boxes": empty_count,
        "single_pin_boxes": single_pin_count,
        "multiple_pins_boxes": multiple_pins_count,
        "boxes": boxes_info_list
    }
    
    return image_result_bgr, boxes_info