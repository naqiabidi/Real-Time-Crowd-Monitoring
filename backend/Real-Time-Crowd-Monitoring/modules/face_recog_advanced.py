import cv2
import face_recognition
import copy
import numpy as np
import config


def generate_face_frame():
    """Yield multipart JPEG frames for face detection stream using advanced face distance matching.
    Uses HOG model for better Windows compatibility and face_distance for more accurate matching."""
    frame_skip = 2  # Process every 3rd frame to reduce load
    frame_counter = 0
    consecutive_failures = 0
    max_failures = 10

    while True:
        success, frame = config.camera.read()
        if not success:
            consecutive_failures += 1
            if consecutive_failures > max_failures:
                # Create a black frame with error message
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Camera Error", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                continue  # Try reading again
        else:
            consecutive_failures = 0  # Reset on success

        frame_counter += 1
        if frame_counter % frame_skip != 0:
            continue  # Skip this frame

        # Convert BGR to RGB (face_recognition expects RGB)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Detect faces using HOG model (more stable on Windows, faster than CNN)
        face_locations = face_recognition.face_locations(rgb_frame, model="hog")
        
        # Encode detected faces (num_jitters=0 for faster processing)
        face_encodings = face_recognition.face_encodings(
            rgb_frame,
            known_face_locations=face_locations,
            num_jitters=0
        )

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            name = "Unknown"
            confidence = 0.0

            if config.known_faces_encoding:
                # Use face_distance for more accurate matching
                distances = face_recognition.face_distance(
                    config.known_faces_encoding, face_encoding
                )
                best_match_index = np.argmin(distances)
                min_distance = distances[best_match_index]

                # Convert distance to confidence percentage (lower distance = higher confidence)
                # Distance threshold: 0.5 is a good threshold (lower = stricter)
                if min_distance < 0.5:
                    name = config.known_faces_name[best_match_index]
                    # Convert distance to confidence: 0.0 distance = 100%, 0.5 distance = 0%
                    confidence = max(0, int((1 - (min_distance / 0.5)) * 100))

                    # Capture screenshot only once per session
                    if not config.match_detected:
                        config.match_detected = True
                        # Keep a copy of the frame to avoid mutation
                        matched_frame = copy.deepcopy(frame)
                        # Draw the bounding box on the captured frame
                        cv2.rectangle(matched_frame, (left, top), (right, bottom), (0, 255, 0), 2)
                        cv2.putText(
                            matched_frame,
                            f"Match: {name} ({confidence}%)",
                            (left, top - 10),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.9,
                            (0, 255, 0),
                            2,
                        )
                        ret_cap, buffer_cap = cv2.imencode(".jpg", matched_frame)
                        if ret_cap:
                            config.latest_match_image = buffer_cap.tobytes()
                            config.latest_match_name = name
                            config.latest_match_confidence = confidence

            # Draw rectangle and label on live frame
            color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            label = name if name == "Unknown" else f"{name} ({confidence}%)"
            cv2.putText(frame, label, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

        # Encode the frame to JPEG and yield as multipart stream
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

