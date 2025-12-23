# Face-Attendance-System

A modern, high-performance Face Attendance System with real-time biometric identification and eye detection. Built with Flask, OpenCV, and SocketIO for a seamless, interactive experience.

## 🚀 Features

- **Real-time Face Recognition**: Instant identification using optimized facial embeddings.
- **Biometric Integrity**: Advanced check to prevent duplicate registrations (Biometric Conflict Check).
- **Eye Detection**: Ensures that a live person is present before logging attendance.
- **Dynamic Frontend**: Modern UI with glassmorphism effects and real-time feedback via SocketIO.
- **Attendance Logging**: Automatic CSV-based logging with duplicate entry prevention for daily sessions.
- **PDF Reports**: Generate and download professional attendance reports with customized branding.

## 🛠️ Tech Stack

- **Backend**: Python, Flask, Flask-SocketIO
- **Computer Vision**: OpenCV, Face Recognition
- **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript
- **Reporting**: FPDF

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/veera-crt/Face-Attendance-System.git
   cd Face-Attendance-System
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install OpenCV Contrib** (if not already installed):
   ```bash
   pip install opencv-contrib-python
   ```

## 🏃 Usage

1. **Run the application**:
   ```bash
   python app.py
   ```
2. **Access the web interface**:
   Open `http://localhost:5001` in your browser.

3. **Register**: Use the registration panel to enroll new candidates with their photo.
4. **Attendance**: Place your face in front of the camera. The system will detect your eyes and identify you, logging your attendance automatically.
5. **Report**: Click on "Export PDF" to download the session's attendance report.

## 📁 Project Structure

```text
├── app.py              # Main Flask application & SocketIO handlers
├── recognition.py      # Face recognition & Eye detection logic
├── database.py         # JSON & CSV persistence management
├── data/               # Face images and candidate metadata
├── static/             # CSS and JS assets
├── templates/          # HTML templates
└── requirements.txt    # Project dependencies
```

## 🛡️ Security Features

- **Biometric Conflict Prevention**: Prevents the same face from being registered under different IDs.
- **Live Detection**: Basic eye detection to mitigate static image spoofing.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
