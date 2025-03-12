import torch
import cv2
import numpy as np
import face_recognition
import os
from tracker import Tracker

# Load YOLOv5 model
model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)

# Paths
TEST_VIDEO_PATH = "test_videos/video_3.mp4"  # Update with your video name if different

# Initialize Camera
camera = cv2.VideoCapture(TEST_VIDEO_PATH)

tracker = Tracker()
area = [(0, 0), (0, 499), (1019, 499), (1019, 0)]
crowd_count = 0
weapon_detected = False

# Get the base directory (Project Root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Path to the photos folder
PHOTOS_DIR = os.path.join(BASE_DIR, "photos")

# Path to specific image
person1_IMAGE_PATH = os.path.join(PHOTOS_DIR, "your_image_file_name")

# Face recognition setup
known_faces_encoding = []
known_faces_name = []

# Example: Load known person image
known_person1_image = face_recognition.load_image_file(person1_IMAGE_PATH)
known_person1_encoding = face_recognition.face_encodings(known_person1_image)[0]
known_faces_encoding.append(known_person1_encoding)
known_faces_name.append("person1")

face_detection_enabled = False
