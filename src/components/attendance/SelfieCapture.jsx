import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCcw, X } from 'lucide-react';
import Button from '../ui/Button';

/** Target size for the uploaded selfie: longest edge and JPEG byte budget. */
export const SELFIE_MAX_EDGE = 640;
export const SELFIE_MAX_BYTES = 200 * 1024;

/** Decoded byte length of a base64 data URL. */
export function dataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Draws a source (video frame or image) onto a canvas scaled so the longest edge is
 * at most SELFIE_MAX_EDGE, then lowers JPEG quality (and finally dimensions) until the
 * result fits SELFIE_MAX_BYTES. Returns a "data:image/jpeg;base64,..." string.
 */
export function compressToJpeg(source, sourceWidth, sourceHeight, { maxEdge = SELFIE_MAX_EDGE, maxBytes = SELFIE_MAX_BYTES } = {}) {
  const width = sourceWidth || 640;
  const height = sourceHeight || 480;
  let scale = Math.min(1, maxEdge / Math.max(width, height));
  let result = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_UNAVAILABLE');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (let quality = 0.82; quality >= 0.4; quality -= 0.1) {
      result = canvas.toDataURL('image/jpeg', quality);
      if (dataUrlBytes(result) <= maxBytes) return result;
    }
    scale *= 0.75;
  }
  return result;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMAGE_UNREADABLE')); };
    image.src = url;
  });
}

function cameraErrorText(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access, or take a photo with the button below.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No front camera was found. Take a photo with the button below instead.';
  }
  return 'The camera could not be started. Take a photo with the button below instead.';
}

/**
 * Front-camera selfie capture for check-in. Uses getUserMedia (facingMode "user") with a
 * live preview; falls back to <input type="file" capture="user"> when the API is missing
 * or the camera fails. The photo is only used as attendance evidence - no face recognition.
 *
 * Props: onCapture(dataUrl) when the employee confirms, onCancel().
 */
export default function SelfieCapture({ onCapture, onCancel, busy = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(0);
  const fileRef = useRef(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [mode, setMode] = useState(supported ? 'starting' : 'fallback');
  const [error, setError] = useState(supported ? null : 'Live camera is not available in this browser. Take a photo instead.');
  const [photo, setPhoto] = useState(null);

  const stopStream = useCallback(() => {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    if (!supported) return;
    const requestId = ++requestRef.current;
    setMode('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try { await video.play?.(); } catch { /* autoplay may be blocked until the user taps; preview still attaches */ }
      }
      setError(null);
      setMode('live');
    } catch (cameraError) {
      if (requestId !== requestRef.current) return;
      setError(cameraErrorText(cameraError));
      setMode('fallback');
    }
  }, [supported]);

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    try {
      setPhoto(compressToJpeg(video, video.videoWidth, video.videoHeight));
      stopStream();
      setMode('preview');
    } catch {
      setError('The photo could not be processed. Try again.');
    }
  }

  async function onFileChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo (JPEG or PNG).');
      return;
    }
    try {
      const image = await loadImage(file);
      setPhoto(compressToJpeg(image, image.naturalWidth || image.width, image.naturalHeight || image.height));
      setMode('preview');
    } catch {
      setError('That photo could not be read. Try taking it again.');
    }
  }

  function retake() {
    setPhoto(null);
    if (supported && !error) startStream();
    else setMode('fallback');
  }

  return (
    <div className="hz-selfie" data-testid="selfie-capture">
      <div className="hz-selfie__frame">
        {mode === 'preview' && photo
          ? <img src={photo} alt="Your check-in selfie" className="hz-selfie__media" />
          : (
            <video
              ref={videoRef}
              className="hz-selfie__media hz-selfie__media--mirror"
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
              hidden={mode === 'fallback'}
            />
          )}
        {mode === 'starting' && <div className="hz-selfie__overlay">Starting camera…</div>}
        {mode === 'fallback' && !photo && (
          <div className="hz-selfie__overlay"><Camera size={32} aria-hidden="true" /></div>
        )}
      </div>

      {error && <div className="alert alert-warning mb-0 small" role="status">{error}</div>}
      <p className="text-muted-hz small mb-0">Your selfie is attached to today’s check-in so HR can verify attendance. It is deleted automatically after the retention period.</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="d-none"
        data-testid="selfie-file-input"
        onChange={onFileChosen}
      />

      <div className="hz-selfie__actions">
        {mode === 'live' && <Button icon={Camera} onClick={captureFrame}>Take selfie</Button>}
        {mode === 'fallback' && <Button icon={Camera} onClick={() => fileRef.current?.click()}>Take photo</Button>}
        {mode === 'preview' && (
          <>
            <Button variant="secondary" icon={RotateCcw} onClick={retake} disabled={busy}>Retake</Button>
            <Button icon={Check} onClick={() => onCapture?.(photo)} loading={busy}>Use photo &amp; check in</Button>
          </>
        )}
        <Button variant="ghost" icon={X} onClick={() => { stopStream(); onCancel?.(); }} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
