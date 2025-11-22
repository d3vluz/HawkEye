"""
Módulo de Processamento de Hastes (Shafts) - VERSÃO CORRIGIDA E INTEGRADA
Mantém TODAS as etapas do pipeline original e corrige a reversão espacial:
1. Centralização da borda (com retorno de matriz de transformação)
2. Remoção da borda usando máscara estática
3. Extração de dados dos pins
4. Remoção do corpo dos pins
5. Criação de máscara de hastes
6. Aplicação da máscara
7. Segmentação de hastes
8. Classificação de hastes
9. Reversão da imagem para o contexto original
"""

import cv2
import numpy as np
import math
from typing import Tuple, List, Dict, Any, Optional, Union

# ===================== CONFIGURAÇÕES GLOBAIS =====================

# Intervalo HSV para pins amarelos
LOWER_YELLOW = np.array([10, 165, 100])
UPPER_YELLOW = np.array([30, 255, 255])

# Área mínima do corpo do pin
MIN_AREA_PIN = 2000

# Intervalo RGB para fundo natural
LOWER_BG = np.array([20, 18, 22], dtype=np.float32)
UPPER_BG = np.array([30, 28, 32], dtype=np.float32)

# Parâmetros do trapézio para máscara de hastes
TRAP_LENGTH = 105
HALF_WIDTH_BASE_MENOR = 13
HALF_WIDTH_BASE_MAIOR = 21
OFFSET_START = 1

# Parâmetros de classificação de hastes
MIN_LENGTH = 40
MAX_LENGTH = 110
MIN_WIDTH = 1
MAX_WIDTH = 15
MIN_STRAIGHTNESS = 0.85
MIN_LENGTH_SECUNDARIO = 75

# Parâmetros de segmentação
MIN_AREA_SHAFT = 10

# Parâmetros de centralização de borda
MAX_ADJUST_DEG = 8.0
MIN_EFFECTIVE_ROT = 0.01


# ===================== FUNÇÕES AUXILIARES - GEOMETRIA =====================

def unit_vector(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=float)
    n = np.linalg.norm(v)
    if n == 0:
        return v
    return v / n

def perpendicular(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=float)
    return np.array([-v[1], v[0]], dtype=float)

def compute_pca_axis(points: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    points = np.asarray(points, dtype=float)
    centroid = np.mean(points, axis=0)
    centered = points - centroid
    try:
        _, _, Vt = np.linalg.svd(centered, full_matrices=False)
        principal_axis = Vt[0]
        principal_axis = principal_axis / np.linalg.norm(principal_axis)
    except Exception:
        cov = np.cov(centered.T)
        eigvals, eigvecs = np.linalg.eig(cov)
        idx = np.argsort(eigvals)[::-1]
        principal_axis = unit_vector(eigvecs[:, idx[0]].real)
    return centroid, principal_axis

def find_extremity_pair_on_best_perp(pts, centroid, main_u, perp_u, end='min', strip_width=20, samples=15, proj_tol=None):
    proj_all = np.dot(pts - centroid, main_u)
    min_p, max_p = proj_all.min(), proj_all.max()
    
    if end == 'min':
        start = min_p
        end_val = min_p + strip_width
    else:
        start = max_p - strip_width
        end_val = max_p
    
    candidate_projs = np.linspace(start, end_val, samples)
    best_width = -1.0
    best_pair = (None, None)
    best_proj = None
    tol = (strip_width / samples) * 0.6 if proj_tol is None else proj_tol
    
    for cp in candidate_projs:
        mask_line = np.abs(proj_all - cp) <= tol
        if np.count_nonzero(mask_line) < 2:
            continue
        line_pts = pts[mask_line]
        perp_coords = np.dot(line_pts - centroid, perp_u)
        idx_min = np.argmin(perp_coords)
        idx_max = np.argmax(perp_coords)
        left_pt = line_pts[idx_min]
        right_pt = line_pts[idx_max]
        width = perp_coords[idx_max] - perp_coords[idx_min]
        
        if width > best_width:
            best_width = width
            best_pair = (left_pt, right_pt)
            best_proj = cp
            
    if best_width <= 0:
        return (None, None, None, 0.0)
    return (best_pair[0], best_pair[1], best_proj, float(best_width))

def find_outward_border_point_and_dir_for_end(contour_pts, centroid, main_u, which_end='max'):
    proj = np.dot(contour_pts - centroid, main_u)
    idx = np.argmax(proj) if which_end == 'max' else np.argmin(proj)
    border_pt = contour_pts[idx]
    dir_u = main_u.copy()
    test_vec = border_pt - centroid
    if np.dot(test_vec, dir_u) < 0:
        dir_u = -dir_u
    return border_pt, dir_u

def compute_axis_intersection(axis_pt, axis_dir, point_on_perp):
    axis_pt = np.asarray(axis_pt, dtype=float)
    d = unit_vector(axis_dir)
    B = np.asarray(point_on_perp, dtype=float)
    n = unit_vector(perpendicular(d))
    M = np.column_stack((d, -n))
    rhs = (B - axis_pt)
    try:
        if abs(np.linalg.det(M)) < 1e-8:
            t = float(np.dot(B - axis_pt, d))
        else:
            sol = np.linalg.solve(M, rhs)
            t = float(sol[0])
        inter = axis_pt + d * t
        return np.round(inter, 4)
    except Exception:
        t = float(np.dot(B - axis_pt, d))
        inter = axis_pt + d * t
        return np.round(inter, 4)

def fbm_noise(h: int, w: int, octaves: int = 5) -> np.ndarray:
    noise_total = np.zeros((h, w, 3), np.float32)
    freq = 1.0
    amp = 1.0
    for _ in range(octaves):
        n = np.random.rand(h, w, 3).astype(np.float32)
        k = int(max(3, (40 // freq)))
        if k % 2 == 0: k += 1
        n = cv2.GaussianBlur(n, (k, k), 0)
        noise_total += n * amp
        freq *= 2.0
        amp *= 0.5
    noise_total /= noise_total.max()
    return noise_total


# ===================== ETAPA 0: CENTRALIZAÇÃO DA BORDA =====================

def angle_from_fitline(vx, vy):
    ang = math.degrees(math.atan2(np.asarray(vy).item(), np.asarray(vx).item()))
    ang = ((ang + 180) % 180) - 90
    return ang

def rotation_to_align(angle_deg):
    ang_mod = angle_deg % 180
    opt0 = -ang_mod
    opt90 = 90 - ang_mod
    return opt0 if abs(opt0) < abs(opt90) else opt90

def centralize_border(image_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Centraliza a borda e retorna a imagem processada, a matriz de transformação (3x3)
    e a máscara da região original (para reversão).
    """
    H, W = image_bgr.shape[:2]
    
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 1.2)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        # Retorna identidade se falhar
        return image_bgr.copy(), np.eye(3, dtype=np.float64), np.zeros((H,W), dtype=np.uint8)
    
    cnt = max(contours, key=cv2.contourArea)
    
    # Máscara original para saber onde desenhar na reversão
    mask_original = np.zeros((H, W), dtype=np.uint8)
    cv2.drawContours(mask_original, [cnt], -1, 255, -1)
    
    # Cálculo de rotação
    vx, vy, _, _ = cv2.fitLine(cnt, cv2.DIST_L2, 0, 0.01, 0.01)
    ang_fit = angle_from_fitline(vx, vy)
    
    ys = cnt[:, 0, 1]
    ymin, ymax = np.percentile(ys, [10, 90])
    mask_top_idx = np.where(ys < ymin + (ymax - ymin) * 0.15)[0]
    mask_bot_idx = np.where(ys > ymax - (ymax - ymin) * 0.15)[0]
    
    def safe_angle(idx_arr, fallback):
        try:
            if len(idx_arr) < 2: return fallback
            pts = cnt[idx_arr]
            vx2, vy2, _, _ = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01)
            return angle_from_fitline(vx2, vy2)
        except Exception: return fallback
    
    ang_top = safe_angle(mask_top_idx, ang_fit)
    ang_bot = safe_angle(mask_bot_idx, ang_fit)
    ang_global = float(np.median([ang_fit, ang_top, ang_bot]))
    diff_tb = abs(ang_top - ang_bot)
    conf = float(max(0.0, 1.0 - diff_tb / 5.0))
    
    rot_needed = rotation_to_align(ang_global)
    if abs(rot_needed) < MIN_EFFECTIVE_ROT or conf < 0.1:
        rot_needed = 0.0
    rot_needed = float(np.clip(rot_needed, -MAX_ADJUST_DEG, MAX_ADJUST_DEG))
    
    # Matrizes
    center = (W / 2.0, H / 2.0)
    Mrot_2x3 = cv2.getRotationMatrix2D(center, -rot_needed, 1.0).astype(np.float64)
    
    M = cv2.moments(cnt)
    if M["m00"] == 0: cx, cy = int(W/2), int(H/2)
    else: cx, cy = float(M["m10"]/M["m00"]), float(M["m01"]/M["m00"])
    
    dx = float((W / 2.0) - cx)
    dy = float((H / 2.0) - cy)
    
    Mshift_3 = np.eye(3, dtype=np.float64)
    Mshift_3[0, 2] = dx
    Mshift_3[1, 2] = dy
    
    Mrot_3 = np.eye(3, dtype=np.float64)
    Mrot_3[:2, :] = Mrot_2x3
    
    M_total_3 = Mshift_3 @ Mrot_3
    M_total_2x3 = M_total_3[:2, :].astype(np.float64)
    
    final_bgr = cv2.warpAffine(image_bgr, M_total_2x3, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    
    return final_bgr, M_total_3, mask_original


def revert_transformation(
    processed_image: np.ndarray, 
    original_background: np.ndarray, 
    M_total: np.ndarray, 
    mask_original: np.ndarray
) -> np.ndarray:
    """
    Reverte a transformação espacial, colando o resultado processado de volta na imagem original.
    Corresponde à lógica do Etapa-4_reverterBorda.py.
    """
    H, W = original_background.shape[:2]
    
    # Calcular inversa da transformação total
    try:
        M_inv = np.linalg.inv(M_total)
    except np.linalg.LinAlgError:
        M_inv = np.eye(3)
        
    M_inv_2x3 = M_inv[:2, :]
    
    # Warp da imagem processada de volta para a geometria original
    reconstructed = cv2.warpAffine(processed_image, M_inv_2x3, (W, H),
                                   flags=cv2.INTER_LINEAR, borderValue=(0,0,0))
    
    # Colocar ROI revertida sobre background original
    final = original_background.copy()
    mask_bool = (mask_original > 0)
    
    # Aplicar apenas onde a máscara original permite (na região da placa)
    # Se a reconstrução for preta (0,0,0) por causa da borda, mantemos o fundo original?
    # A lógica da Etapa 4 sobrepõe tudo onde mask_bool é True.
    final[mask_bool] = reconstructed[mask_bool]
    
    return final


# ===================== ETAPAS 1-7: PROCESSAMENTO DE IMAGEM =====================

def remove_border_with_mask(image_bgr: np.ndarray, border_mask: Optional[np.ndarray] = None) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    if border_mask is None:
        return image_bgr.copy()
    
    # Garante que a máscara bata com o tamanho da imagem (importante se houve conversões)
    if border_mask.shape[:2] != (h, w):
        mask_resized = cv2.resize(border_mask, (w, h))
    else:
        mask_resized = border_mask

    if len(mask_resized.shape) == 3:
        gray = cv2.cvtColor(mask_resized, cv2.COLOR_BGR2GRAY)
    else:
        gray = mask_resized
        
    _, mask_white = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    kernel_2px = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    mask_white = cv2.erode(mask_white, kernel_2px)
    mask_bin = (mask_white == 0).astype(np.uint8)
    
    dist_float = cv2.distanceTransform(mask_bin, cv2.DIST_L2, 5)
    max_dist = max(dist_float.max(), 1.0)
    fade = (dist_float / max_dist).astype(np.float32)
    fade[fade > 1] = 1.0
    
    fade_expanded = fade[:, :, None]
    fade_inv = 1.0 - fade_expanded
    
    texture = fbm_noise(h, w)
    diff = UPPER_BG - LOWER_BG
    noise_smooth = LOWER_BG + texture * diff
    noise_smooth = noise_smooth.astype(np.float32)
    
    grad = noise_smooth * fade_inv + LOWER_BG * fade_expanded
    grad = np.clip(grad, 0, 255).astype(np.uint8)
    
    result = image_bgr.copy()
    mask_indices = (mask_bin == 1)
    result[mask_indices] = grad[mask_indices]
    
    return result

def extract_pin_data(image_bgr: np.ndarray) -> List[Dict[str, Any]]:
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, LOWER_YELLOW, UPPER_YELLOW)
    contours_data = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = contours_data[-2]
    pins_data = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_AREA_PIN: continue
        
        obj_mask = np.zeros_like(mask)
        cv2.drawContours(obj_mask, [cnt], -1, 255, -1)
        ys, xs = np.where(obj_mask > 0)
        if len(xs) < 5: continue
        
        pts = np.vstack((xs, ys)).T.astype(np.float32)
        centroid, main_u = compute_pca_axis(pts)
        perp_u = unit_vector(perpendicular(main_u))
        
        strip_frac = 0.12
        strip_min_px = 12
        length_est = np.ptp(np.dot(pts - centroid, main_u))
        strip_width = max(strip_min_px, strip_frac * max(1.0, length_est))
        
        left1, right1, _, width1 = find_extremity_pair_on_best_perp(pts, centroid, main_u, perp_u, end='min', strip_width=strip_width)
        left2, right2, _, width2 = find_extremity_pair_on_best_perp(pts, centroid, main_u, perp_u, end='max', strip_width=strip_width)
        
        if left1 is None or right1 is None or left2 is None or right2 is None: continue
        
        if width2 >= width1:
            superior_pair = (left2, right2)
            inferior_pair = (left1, right1)
            which_end = 'max'
        else:
            superior_pair = (left1, right1)
            inferior_pair = (left2, right2)
            which_end = 'min'
            
        def mean_pt(pair): return None if pair[0] is None else (pair[0] + pair[1]) / 2.0
        superior_center = mean_pt(superior_pair)
        inferior_center = mean_pt(inferior_pair)
        
        contour_pts = cnt.reshape(-1, 2).astype(np.float32)
        try:
            border_pt, _ = find_outward_border_point_and_dir_for_end(contour_pts, centroid, main_u, which_end=which_end)
        except Exception: border_pt = None
        
        real_u = None
        if superior_center is not None and inferior_center is not None:
            v = superior_center - inferior_center
            if np.linalg.norm(v) > 1e-6: real_u = unit_vector(v)
        if real_u is None: real_u = main_u.copy()
        if border_pt is not None:
            if np.dot(real_u, (border_pt - centroid)) < 0: real_u = -real_u
            
        inter_sup = compute_axis_intersection(centroid, real_u, superior_center) if superior_center is not None else None
        inter_inf = compute_axis_intersection(centroid, real_u, inferior_center) if inferior_center is not None else None
        
        if inter_sup is not None and inter_inf is not None:
            pins_data.append({'inter_sup': inter_sup, 'inter_inf': inter_inf, 'axis': real_u})
    return pins_data

def remove_pin_bodies(image_bgr: np.ndarray) -> np.ndarray:
    hsv_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv_image, LOWER_YELLOW, UPPER_YELLOW)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered_mask = np.zeros_like(mask)
    for contour in contours:
        if cv2.contourArea(contour) > MIN_AREA_PIN:
            cv2.drawContours(filtered_mask, [contour], -1, 255, -1)
            
    kernel = np.ones((7, 7), np.uint8)
    expanded_mask = cv2.dilate(filtered_mask, kernel, iterations=1)
    mask_bin = (expanded_mask == 255).astype(np.uint8)
    
    dist_float = cv2.distanceTransform(mask_bin, cv2.DIST_L2, 5)
    max_dist = dist_float.max()
    if max_dist < 1: max_dist = 1.0
    
    fade = (dist_float / max_dist).astype(np.float32)
    fade[fade > 1] = 1.0
    diff = UPPER_BG - LOWER_BG
    grad = LOWER_BG + fade[:, :, None] * diff
    grad = np.clip(grad, 0, 255).astype(np.uint8)
    
    result_rgb = image_bgr.copy()
    mask_indices = (mask_bin == 1)
    result_rgb[mask_indices] = grad[mask_indices]
    return result_rgb

def make_trapezoid(inter_sup, inter_inf, length, half_width_base_menor, half_width_base_maior, offset_start=0):
    inter_sup, inter_inf = np.array(inter_sup), np.array(inter_inf)
    vec_sup_inf = inter_inf - inter_sup
    vec_oposto = -vec_sup_inf
    norm = np.linalg.norm(vec_oposto)
    if norm == 0: return None
    unit_vec = vec_oposto / norm
    start_point = inter_sup + unit_vec * offset_start
    tip = start_point + unit_vec * length
    perp_maior = np.array([-unit_vec[1], unit_vec[0]]) * half_width_base_maior
    perp_menor = np.array([-unit_vec[1], unit_vec[0]]) * half_width_base_menor
    p1, p2 = start_point + perp_maior, start_point - perp_maior
    p3, p4 = tip - perp_menor, tip + perp_menor
    return np.array([p1, p2, p3, p4], dtype=np.int32)

def create_shaft_mask(image_bgr: np.ndarray, pins_data: List[Dict[str, Any]]) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    for pin_data in pins_data:
        trap = make_trapezoid(
            pin_data['inter_sup'], pin_data['inter_inf'], TRAP_LENGTH,
            half_width_base_menor=HALF_WIDTH_BASE_MENOR,
            half_width_base_maior=HALF_WIDTH_BASE_MAIOR,
            offset_start=OFFSET_START
        )
        if trap is not None:
            cv2.fillPoly(mask, [trap], 255)
    return mask

def apply_shaft_mask(image_bgr: np.ndarray, shaft_mask: np.ndarray) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    base_color = ((LOWER_BG + UPPER_BG) // 2).astype(np.uint8)
    background_template = np.tile(base_color, (h, w, 1))
    variation_scale = 0.15
    noise = np.random.randint(
        low=-variation_scale * (UPPER_BG - LOWER_BG),
        high=variation_scale * (UPPER_BG - LOWER_BG) + 1,
        size=(h, w, 3)
    ).astype(np.int16)
    background = np.clip(background_template.astype(np.int16) + noise, LOWER_BG, UPPER_BG).astype(np.uint8)
    background = cv2.GaussianBlur(background, (25, 25), 0)
    
    mask_smooth = cv2.GaussianBlur(shaft_mask, (21, 21), 0)
    mask_smooth = mask_smooth.astype(np.float32) / 255.0
    
    result = (image_bgr.astype(np.float32) * mask_smooth[..., np.newaxis] +
              background.astype(np.float32) * (1.0 - mask_smooth[..., np.newaxis]))
    return np.clip(result, 0, 255).astype(np.uint8)

def segment_shafts(image_bgr: np.ndarray) -> Tuple[np.ndarray, List[np.ndarray]]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered_contours = [cnt for cnt in contours if cv2.contourArea(cnt) >= MIN_AREA_SHAFT]
    return mask, filtered_contours

def linearidade_pca(contour: np.ndarray) -> Tuple[float, Optional[Tuple], Optional[Tuple]]:
    cont_pts = contour.reshape(-1, 2).astype(np.float32)
    if len(cont_pts) < 2: return 0.0, None, None
    mean, eigvecs = cv2.PCACompute(cont_pts, mean=None)
    dx, dy = eigvecs[0]
    proj = np.dot(cont_pts - mean, eigvecs[0])
    idx_min, idx_max = np.argmin(proj), np.argmax(proj)
    p_ext1, p_ext2 = cont_pts[idx_min], cont_pts[idx_max]
    comprimento = math.hypot(p_ext2[0] - p_ext1[0], p_ext2[1] - p_ext1[1])
    if comprimento <= 0: return 0.0, tuple(p_ext1.astype(int)), tuple(p_ext2.astype(int))
    norma = comprimento
    dists = np.abs(dy * (cont_pts[:, 0] - p_ext1[0]) - dx * (cont_pts[:, 1] - p_ext1[1])) / (norma + 1e-9)
    straightness = 1 - (np.mean(dists) / (norma / 2 + 1e-9))
    return float(np.clip(straightness, 0, 1)), tuple(p_ext1.astype(int)), tuple(p_ext2.astype(int))

def analyze_shafts(contours: List[np.ndarray]) -> List[Dict[str, Any]]:
    shafts_info = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_AREA_SHAFT: continue
        pts = cnt[:, 0, :]
        dists = np.sqrt(np.sum((pts[:, None, :] - pts[None, :, :]) ** 2, axis=2))
        length = np.max(dists)
        width = area / length if length != 0 else 0
        straightness, p1, p2 = linearidade_pca(cnt)
        theta = math.atan2(p2[1] - p1[1], p2[0] - p1[0]) if p1 is not None and p2 is not None else 0.0
        aprovado = (MIN_LENGTH <= length <= MAX_LENGTH and MIN_WIDTH <= width <= MAX_WIDTH and straightness >= MIN_STRAIGHTNESS)
        shafts_info.append({
            'area': float(area), 'length': float(length), 'width': float(width),
            'straightness': float(straightness), 'inclination_rad': float(theta),
            'approved': bool(aprovado), 'extremities': (p1, p2), 'contour': cnt
        })
    return shafts_info

def apply_secondary_parameter(shafts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    reprovadas_primario = [h for h in shafts if not h['approved']]
    if len(reprovadas_primario) > 0: return shafts
    candidatas = [h for h in shafts if h['length'] <= MIN_LENGTH_SECUNDARIO]
    if len(candidatas) == 0: return shafts
    menor_haste = min(candidatas, key=lambda x: x['length'])
    menor_haste['rejected_secondary'] = True
    menor_haste['approved'] = False
    return shafts


# ===================== PIPELINE COMPLETO INTEGRADO =====================

def process_shafts_complete(
    image_bgr: np.ndarray,
    border_mask: Optional[Union[np.ndarray, str]] = None,
    apply_border_centralization: bool = True,
    apply_border_removal: bool = True
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Pipeline completo.
    
    Args:
        image_bgr: Imagem original.
        border_mask: Caminho para a imagem da máscara OU array numpy da máscara.
        apply_border_centralization: True para alinhar a placa.
        apply_border_removal: True para remover a borda da placa.
    """
    
    # 0. Preparação da imagem original e variáveis de estado
    original_input = image_bgr.copy()
    current_image = image_bgr.copy()
    M_total = np.eye(3, dtype=np.float64)
    mask_original_roi = np.ones(image_bgr.shape[:2], dtype=np.uint8) * 255
    
    # 1. Carregar máscara de borda se for string (caminho)
    loaded_border_mask = None
    if isinstance(border_mask, str):
        loaded_border_mask = cv2.imread(border_mask)
        if loaded_border_mask is None:
            print(f"AVISO: Máscara não encontrada no caminho: {border_mask}")
    elif isinstance(border_mask, np.ndarray):
        loaded_border_mask = border_mask

    # 2. Centralização da borda (Se ativada)
    if apply_border_centralization:
        # Importante: Captura M_total e mask_original para reversão futura
        current_image, M_total, mask_original_roi = centralize_border(current_image)
    
    # 3. Remoção da borda (Se ativada)
    if apply_border_removal and loaded_border_mask is not None:
        # O loaded_border_mask é assumido como estático e alinhado para a imagem centralizada
        current_image = remove_border_with_mask(current_image, loaded_border_mask)
    
    # 4. Pipeline de Detecção
    # Detecta pins, remove corpo, cria máscara haste, isola e segmenta
    pins_data = extract_pin_data(current_image)
    
    if not pins_data:
        # Se não achou nada, retorna a imagem original
        return original_input, {
            'total_shafts': 0, 'approved_shafts': 0, 'rejected_shafts': 0, 'shafts': []
        }
    
    image_no_bodies = remove_pin_bodies(current_image)
    shaft_mask = create_shaft_mask(image_no_bodies, pins_data)
    image_isolated = apply_shaft_mask(image_no_bodies, shaft_mask)
    seg_mask, contours = segment_shafts(image_isolated)
    shafts = analyze_shafts(contours)
    shafts = apply_secondary_parameter(shafts)
    
    # 5. Desenho dos Resultados (na imagem PROCESSADA/CENTRALIZADA)
    # Criamos uma cópia para desenhar as anotações antes de reverter
    visual_processed = current_image.copy()
    
    for shaft in shafts:
        cnt = shaft['contour']
        if shaft.get('rejected_secondary', False):
            color = (128, 0, 128)  # Roxo
        elif shaft['approved']:
            color = (0, 255, 0)    # Verde
        else:
            color = (0, 0, 255)    # Vermelho
        
        cv2.drawContours(visual_processed, [cnt], -1, color, 2)
        
        p1, p2 = shaft['extremities']
        if p1 is not None and p2 is not None:
            cv2.line(visual_processed, p1, p2, (255, 0, 0), 1)

    # 6. Reversão Espacial (Revert to Original)
    # Aplica a inversa da matriz M_total para colar o resultado anotado sobre a imagem original
    if apply_border_centralization:
        result_final = revert_transformation(
            processed_image=visual_processed,
            original_background=original_input,
            M_total=M_total,
            mask_original=mask_original_roi
        )
    else:
        # Se não houve centralização, a imagem processada já está no espaço original
        result_final = visual_processed

    # 7. Preparar dados de retorno (JSON friendly)
    total = len(shafts)
    approved = sum(1 for s in shafts if s['approved'])
    rejected = total - approved
    
    shafts_clean = []
    for s in shafts:
        shafts_clean.append({
            'area': s['area'],
            'length': s['length'],
            'width': s['width'],
            'straightness': s['straightness'],
            'inclination_rad': s['inclination_rad'],
            'approved': s['approved'],
            'rejected_secondary': s.get('rejected_secondary', False)
        })
    
    classification_data = {
        'total_shafts': total,
        'approved_shafts': approved,
        'rejected_shafts': rejected,
        'shafts': shafts_clean
    }
    
    return result_final, classification_data