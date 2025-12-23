import csv
import json
import os
from datetime import datetime

CANDIDATES_FILE = 'data/candidates.json'
ATTENDANCE_FILE = 'attendance.csv'

def init_db():
    if not os.path.exists('data'):
        os.makedirs('data')
    if not os.path.exists('data/faces'):
        os.makedirs('data/faces')
    
    if not os.path.exists(CANDIDATES_FILE):
        with open(CANDIDATES_FILE, 'w') as f:
            json.dump({}, f)
            
    if not os.path.exists(ATTENDANCE_FILE):
        with open(ATTENDANCE_FILE, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Name', 'Roll No', 'Department', 'Classroom', 'Timestamp'])

def save_candidate(data):
    # data: name, roll_no, department, classroom, dob, mail_id
    with open(CANDIDATES_FILE, 'r') as f:
        candidates = json.load(f)
    
    candidates[data['roll_no']] = data
    
    with open(CANDIDATES_FILE, 'w') as f:
        json.dump(candidates, f, indent=4)

def get_candidates():
    with open(CANDIDATES_FILE, 'r') as f:
        return json.load(f)

def log_attendance(roll_no):
    candidates = get_candidates()
    if roll_no not in candidates:
        return "UNKNOWN"
    
    candidate = candidates[roll_no]
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    date_full_str = now.strftime("%Y-%m-%d %H:%M:%S")
    
    # Check if already logged today
    if os.path.exists(ATTENDANCE_FILE):
        with open(ATTENDANCE_FILE, 'r') as f:
            reader = csv.reader(f)
            # Skip header
            next(reader, None)
            for row in reader:
                if len(row) >= 5:
                    # row[1] is Roll No, row[4] is Timestamp (YYYY-MM-DD HH:MM:S)
                    entry_roll = row[1]
                    entry_date = row[4].split(' ')[0]
                    if entry_roll == roll_no and entry_date == today_str:
                        return "ALREADY_LOGGED"

    with open(ATTENDANCE_FILE, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            candidate['name'],
            candidate['roll_no'],
            candidate['department'],
            candidate['classroom'],
            date_full_str
        ])
    return "NEW_LOG"
