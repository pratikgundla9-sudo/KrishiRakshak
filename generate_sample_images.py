import cv2
import numpy as np
import base64

def generate_leaf_image(scenario="yellow_leaves", width=640, height=480):
    # Dark agricultural soil background
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (20, 32, 22) # Soil / furrow base (BGR)
    
    # Soil texture noise
    noise = np.random.randint(-12, 12, (height, width, 3), dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Crop row furrow guidelines
    cv2.line(img, (int(width * 0.15), 0), (int(width * 0.05), height), (35, 48, 32), 3)
    cv2.line(img, (int(width * 0.85), 0), (int(width * 0.95), height), (35, 48, 32), 3)

    center = (int(width * 0.5), int(height * 0.5))

    # Leaf blade contour (tilted ellipse / almond)
    leaf_color = (36, 145, 58) # Healthy leaf green
    if scenario == "yellow_leaves":
        leaf_color = (45, 175, 185) # Chlorotic yellow-green (BGR: B=45, G=175, R=185 -> yellowish)
    elif scenario == "nitrogen_deficiency":
        leaf_color = (65, 180, 195) # Pale chlorotic yellow

    # Draw primary leaf blade
    cv2.ellipse(img, center, (int(width * 0.32), int(height * 0.22)), -25, 0, 360, leaf_color, -1)
    # Secondary overlapping leaf
    cv2.ellipse(img, (int(width * 0.42), int(height * 0.62)), (int(width * 0.26), int(height * 0.16)), 30, 0, 360, (32, 130, 52), -1)

    # Draw central and lateral veins
    cv2.line(img, (int(width * 0.22), int(height * 0.62)), (int(width * 0.76), int(height * 0.36)), (80, 200, 100), 3)
    for offset in range(-60, 70, 25):
        vx1 = int(width * 0.48 + offset * 1.8)
        vy1 = int(height * 0.50 - offset * 0.8)
        vx2 = vx1 + 35
        vy2 = vy1 - 35
        cv2.line(img, (vx1, vy1), (vx2, vy2), (80, 200, 100), 2)
        cv2.line(img, (vx1, vy1), (vx1 - 30, vy1 + 30), (80, 200, 100), 2)

    # Anomaly-specific visual characteristics
    if scenario == "yellow_leaves":
        # Chlorosis patches along leaf margins
        for pt in [(int(width*0.35), int(height*0.42)), (int(width*0.62), int(height*0.38)), (int(width*0.55), int(height*0.58))]:
            cv2.circle(img, pt, 34, (30, 200, 220), -1)
            cv2.circle(img, pt, 48, (40, 185, 210), 4)

    elif scenario == "nitrogen_deficiency":
        # Interveinal chlorosis (pale yellow between veins)
        for pt in [(int(width*0.40), int(height*0.46)), (int(width*0.58), int(height*0.44)), (int(width*0.48), int(height*0.56))]:
            cv2.ellipse(img, pt, (40, 22), -20, 0, 360, (50, 215, 235), -1)

    elif scenario == "disease_spots":
        # Necrotic blight lesions with halo rings
        for pt, r in [((int(width*0.44), int(height*0.42)), 18), 
                      ((int(width*0.56), int(height*0.48)), 24),
                      ((int(width*0.38), int(height*0.54)), 15),
                      ((int(width*0.64), int(height*0.38)), 14)]:
            cv2.circle(img, pt, r + 6, (20, 160, 180), 3) # Chlorotic yellow halo
            cv2.circle(img, pt, r, (15, 30, 85), -1)       # Dark necrotic center (dark brown/reddish)
            cv2.circle(img, pt, int(r * 0.5), (10, 15, 45), -1) # Fungal sporulation center

    elif scenario == "pest_holes":
        # Irregular chewed holes showing soil underneath
        for pt, r in [((int(width*0.46), int(height*0.46)), 22),
                      ((int(width*0.58), int(height*0.42)), 16),
                      ((int(width*0.36), int(height*0.52)), 18)]:
            cv2.circle(img, pt, r + 4, (15, 70, 30), 2)  # Serrated necrotic chewing border
            cv2.circle(img, pt, r, (20, 32, 22), -1)     # Ground / soil showing through hole

    # Overlay subtle grid & targeting reticle
    cv2.rectangle(img, (int(width*0.25), int(height*0.25)), (int(width*0.75), int(height*0.75)), (52, 211, 153), 1)
    cv2.putText(img, f"KrishiRakshak Node B [{scenario.upper()}]", (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (52, 211, 153), 2)

    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 78])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

if __name__ == "__main__":
    for s in ["yellow_leaves", "nitrogen_deficiency", "disease_spots", "pest_holes"]:
        data_url = generate_leaf_image(s)
        print(f"Generated {s} -> {len(data_url)} chars, prefix: {data_url[:40]}")
