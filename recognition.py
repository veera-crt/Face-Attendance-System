import cv2
import numpy as np
import os

class RecognitionManager:
    def __init__(self):
        self.face_dir = 'data/faces'
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        
        cascade_path = cv2.data.haarcascades
        # Using the most permissive frontal face cascade
        self.face_cascade = cv2.CascadeClassifier(os.path.join(cascade_path, 'haarcascade_frontalface_default.xml'))
        self.eye_cascade = cv2.CascadeClassifier(os.path.join(cascade_path, 'haarcascade_eye.xml'))
        
        self.label_map = {}
        self.load_known_faces()

    def load_known_faces(self):
        if not os.path.exists(self.face_dir):
            os.makedirs(self.face_dir)
            return

        faces = []
        labels = []
        label_id = 0

        for filename in os.listdir(self.face_dir):
            if filename.endswith(".jpg") or filename.endswith(".png"):
                roll_no = filename.split('.')[0]
                image_path = os.path.join(self.face_dir, filename)
                
                img = cv2.imread(image_path)
                if img is None: continue
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # Training: Permissive detection to ensure we have profiles
                detected_faces = self.face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(60, 60))
                for (x, y, w, h) in detected_faces:
                    face_roi = gray[y:y+h, x:x+w]
                    faces.append(cv2.resize(face_roi, (200, 200)))
                    labels.append(label_id)
                    self.label_map[label_id] = roll_no
                    label_id += 1
                    break 

        if faces:
            self.recognizer.train(faces, np.array(labels))
            print(f"RECOGNITION_READY: {len(faces)} profiles.")

    def identify_face(self, frame):
        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Very permissive detection for low-light/diverse angles
        detected_faces = self.face_cascade.detectMultiScale(gray_frame, 1.3, 4, minSize=(50, 50))
        
        output = []
        for (x, y, w, h) in detected_faces:
            face_roi = gray_frame[y:y+h, x:x+w]
            
            # Eye detection inside face ROI
            eyes_in_face = self.eye_cascade.detectMultiScale(face_roi, 1.1, 5)
            
            has_eyes = len(eyes_in_face) >= 1
            suggestion = "FACE_LOCATED"
            
            if not has_eyes:
                suggestion = "STABILIZING_RETREIVAL..."

            roll_no = "Unknown"
            eye_coords = []
            for (ex, ey, ew, eh) in eyes_in_face:
                eye_coords.append({
                    "x": int(x + ex),
                    "y": int(y + ey),
                    "w": int(ew),
                    "h": int(eh)
                })

            if face_roi.size > 0 and len(self.label_map) > 0:
                face_roi = cv2.resize(face_roi, (200, 200))
                label, confidence = self.recognizer.predict(face_roi)
                
                # LBPH confidence threshold (lower is better)
                if confidence < 80: 
                    roll_no = self.label_map.get(label, "Unknown")

            output.append({
                "roll_no": roll_no,
                "location": [int(y), int(x+w), int(y+h), int(x)],
                "eyes": eye_coords,
                "has_eyes": has_eyes,
                "suggestion": suggestion
            })
        return output
