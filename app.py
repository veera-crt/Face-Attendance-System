from flask import Flask, render_template, request, jsonify, Response, send_file
from flask_socketio import SocketIO, emit
import cv2
import base64
import numpy as np
from recognition import RecognitionManager
from database import init_db, save_candidate, log_attendance, get_candidates, ATTENDANCE_FILE
import os
import csv
from fpdf import FPDF
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

init_db()
rec_manager = RecognitionManager()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.form.to_dict()
    image_data = request.files.get('image')
    
    if not image_data:
        return jsonify({"status": "error", "message": "Image is required"}), 400
    
    # Biometric Conflict Check (Duplicate Face Prevention)
    image_bytes = np.frombuffer(image_data.read(), np.uint8)
    image_data.seek(0) # Reset pointer
    frame = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
    
    if frame is not None:
        results = rec_manager.identify_face(frame)
        for res in results:
            if res['roll_no'] != "Unknown":
                return jsonify({
                    "status": "conflict", 
                    "message": f"BIOMETRIC_CONFLICT: This face is already registered under ID: {res['roll_no']}"
                }), 400

    # Save image
    image_path = os.path.join('data/faces', f"{data['roll_no']}.jpg")
    image_data.save(image_path)
    
    # Save metadata
    save_candidate(data)
    
    # Reload known faces
    rec_manager.load_known_faces()
    
    return jsonify({"status": "success", "message": "Candidate registered successfully"})

@app.route('/export_pdf')
def export_pdf():
    if not os.path.exists(ATTENDANCE_FILE):
        return "No attendance data found", 404
    
    pdf = FPDF()
    pdf.add_page()
    
    # Futuristic Header
    pdf.set_fill_color(10, 20, 30)
    pdf.rect(0, 0, 210, 40, 'F')
    pdf.set_text_color(0, 255, 149) # Neon Green
    pdf.set_font("Helvetica", "B", 24)
    pdf.cell(0, 20, "SECURE EYE BIOMETRICS", new_x="LMARGIN", new_y="NEXT", align='C')
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, f"ATTENDANCE REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M')}", new_x="LMARGIN", new_y="NEXT", align='C')
    pdf.ln(20)
    
    # Table Header
    pdf.set_fill_color(0, 242, 255) # Cyber Blue
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 10)
    
    col_widths = [50, 40, 30, 25, 45]
    headers = ["Name", "Roll No", "Dept", "Class", "Timestamp"]
    
    for i in range(len(headers)):
        pdf.cell(col_widths[i], 10, headers[i], border=1, fill=True, align='C')
    pdf.ln()
    
    # Table Data
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 9)
    
    with open(ATTENDANCE_FILE, 'r') as f:
        reader = csv.reader(f)
        next(reader) # skip header
        for row in reader:
            if len(row) == 5:
                for i in range(len(row)):
                    pdf.cell(col_widths[i], 8, str(row[i]), border=1, align='C')
                pdf.ln()
    
    output_path = "attendance_report.pdf"
    pdf.output(output_path)
    return send_file(output_path, as_attachment=True)

@socketio.on('process_frame')
def handle_frame(data):
    # Data is a base64 encoded image string
    try:
        header, encoded = data.split(",", 1)
        data = base64.b64decode(encoded)
        nparr = np.frombuffer(data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = rec_manager.identify_face(frame)
        
        # Determine overall eye detection status from results
        eye_detected = any(res.get('has_eyes', False) for res in results)

        processed_data = {
            "results": results,
            "eye_detected": eye_detected
        }

        # Check if any face is identified and log attendance
        for res in results:
            if res['roll_no'] != "Unknown":
                log_status = log_attendance(res['roll_no'])
                candidate = get_candidates().get(res['roll_no'])
                processed_data['identified_user'] = candidate
                processed_data['log_status'] = log_status

        emit('response_frame', processed_data)
    except Exception as e:
        print(f"Error processing frame: {e}")

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5001)
