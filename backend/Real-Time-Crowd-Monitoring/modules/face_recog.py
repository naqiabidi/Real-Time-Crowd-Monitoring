import cv2
import face_recognition
import copy
import numpy as np
import config


def generate_face_frame():
    """Yield multipart JPEG frames for face detection stream and capture a one-time screenshot on match."""
    frame_skip =  2 # Process every 3rd frame to reduce load
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

        # Convert BGR (OpenCV) to RGB (face_recognition expects RGB)
        rgb_frame = frame[:, :, ::-1]

        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Compare with uploaded face encodings (if any), using a reasonable tolerance
            matches = face_recognition.compare_faces(config.known_faces_encoding, face_encoding, tolerance=0.6)
            name = "Unknown"

            if True in matches:
                first_match_index = matches.index(True)
                name = config.known_faces_name[first_match_index]

                # Capture screenshot only once per session
                if not config.match_detected:
                    config.match_detected = True
                    # Keep a copy of the frame to avoid mutation in subsequent iterations
                    matched_frame = copy.deepcopy(frame)
                    # Draw the bounding box on the captured frame
                    cv2.rectangle(matched_frame, (left, top), (right, bottom), (0, 255, 0), 2)
                    cv2.putText(
                        matched_frame,
                        f"Match: {name}",
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

            cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
            cv2.putText(frame, name, (left, top-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

        # Encode the frame to JPEG and yield as multipart stream
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
