import cv2
import numpy as np
import matplotlib.pyplot as plt

plt.rcParams['figure.figsize'] = [12, 12]

# --- CARREGAMENTO DA IMAGEM ---
image_path = 'valor de entrada'

# Tratamento de erro caso a imagem não exista no caminho
try:
    image_bgr = cv2.imread(image_path)
    if image_bgr is None: raise FileNotFoundError
except:
    print("Imagem não encontrada. Criando imagem preta para teste.")
    image_bgr = np.zeros((500, 500, 3), dtype=np.uint8)

image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
hsv_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

# --- 1. DEFINIÇÃO DAS MÁSCARAS HSV ---

# PINS PADRAO (Amarelos)
lower_yellow = np.array([10, 165, 100])
upper_yellow = np.array([30, 255, 255])
mask_yellow = cv2.inRange(hsv_image, lower_yellow, upper_yellow)

# PINS FORA DO PADRAO (Azul, Vermelho, Verde)
mask_blue = cv2.inRange(hsv_image, np.array([110, 60, 40]), np.array([125, 255, 170]))
mask_red = cv2.inRange(hsv_image, np.array([0, 151, 82]), np.array([15, 255, 255]))
mask_green = cv2.inRange(hsv_image, np.array([70, 0, 0]), np.array([100, 255, 255]))

mask_out_of_standard = (mask_blue | mask_red | mask_green)

# --- 2. FUNÇÃO WATERSHED ---

def apply_watershed(mask_input, min_area=500, threshold_factor=0.15):
    """Aplica o algoritmo Watershed para obter contornos que passaram pelo min_area."""
    kernel = np.ones((3,3), np.uint8)
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
        if label <= 1: continue
        
        object_mask = np.zeros(mask_input.shape, dtype="uint8")
        object_mask[markers == label] = 255
        contours, _ = cv2.findContours(object_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            if cv2.contourArea(contour) > min_area:
                final_contours.append(contour)
    return final_contours

# --- 3. EXECUÇÃO E CLASSIFICAÇÃO DETALHADA (4 CATEGORIAS INTERNAS) ---

# 1. Detecta candidatos baseados na COR primeiro
raw_out_contours = apply_watershed(mask_out_of_standard, min_area=300, threshold_factor=0.15)
raw_yellow_contours = apply_watershed(mask_yellow, min_area=300, threshold_factor=0.20)

# 2. Calcula Média Global e Limite de Dano
all_detected_contours = raw_yellow_contours + raw_out_contours
avg_area = 0
damage_threshold = 0

if len(all_detected_contours) > 0:
    all_areas = [cv2.contourArea(cnt) for cnt in all_detected_contours]
    avg_area = np.mean(all_areas)
    damage_threshold = avg_area * (2/3)
    print(f"Área Média: {avg_area:.0f} px | Limite de Dano: {damage_threshold:.0f} px")

# Listas para armazenar a classificação detalhada (necessário para a lógica)
pins_ok = []                  
pins_wrong_color = []         
pins_damaged_yellow = []      
pins_double_defect = []       

# A. Analisando os Amarelos
for cnt in raw_yellow_contours:
    area = cv2.contourArea(cnt)
    if area < damage_threshold:
        pins_damaged_yellow.append(cnt)
    else:
        pins_ok.append(cnt)

# B. Analisando os de Cor Errada
for cnt in raw_out_contours:
    area = cv2.contourArea(cnt)
    if area < damage_threshold:
        pins_double_defect.append(cnt) 
    else:
        pins_wrong_color.append(cnt)

# --- 4. AGRUPAMENTO PARA VISUALIZAÇÃO EM 3 CORES ---

# Categoria 1: VÁLIDO (Verde) -> Pino Perfeito
final_green = pins_ok
count_green = len(final_green)

# Categoria 2: INVÁLIDO (Laranja) -> Apenas um erro (Cor Errada OU Apenas Danificado Amarelo)
final_orange = pins_wrong_color + pins_damaged_yellow
count_orange = len(final_orange)

# Categoria 3: UM OU MAIS ERROS (Vermelho) -> Defeito Duplo (Cor Errada E Danificado)
final_red = pins_double_defect
count_red = len(final_red)

total = count_green + count_orange + count_red

# --- 5. EXIBIÇÃO DO RESULTADO ---

image_result = image_rgb.copy()

# Legenda de Cores (R, G, B)
COLOR_VALID = (0, 255, 0)        # VERDE: Válido (Perfeito)
COLOR_INVALID = (255, 165, 0)    # LARANJA: Inválido (Erro Único)
COLOR_CRITICAL = (255, 0, 0)     # VERMELHO: Crítico (Erro Duplo)

# Desenhar
cv2.drawContours(image_result, final_green, -1, COLOR_VALID, 3) 
cv2.drawContours(image_result, final_orange, -1, COLOR_INVALID, 3)
cv2.drawContours(image_result, final_red, -1, COLOR_CRITICAL, 3)

# Montar Título Informativo
title_text = (f"Total de Pins: {total} | Limite de Dano: {damage_threshold:.0f}px\n"
              f"🟢 VÁLIDO (Perfeito): {count_green} | "
              f"🟠 INVÁLIDO (Erro Único): {count_orange} | "
              f"🔴 CRÍTICO (Duplo Erro): {count_red}")

plt.imshow(image_result)
plt.title(title_text, fontsize=12)
plt.axis('off')
plt.show()