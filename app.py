import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))  # Ensure the main dir is included
sys.path.append(os.path.join(os.path.dirname(__file__), "modules"))  # Add 'modules' dir to path

from flask import Flask, render_template, Response, jsonify
from modules.crowd_detection import generate_crowd_frame, get_crowd_count, reset_crowd_count, get_weapon_status                      
from modules.face_recog import generate_face_frame
from modules.config import weapon_detected, face_detection_enabled

app = Flask(__name__)

# Flag to track whether the stream is running 
video_stream_started = False

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
    global face_detection_enabled
    if face_detection_enabled:
        return Response(generate_face_frame(), mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return "Face detection is not enabled."


@app.route('/toggle_face_detection')
def toggle_face_detection():
    global face_detection_enabled
    face_detection_enabled = not face_detection_enabled  # Toggle state
    return jsonify(status="Face detection started" if face_detection_enabled else "Face detection stopped")

if __name__ == "__main__":
    app.run(debug=True)
