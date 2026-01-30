import cv2
import torch
import numpy as np
from tracker import Tracker
from config import camera, model, tracker, area, crowd_count, weapon_detected
import time

crowd_count = 0
# Add this reset function to reset the crowd count
def reset_crowd_count():
    global crowd_count
    crowd_count = 0

def get_weapon_status():
    global weapon_detected
    return weapon_detected

# Function to get the latest crowd count
def get_crowd_count():
    global crowd_count
    return crowd_count
# Define a function to handle crowd frame generation with frame skipping and optimization
def generate_crowd_frame():
    global crowd_count,weapon_detected
    frame_skip = 3  # Process every 3rd frame to reduce load
    frame_counter = 0

    while True:
        success, frame = camera.read()
        if not success:
            break

        # Skip frames to reduce processing load
        frame_counter += 1
        if frame_counter % frame_skip != 0:
            continue  # Skip this frame

        # Resize the frame (optional: reduce resolution further if needed)
        frame = cv2.resize(frame, (640, 320))
        cv2.polylines(frame, [np.array(area, np.int32)], True, (0, 255, 0), 3)

        results = model(frame)
        list = []
        weapon_detected = False
        weapon_detect = False

        for index, row in results.pandas().xyxy[0].iterrows():
            x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
            obj_name = str(row['name'])
            if obj_name == 'person':
                list.append([x1, y1, x2, y2])
            elif obj_name == 'gun':
                weapon_detect = True
                cv2.putText(frame, "Weapon Detected", (785, 39), cv2.FONT_HERSHEY_COMPLEX_SMALL, 1, (0, 0, 200), 2)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
        weapon_detected= weapon_detect
        boxes_id = tracker.update(list)
        crowd_count = len(boxes_id)

        # Encode frame to JPEG and yield as multipart stream
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
