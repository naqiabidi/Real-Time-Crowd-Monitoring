import cv2
import face_recognition
from config import camera, known_faces_encoding, known_faces_name

def generate_face_frame():
    frame_skip = 3  # Process every 3rd frame to reduce load
    frame_counter = 0
    while True:
        success, frame = camera.read()
        if not success:
            break

        frame_counter += 1
        if frame_counter % frame_skip != 0:
            continue  # Skip this frame

        face_locations = face_recognition.face_locations(frame)
        face_encodings = face_recognition.face_encodings(frame, face_locations)

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            matches = face_recognition.compare_faces(known_faces_encoding, face_encoding)
            name = "Unknown"

            if True in matches:
                first_match_index = matches.index(True)
                name = known_faces_name[first_match_index]

            cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
            cv2.putText(frame, name, (left, top-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

        # Encode the frame to JPEG and yield as multipart stream
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
