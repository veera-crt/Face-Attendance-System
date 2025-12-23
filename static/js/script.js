const socket = io();

// UI Elements - Main Dashboard
const webcam = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const idProfile = document.getElementById('id-card');
const noResult = document.getElementById('no-result');
const attendanceList = document.getElementById('attendance-list');
const hudX = document.getElementById('hud-x');
const hudY = document.getElementById('hud-y');
const hudEye = document.getElementById('hud-eye');

// Registration Step Elements
const regModal = document.getElementById('reg-modal');
const regStep1 = document.getElementById('reg-step-1');
const regStep2 = document.getElementById('reg-step-2');
const regVideo = document.getElementById('reg-video');
const regOverlay = document.getElementById('reg-overlay');
const regCtx = regOverlay.getContext('2d');
const scanBar = document.getElementById('scan-bar');
const nextToScanBtn = document.getElementById('next-to-scan');
const backToDetailsBtn = document.getElementById('back-to-details');
const regForm = document.getElementById('reg-form');
const scanStatusText = document.querySelector('.scan-status-text');

let isProcessing = false;
let isRegistering = false;
let registrationState = 0; // 0: Idle, 1: Details, 2: Scanning
let stabilityCounter = 0;

// Initialize Main Webcam
async function startMainCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        webcam.srcObject = stream;
        webcam.onloadedmetadata = () => {
            canvas.width = webcam.videoWidth;
            canvas.height = webcam.videoHeight;
            isProcessing = true;
            processLoop();
        };
    } catch (err) {
        console.error("Camera access denied:", err);
    }
}

function processLoop() {
    if (!isProcessing || isRegistering) {
        setTimeout(processLoop, 500);
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 640;
    tempCanvas.height = 480;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(webcam, 0, 0, 640, 480);

    socket.emit('process_frame', tempCanvas.toDataURL('image/jpeg', 0.6));
    setTimeout(processLoop, 150); // Faster processing
}

socket.on('response_frame', (data) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale factor: Canvas is usually 1280x720, backend processes 640x480
    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    if (data.results.length > 0) {
        data.results.forEach(res => {
            // Apply Scaling to coordinates
            const scaledRes = {
                ...res,
                location: [
                    res.location[0] * scaleY, // top
                    res.location[1] * scaleX, // right
                    res.location[2] * scaleY, // bottom
                    res.location[3] * scaleX  // left
                ],
                eyes: res.eyes.map(e => ({
                    x: e.x * scaleX,
                    y: e.y * scaleY,
                    w: e.w * scaleX,
                    h: e.h * scaleY
                }))
            };

            drawVirtualEffects(scaledRes);

            if (scaledRes.roll_no !== "Unknown" && data.identified_user) {
                updateResultPanel(data.identified_user, data.log_status);
                if (data.log_status === "NEW_LOG") {
                    logSession(data.identified_user);
                }
            }
        });
    } else {
        hudEye.textContent = "WAITING";
    }
});

function drawVirtualEffects(res) {
    const [top, right, bottom, left] = res.location;
    const w = right - left;
    const h = bottom - top;
    const centerX = left + w / 2;
    const centerY = top + h / 2;

    // HUD Update
    hudX.textContent = centerX.toFixed(1);
    hudY.textContent = centerY.toFixed(1);
    hudEye.textContent = res.has_eyes ? "NEURAL_EYE_LOCK_ACTIVE" : "IDENTIFYING_RETINAL_PATTERN...";

    const color = res.has_eyes ? '#00ff95' : '#00f2ff';
    ctx.strokeStyle = color;

    // 1. NEURAL MESH (Spider-web effect to look like 'real' mapping)
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    // Connect face corners to center
    ctx.moveTo(left, top); ctx.lineTo(centerX, centerY);
    ctx.moveTo(right, top); ctx.lineTo(centerX, centerY);
    ctx.moveTo(left, bottom); ctx.lineTo(centerX, centerY);
    ctx.moveTo(right, bottom); ctx.lineTo(centerX, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. FEATURE POINTS (Small dots at key areas)
    ctx.fillStyle = color;
    [[left, top], [right, top], [left, bottom], [right, bottom], [centerX, top], [centerX, bottom], [left, centerY], [right, centerY]].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3. Futuristic Bounding Box Corners
    ctx.lineWidth = 3;
    const cornerSize = 40;
    // TL
    ctx.beginPath(); ctx.moveTo(left, top + cornerSize); ctx.lineTo(left, top); ctx.lineTo(left + cornerSize, top); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(right - cornerSize, top); ctx.lineTo(right, top); ctx.lineTo(right, top + cornerSize); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(left, bottom - cornerSize); ctx.lineTo(left, bottom); ctx.lineTo(left + cornerSize, bottom); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(right - cornerSize, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - cornerSize); ctx.stroke();

    // 4. Eye Scanners (Retinal Mapping)
    if (res.eyes && res.eyes.length > 0) {
        res.eyes.forEach(eye => {
            const eX = eye.x + eye.w / 2;
            const eY = eye.y + eye.h / 2;

            // Draw Virtual Reticle
            ctx.strokeStyle = '#ff00ea';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(eX, eY, eye.w / 1.1, 0, Math.PI * 2);
            ctx.stroke();

            // Inner crosshair
            ctx.beginPath();
            ctx.moveTo(eX - 10, eY); ctx.lineTo(eX + 10, eY);
            ctx.moveTo(eX, eY - 10); ctx.lineTo(eX, eY + 10);
            ctx.stroke();

            // Connecting line from face center to eye
            ctx.strokeStyle = 'rgba(255, 0, 234, 0.2)';
            ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(eX, eY); ctx.stroke();
        });
    }

    // 5. Identity Tag
    ctx.fillStyle = color;
    ctx.font = "bold 20px Orbitron";
    const tag = res.roll_no === "Unknown" ? "ANALYZING..." : `MATCH_ID: ${res.roll_no}`;
    ctx.fillText(tag, left, top - 15);
}

function updateResultPanel(user, status) {
    idProfile.classList.remove('hidden');
    noResult.classList.add('hidden');

    document.getElementById('user-name').textContent = user.name.toUpperCase();
    document.getElementById('user-id').textContent = `ID_${user.roll_no}`;
    document.getElementById('user-dept').textContent = user.department;
    document.getElementById('user-class').textContent = user.classroom;

    const stamp = document.querySelector('.auth-stamp');
    if (status === "ALREADY_LOGGED") {
        stamp.textContent = "ALREADY VERIFIED";
        stamp.style.color = "#ff00ea"; // Neon Pink for duplicate
    } else {
        stamp.textContent = "VERIFIED";
        stamp.style.color = "#00ff95"; // Neon Green for new
    }

    clearTimeout(idProfile.timer);
    idProfile.timer = setTimeout(() => {
        idProfile.classList.add('hidden');
        noResult.classList.remove('hidden');
    }, 4000);
}

const seenToday = new Set();
function logSession(user) {
    if (seenToday.has(user.roll_no)) return;
    seenToday.add(user.roll_no);

    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `
        <span class="time">[${new Date().toLocaleTimeString()}]</span>
        <span class="name"> ${user.name}</span>
        <span class="action"> AUTH_OK </span>
    `;
    attendanceList.prepend(item);
}

// --- REGISTRATION LOGIC ---
document.getElementById('register-btn').onclick = () => {
    regModal.classList.remove('hidden');
    isRegistering = true;
    showStep(1);
};

function showStep(s) {
    registrationState = s;
    regStep1.classList.add('hidden');
    regStep2.classList.add('hidden');

    if (s === 1) {
        regStep1.classList.remove('hidden');
    } else if (s === 2) {
        regStep2.classList.remove('hidden');
        startRegScan();
    }
}

nextToScanBtn.onclick = () => {
    if (regForm.checkValidity()) {
        showStep(2);
    } else {
        regForm.reportValidity();
    }
};

backToDetailsBtn.onclick = () => showStep(1);

async function startRegScan() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        regVideo.srcObject = stream;
        regVideo.onloadedmetadata = () => {
            regOverlay.width = regVideo.videoWidth;
            regOverlay.height = regVideo.videoHeight;
            stabilityCounter = 0;
            regScanLoop();
        };
    } catch (err) {
        alert("Camera required for biometric scan.");
        showStep(1);
    }
}

function regScanLoop() {
    if (registrationState !== 2) return;

    const tCanvas = document.createElement('canvas');
    tCanvas.width = 640;
    tCanvas.height = 480;
    const tCtx = tCanvas.getContext('2d');
    tCtx.drawImage(regVideo, 0, 0, 640, 480);

    socket.emit('process_frame', tCanvas.toDataURL('image/jpeg', 0.6));

    socket.once('response_frame', (data) => {
        analyzeStability(data);
        if (registrationState === 2) setTimeout(regScanLoop, 150);
    });
}

function analyzeStability(data) {
    regCtx.clearRect(0, 0, regOverlay.width, regOverlay.height);

    if (data.results.length > 0) {
        const res = data.results[0];
        const [top, right, bottom, left] = res.location;
        const centerX = left + (right - left) / 2;
        const imgCenter = regOverlay.width / 2;

        // Stricter placement requirements for the green parameter effect
        const isCentered = Math.abs(centerX - imgCenter) < 50;
        const isIdealSize = (right - left) > 180 && (right - left) < 350;
        const eyesDetected = res.has_eyes;

        if (isCentered && isIdealSize && eyesDetected) {
            stabilityCounter += 4;
            scanStatusText.textContent = `STABILIZING... ${stabilityCounter}%`;
            scanStatusText.style.color = "#00ff95";
        } else {
            stabilityCounter = Math.max(0, stabilityCounter - 2);
            // Show suggestion from backend if available
            if (res.suggestion && res.suggestion !== "READY") {
                scanStatusText.textContent = res.suggestion;
                scanStatusText.style.color = "#ff00ea";
            } else if (!isCentered) {
                scanStatusText.textContent = "OFFSET_DETECTED: CENTER_FACE";
            } else if (!isIdealSize) {
                scanStatusText.textContent = "RANGE_ERROR: MOVE_CLOSER";
            }
        }

        // The "Green Parameter" Visual
        regCtx.lineWidth = 4;
        regCtx.setLineDash([10, 5]);
        regCtx.beginPath();
        regCtx.arc(centerX, top + (bottom - top) / 2, (right - left) / 1.3, 0, Math.PI * 2);
        regCtx.stroke();
        regCtx.setLineDash([]);

        // Progress Fill effect
        regCtx.beginPath();
        regCtx.arc(centerX, top + (bottom - top) / 2, (right - left) / 1.3, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * (stabilityCounter / 100)));
        regCtx.strokeStyle = "#00ff95";
        regCtx.stroke();

        if (stabilityCounter >= 100) {
            autoCaptureAndSave();
        }
    } else {
        stabilityCounter = Math.max(0, stabilityCounter - 5);
        scanStatusText.textContent = "SIGNAL_LOST";
    }
}

async function autoCaptureAndSave() {
    registrationState = 3;
    scanStatusText.textContent = "ALIGNED - SECURING_DATA";

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = regVideo.videoWidth;
    snapCanvas.height = regVideo.videoHeight;
    snapCanvas.getContext('2d').drawImage(regVideo, 0, 0);

    const blob = await new Promise(res => snapCanvas.toBlob(res, 'image/jpeg', 1.0));

    const formData = new FormData(regForm);
    formData.append('image', blob, 'photo.jpg');

    const response = await fetch('/register', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    if (response.ok) {
        alert("BIOMETRIC PROFILE CREATED SUCCESSFULLY");
        location.reload();
    } else {
        if (data.status === 'conflict') {
            alert(data.message);
        } else {
            alert("UPLOAD_FAILED: " + (data.message || "Unknown Error"));
        }
        showStep(1);
    }
}

document.getElementById('manual-capture').onclick = () => {
    if (confirm("FORCE BIOMETRIC CAPTURE?")) {
        autoCaptureAndSave();
    }
};

document.querySelector('.close-modal').onclick = () => {
    regModal.classList.add('hidden');
    isRegistering = false;
    if (regVideo.srcObject) regVideo.srcObject.getTracks().forEach(t => t.stop());
};

startMainCamera();
