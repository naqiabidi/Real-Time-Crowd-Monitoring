import sys
import os
import io
import face_recognition

sys.path.append(os.path.abspath(os.path.dirname(__file__)))  # Ensure the main dir is included
sys.path.append(os.path.join(os.path.dirname(__file__), "modules"))  # Add 'modules' dir to path

from flask import Flask, render_template, Response, jsonify, request, send_file
from flask_cors import CORS
from modules.crowd_detection import generate_crowd_frame, get_crowd_count, reset_crowd_count, get_weapon_status                      
from modules.face_recog import generate_face_frame
from modules.face_recog_advanced import generate_face_frame as generate_face_frame_advanced
from modules import config

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Flag to track whether the stream is running 
video_stream_started = False


def load_known_faces_from_folder():
    """Load all known faces from the known_faces folder."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    known_faces_dir = os.path.join(base_dir, "modules", "Facial recognition", "known_faces")
    
    config.known_faces_encoding = []
    config.known_faces_name = []
    
    if not os.path.exists(known_faces_dir):
        os.makedirs(known_faces_dir, exist_ok=True)
        return
    
    for filename in os.listdir(known_faces_dir):
        if filename.lower().endswith((".jpg", ".png", ".jpeg")):
            image_path = os.path.join(known_faces_dir, filename)
            try:
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image, num_jitters=0)
                
                if len(encodings) > 0:
                    config.known_faces_encoding.append(encodings[0])
                    config.known_faces_name.append(os.path.splitext(filename)[0])
            except Exception as e:
                print(f"Error loading face from {filename}: {e}")
                continue
    
    print(f"[INFO] Loaded {len(config.known_faces_name)} known faces: {config.known_faces_name}")


# Load faces on startup
load_known_faces_from_folder()

@app.route('/')
def index():
    return render_template("index.html")  # Render the main template

@app.route('/video')
def video():
    return Response(generate_crowd_frame(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_crowd_count')
def start_crowd_count():
    # Reset crowd count and restart video feed
    reset_crowd_count()  # Reset crowd count
    return jsonify(status="Crowd Count Stream Restarted")

@app.route('/crowd_count')
def get_crowd_count_route():
    crowd_count = get_crowd_count()  # Get the current crowd count
    return jsonify(count=crowd_count)

@app.route('/weapon_status')
def get_weapon_status_route():
    weapon_detected = get_weapon_status()
    return jsonify(weapon_detected=weapon_detected)

@app.route('/face_video')
def face_video():
    if config.face_detection_enabled:
        # Use advanced method if configured, otherwise use basic
        if config.face_recognition_method == 'advanced':
            return Response(generate_face_frame_advanced(), mimetype='multipart/x-mixed-replace; boundary=frame')
        else:
            return Response(generate_face_frame(), mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return jsonify(error="Face detection is not enabled"), 400


@app.route('/toggle_face_detection')
def toggle_face_detection():
    config.face_detection_enabled = not config.face_detection_enabled  # Toggle state
    
    # Reload known faces when starting detection to ensure latest faces are loaded
    if config.face_detection_enabled:
        load_known_faces_from_folder()
    
    return jsonify(
        status="Face detection started" if config.face_detection_enabled else "Face detection stopped",
        known_faces_count=len(config.known_faces_encoding)
    )


@app.route('/upload_face', methods=['POST'])
def upload_face():
    """Accept an uploaded face image, save it to known_faces folder, and reload all known faces."""
    if 'image' not in request.files:
        return jsonify(error="No image file provided"), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify(error="Empty filename"), 400

    try:
        # Define the known_faces directory path
        base_dir = os.path.dirname(os.path.abspath(__file__))
        known_faces_dir = os.path.join(base_dir, "modules", "Facial recognition", "known_faces")
        
        # Create directory if it doesn't exist
        os.makedirs(known_faces_dir, exist_ok=True)
        
        # Generate a safe filename (remove special characters, keep extension)
        original_filename = file.filename
        name_without_ext = os.path.splitext(original_filename)[0]
        # Clean filename: remove special characters, keep only alphanumeric and spaces
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in name_without_ext)
        safe_name = safe_name.strip() or "uploaded_person"
        
        # Get file extension
        file_ext = os.path.splitext(original_filename)[1] or '.jpg'
        if file_ext.lower() not in ['.jpg', '.jpeg', '.png']:
            file_ext = '.jpg'
        
        # Create full file path
        saved_filename = f"{safe_name}{file_ext}"
        file_path = os.path.join(known_faces_dir, saved_filename)
        
        # Handle duplicate filenames by adding a number
        counter = 1
        while os.path.exists(file_path):
            saved_filename = f"{safe_name}_{counter}{file_ext}"
            file_path = os.path.join(known_faces_dir, saved_filename)
            counter += 1
        
        # Save the file
        file.seek(0)  # Reset file pointer
        file.save(file_path)
        
        # Verify face can be detected in saved image
        upload_image = face_recognition.load_image_file(file_path)
        encodings = face_recognition.face_encodings(upload_image, num_jitters=0)
        if len(encodings) == 0:
            # Remove the file if no face detected
            os.remove(file_path)
            return jsonify(error="No face detected in the uploaded image"), 400

        # Reload all known faces from the folder
        load_known_faces_from_folder()
        
        # Reset match state
        config.latest_match_image = None
        config.latest_match_name = safe_name
        config.match_detected = False

        return jsonify(
            status="Face uploaded and saved", 
            name=safe_name,
            filename=saved_filename,
            total_faces=len(config.known_faces_encoding)
        )
    except Exception as exc:
        return jsonify(error=f"Failed to process image: {exc}"), 500


@app.route('/face_match_status')
def face_match_status():
    """Return whether a match has been detected and if a screenshot is ready."""
    return jsonify(
        match_found=config.match_detected,
        screenshot_available=config.latest_match_image is not None,
        name=config.latest_match_name,
        confidence=getattr(config, 'latest_match_confidence', None),
        method=config.face_recognition_method,
    )


@app.route('/set_face_recognition_method', methods=['POST'])
def set_face_recognition_method():
    """Switch between 'basic' and 'advanced' face recognition methods."""
    data = request.get_json()
    method = data.get('method', 'advanced')
    
    if method not in ['basic', 'advanced']:
        return jsonify(error="Method must be 'basic' or 'advanced'"), 400
    
    config.face_recognition_method = method
    return jsonify(status=f"Face recognition method set to {method}", method=method)


@app.route('/face_screenshot')
def face_screenshot():
    """Return the captured screenshot of the matched face."""
    if config.latest_match_image is None:
        return jsonify(error="No screenshot available"), 404
    return send_file(
        io.BytesIO(config.latest_match_image),
        mimetype='image/jpeg',
        as_attachment=True,
        download_name=f"{config.latest_match_name or 'match'}_screenshot.jpg",
    )

if __name__ == "__main__":
    app.run(debug=True)
