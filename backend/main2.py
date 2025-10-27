import cv2
import numpy as np
import matplotlib.pyplot as plt

def detectar_caixas_e_pinos(path_imagem):
    """Detecção automática de divisórias e pinos amarelos em caixas irregulares."""

    image_bgr = cv2.imread(path_imagem)
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    # Detecta tons de cinza (bordas cinza)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)  
    _, mask_gray = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    mask_gray = cv2.morphologyEx(mask_gray, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    edges = cv2.Canny(mask_gray, 50, 150, apertureSize=3)

    # verifica linhas
    lines = cv2.HoughLinesP(
        edges, rho=1, theta=np.pi/180, threshold=120,
        minLineLength=100, maxLineGap=40
    )


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
                média = int(np.mean(atual))
                if not agrupadas or abs(média - agrupadas[-1]) > min_dist:
                    agrupadas.append(média)
                atual = [c]
        média = int(np.mean(atual))
        if not agrupadas or abs(média - agrupadas[-1]) > min_dist:
            agrupadas.append(média)
        return agrupadas


    verticais, horizontais = [], []
    if lines is not None:
        for l in lines:
            x1, y1, x2, y2 = l[0]
            if abs(x1 - x2) < abs(y1 - y2):  # vertical
                verticais.append(l)
            else:
                horizontais.append(l)

    x_positions = agrupar_linhas(verticais, 'x', tol=25, min_dist=50)
    y_positions = agrupar_linhas(horizontais, 'y', tol=25, min_dist=50)

    boxes = []
    for i in range(len(x_positions)-1):
        for j in range(len(y_positions)-1):
            x1, x2 = x_positions[i], x_positions[i+1]
            y1, y2 = y_positions[j], y_positions[j+1]
            boxes.append((x1, y1, x2-x1, y2-y1))

    lower_yellow = np.array([10, 150, 100])
    upper_yellow = np.array([35, 255, 255])
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    contours_yellow, _ = cv2.findContours(mask_yellow, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pin_boxes = [cv2.boundingRect(c) for c in contours_yellow if cv2.contourArea(c) > 800]

    image_result = image_rgb.copy()
    occupied, empty = 0, 0
    for (x, y, w, h) in boxes:
        inside = 0
        for (px, py, pw, ph) in pin_boxes:
            cx, cy = px + pw//2, py + ph//2
            if x < cx < x + w and y < cy < y + h:
                inside += 1
        color = (0, 255, 0) if inside > 0 else (0, 0, 255)
        cv2.rectangle(image_result, (x, y), (x+w, y+h), color, 2)
        cv2.putText(image_result, str(inside), (x + w//2 - 10, y + h//2),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        if inside > 0:
            occupied += 1
        else:
            empty += 1

    cv2.drawContours(image_result, contours_yellow, -1, (255, 0, 255), 3)
    cv2.putText(image_result, f'Tot Caixas: {len(boxes)}', (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.putText(image_result, f'Objs: {len(pin_boxes)}  Vazias: {empty}', (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 100, 255), 2)

    plt.figure(figsize=(12, 8))
    plt.imshow(image_result)
    plt.title("Detectar Caixas Cinzas + Pinos Amarelos")
    plt.axis("off")
    plt.show()

    return image_result, boxes, pin_boxes


if __name__ == "__main__":
    detectar_caixas_e_pinos('./imagens/erro_estrutural/pushpins_structural_anomalies_000.png')
