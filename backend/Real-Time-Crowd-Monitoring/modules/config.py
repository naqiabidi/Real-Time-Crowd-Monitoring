import torch
import cv2
import numpy as np
import os
import face_recognition
from tracker import Tracker

# Load YOLOv5 model
model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)

# Paths
TEST_VIDEO_PATH = "test_videos/video_3.mp4"  # Sample video file (used only if you switch to file input)

# Initialize Camera (use default webcam on Windows; 0 is the usual built‑in / primary camera)
# If you have multiple cameras, you can try 1, 2, ... here instead of 0.
camera = cv2.VideoCapture(0)

tracker = Tracker()
area = [(0, 0), (0, 499), (1019, 499), (1019, 0)]
crowd_count = 0
weapon_detected = False

# Face recognition setup (populated after user upload)
known_faces_encoding = []
known_faces_name = []

# Example: Load known person image
# known_person1_image = face_recognition.load_image_file(person1_IMAGE_PATH)
# known_person1_encoding = face_recognition.face_encodings(known_person1_image)[0]
# known_faces_encoding.append(known_person1_encoding)
# known_faces_name.append("person1")

face_detection_enabled = False

# Latest match state
latest_match_image = None  # JPEG bytes of the first match frame
latest_match_name = None
latest_match_confidence = 0.0
match_detected = False

# Face recognition method: 'basic' or 'advanced'
# 'basic' uses compare_faces with tolerance
# 'advanced' uses face_distance with HOG model (better for Windows)
face_recognition_method = 'advanced'  # Change to 'basic' to use the original method
