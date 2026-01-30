import face_recognition
import cv2
import numpy as np
import os

# -------------------------------
# Load Known Faces
# -------------------------------
KNOWN_FACES_DIR = "known_faces"

known_face_encodings = []
known_face_names = []

for filename in os.listdir(KNOWN_FACES_DIR):
    if filename.lower().endswith((".jpg", ".png", ".jpeg")):
        image_path = os.path.join(KNOWN_FACES_DIR, filename)
        image = face_recognition.load_image_file(image_path)

        encodings = face_recognition.face_encodings(
            image, num_jitters=0
        )

        if len(encodings) > 0:
            known_face_encodings.append(encodings[0])
            known_face_names.append(os.path.splitext(filename)[0])

print("[INFO] Known faces loaded:", known_face_names)

# -------------------------------
# Start Webcam
# -------------------------------
video_capture = cv2.VideoCapture(0)

if not video_capture.isOpened():
    print("❌ Webcam not accessible")
    exit()

print("[INFO] Webcam started. Press 'q' to quit.")

# -------------------------------
# Real-time Recognition
# -------------------------------
while True:
    ret, frame = video_capture.read()
    if not ret:
        break

    # Convert BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Detect faces (HOG = stable on Windows)
    face_locations = face_recognition.face_locations(
        rgb_frame, model="hog"
    )

    # Encode detected faces
    face_encodings = face_recognition.face_encodings(
        rgb_frame,
        known_face_locations=face_locations,
        num_jitters=0
    )

    for (top, right, bottom, left), face_encoding in zip(
        face_locations, face_encodings
    ):
        name = "Unknown"

        if known_face_encodings:
            distances = face_recognition.face_distance(
                known_face_encodings, face_encoding
            )
            best_match_index = np.argmin(distances)

            if distances[best_match_index] < 0.5:
                name = known_face_names[best_match_index]

        # Draw rectangle
        cv2.rectangle(
            frame,
            (left, top),
            (right, bottom),
            (0, 255, 0),
            2
        )

        # Draw label
        cv2.putText(
            frame,
            name,
            (left, top - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

    cv2.imshow("Face Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# -------------------------------
# Cleanup
# -------------------------------
video_capture.release()
cv2.destroyAllWindows()
