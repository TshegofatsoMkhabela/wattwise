import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { ScanFace, Loader2, X, KeyRound, Check, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadFaceLandmarker } from "@/lib/face-landmarker";
import {
  advanceLiveness,
  estimateYaw,
  initLiveness,
  liveProgress,
  FACE_STEP_LABEL,
  CENTER_HOLD_MS,
  type FaceStep,
  type LivenessState,
} from "@/lib/face-liveness";

type Phase = "loading" | "ready" | "success" | "error";

// Ring geometry.
const SIZE = 260;
const RADIUS = 118;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function drawFaceOverlay(
  canvas: HTMLCanvasElement,
  landmarks: { x: number; y: number }[],
  isDone: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Make sure canvas internal size matches CSS size
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.clearRect(0, 0, w, h);

  // The video is mirrored via CSS (-scale-x-100), so we must mirror drawing!
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

  // Colors
  const dotColor = isDone ? "rgba(16, 185, 129, 0.9)" : "rgba(0, 200, 255, 0.85)";
  const lineColor = isDone ? "rgba(16, 185, 129, 0.5)" : "rgba(0, 180, 255, 0.5)";

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = dotColor;

  const drawPath = (indices: number[], close = false) => {
    ctx.beginPath();
    indices.forEach((idx, i) => {
      const pt = landmarks[idx];
      if (!pt) return;
      const px = pt.x * w;
      const py = pt.y * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    if (close) ctx.closePath();
    ctx.stroke();
  };

  // Basic outlines: MediaPipe FaceMesh standard indices
  // Left eye: 33, 160, 158, 133, 153, 144
  drawPath([33, 160, 158, 133, 153, 144], true);
  // Right eye: 263, 387, 385, 362, 380, 373
  drawPath([263, 387, 385, 362, 380, 373], true);
  // Lips inner: 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95
  drawPath(
    [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
    true,
  );
  // Nose bridge: 168, 6, 197, 195, 5, 4
  drawPath([168, 6, 197, 195, 5, 4]);

  // Key dots
  const DOTS = [33, 263, 1, 61, 291, 199]; // Outer eyes, nose tip, mouth corners, chin
  DOTS.forEach((idx) => {
    const pt = landmarks[idx];
    if (!pt) return;
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Municipality face-login step: a "look straight → turn left → turn right" liveness
 * gesture driven by real in-browser MediaPipe head-pose detection, with a circular
 * progress ring around the live camera. Honest framing: a *demo* presence check, with
 * a password fallback so a lighting hiccup never blocks sign-in.
 */
export function FaceLivenessGate({
  onSuccess,
  onSkip,
  onCancel,
}: {
  onSuccess: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<FaceStep>("center");
  const [progress, setProgress] = useState(0);
  const [faceVisible, setFaceVisible] = useState(false);
  const [struggling, setStruggling] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<LivenessState>(initLiveness());
  const lastVideoTimeRef = useRef(-1);
  const lastTimeRef = useRef(0);
  const doneRef = useRef(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  const handleSkip = useCallback(() => {
    cleanup();
    onSkip();
  }, [cleanup, onSkip]);

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStep("done");
      setProgress(1);
      setPhase("success");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      window.setTimeout(() => {
        if (!cancelled) onSuccess();
      }, 750);
    };

    const loop = () => {
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2 || !video.videoWidth) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // Only run detection on a fresh frame (MediaPipe needs increasing timestamps).
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const result = lm.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks?.[0];
        if (landmarks && landmarks.length) {
          setFaceVisible(true);
          const yaw = estimateYaw(landmarks);
          if (yaw != null) {
            const now = performance.now();
            const dtMs = lastTimeRef.current > 0 ? now - lastTimeRef.current : 16;
            lastTimeRef.current = now;

            const prev = stateRef.current;
            const next = advanceLiveness(prev, yaw, dtMs);
            stateRef.current = next;
            setStep(next.step);
            setProgress(liveProgress(next, yaw));

            if (canvasRef.current) {
              drawFaceOverlay(canvasRef.current, landmarks, next.step === "done");
            }

            if (next.step === "done" && prev.step !== "done") {
              finish();
              return;
            }
          }
        } else {
          setFaceVisible(false);
          lastTimeRef.current = 0;
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
      // 1) Camera (front-facing). Failures here still leave the password fallback.
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("This device has no camera API. Use your password to sign in.");
        setPhase("error");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setErrorMsg(
          name === "NotAllowedError"
            ? "Camera permission denied. Allow access, or use your password."
            : name === "NotFoundError"
              ? "No camera found. Use your password to sign in."
              : "Could not start the camera. Use your password to sign in.",
        );
        setPhase("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // 2) Face model (shared singleton; may already be prewarmed).
      try {
        const lm = await loadFaceLandmarker();
        if (cancelled) return;
        landmarkerRef.current = lm;
      } catch {
        setErrorMsg("Couldn't load the face model. Check your connection, or use your password.");
        setPhase("error");
        return;
      }

      setPhase("ready");
      rafRef.current = requestAnimationFrame(loop);
    };

    void start();

    // Nudge toward the fallback if the user is stuck (poor lighting, off-camera, etc.).
    const struggleTimer = window.setTimeout(() => {
      if (!doneRef.current && !cancelled) setStruggling(true);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearTimeout(struggleTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cancels the gate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleCancel]);

  const isDone = phase === "success";
  const dashoffset = CIRCUMFERENCE * (1 - progress);
  const holdPercent = Math.min(
    100,
    Math.floor((stateRef.current.centerHeldMs / CENTER_HOLD_MS) * 100),
  );

  const instruction =
    phase === "error"
      ? "Face check unavailable"
      : phase === "loading"
        ? "Downloading face model… (first load only)"
        : !faceVisible && !isDone
          ? "Center your face in the circle"
          : FACE_STEP_LABEL[step];

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)" }}
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Face verification"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden"
        style={{ background: "#fff", borderRadius: "1rem", width: "100%", maxWidth: "28rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ScanFace className="w-4 h-4 text-[#005EB8]" /> Verify it's you
          </div>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Cancel face verification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-6 pb-5 flex flex-col items-center">
          {phase === "error" ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-red-50 grid place-items-center mx-auto mb-3">
                <VideoOff className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-slate-600 max-w-xs">{errorMsg}</p>
            </div>
          ) : (
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
              {/* Progress ring */}
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="absolute inset-0 -rotate-90"
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={isDone ? "#10B981" : "#005EB8"}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashoffset}
                  style={{ transition: "stroke-dashoffset 0.08s linear, stroke 0.3s ease" }}
                />
              </svg>

              {/* Centering Guide Overlay */}
              {step === "centering" && !isDone && phase === "ready" && (
                <div className="absolute inset-0 grid place-items-center z-20 pointer-events-none transition-opacity">
                  <div className="relative flex flex-col items-center">
                    <svg
                      width="140"
                      height="180"
                      viewBox="0 0 140 180"
                      className="overflow-visible"
                    >
                      <ellipse
                        cx="70"
                        cy="90"
                        rx="65"
                        ry="85"
                        fill="none"
                        stroke={faceVisible ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.4)"}
                        strokeWidth="3"
                        strokeDasharray={faceVisible ? "none" : "8 8"}
                        className={cn("transition-all duration-300", faceVisible && "scale-[1.02]")}
                      />
                    </svg>
                    {faceVisible && (
                      <div className="absolute -bottom-8 text-xs font-bold text-emerald-500 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                        {holdPercent}%
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Circular camera */}
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className={cn(
                    "rounded-full overflow-hidden bg-slate-900 grid place-items-center transition-shadow",
                    isDone && "ring-4 ring-emerald-400/40",
                  )}
                  style={{ width: SIZE - 28, height: SIZE - 28 }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover -scale-x-100",
                      phase === "loading" && "opacity-0",
                    )}
                  />
                  {/* Landmark overlay canvas */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                  />
                </div>
              </div>

              {/* Loading / success overlays */}
              {phase === "loading" && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="w-7 h-7 text-[#005EB8] animate-spin" />
                </div>
              )}
              {isDone && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 grid place-items-center shadow-lg animate-in zoom-in-90 duration-300">
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instruction */}
          <p
            className={cn(
              "mt-5 text-sm font-semibold text-center",
              isDone ? "text-emerald-600" : "text-slate-800",
            )}
            aria-live="assertive"
          >
            {instruction}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 text-center">
            Demo liveness check — not used for identification.
          </p>
        </div>

        {/* Footer / fallbacks */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleSkip}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" /> Use password instead
          </button>
          {struggling && phase === "ready" && (
            <span className="text-[11px] text-amber-600 font-medium">
              Trouble seeing you — try better lighting
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
