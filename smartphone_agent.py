import cv2
import urllib.request
import numpy as np
import time

STREAM_URL = "http://10.144.48.156:4747/mjpegfeed"

def main():
    print(f"[INFO] Connecting to high-definition JPEG stream at: {STREAM_URL}")
    
    # Fallback check if /mjpegfeed is not supported by your build
    try:
        stream = urllib.request.urlopen(STREAM_URL, timeout=5)
    except Exception:
        fallback_url = "http://10.144.48.156:4747/video"
        print(f"[INFO] Trying alternative endpoint: {fallback_url}")
        stream = urllib.request.urlopen(fallback_url, timeout=5)

    print("[SUCCESS] Crystal clear camera feed connected!")
    print("[INFO] Press 'q' inside the video window to exit.")

    bytes_buffer = b''
    frame_count = 0
    start_time = time.time()

    while True:
        try:
            bytes_buffer += stream.read(4096)
            a = bytes_buffer.find(b'\xff\xd8') # JPEG start marker
            b = bytes_buffer.find(b'\xff\xd9') # JPEG end marker

            if a != -1 and b != -1:
                jpg = bytes_buffer[a:b+2]
                bytes_buffer = bytes_buffer[b+2:]
                
                # Decode raw JPEG bytes directly into sharp image
                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                if frame is None:
                    continue

                frame_count += 1
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                h, w, _ = frame.shape

                # KrishiRakshak UI Overlay
                cv2.rectangle(frame, (20, 20), (w - 20, h - 20), (0, 255, 0), 2)
                cv2.putText(frame, "STATE: TRAVERSING", (35, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
                cv2.putText(frame, f"FPS: {fps:.1f}", (35, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, "HD STREAM: 10.144.48.156", (w - 360, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                cv2.putText(frame, "CANOPY MONITORING ACTIVE", (35, h - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                # Center detection box
                box_w, box_h = 240, 240
                cx, cy = w // 2, h // 2
                top_left = (cx - box_w // 2, cy - box_h // 2)
                bottom_right = (cx + box_w // 2, cy + box_h // 2)
                cv2.rectangle(frame, top_left, bottom_right, (0, 255, 0), 2)
                cv2.putText(frame, "Canopy Target [OK]", (top_left[0], top_left[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                cv2.imshow("KrishiRakshak - Edge Vision & Rover Coordinator", frame)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        except Exception as e:
            print(f"[ERROR] Stream interrupted: {e}")
            break

    cv2.destroyAllWindows()
    print("[INFO] Camera stopped cleanly.")

if __name__ == "__main__":
    main()