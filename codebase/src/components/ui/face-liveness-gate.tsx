import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { ScanFace, Loader2, X, KeyRound, Check, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadFaceLandmarker,
  getFaceDelegate,
  hasWebGL2,
  WEBGL2_UNAVAILABLE,
} from "@/lib/face-landmarker";
import {
  estimateYaw,
  faceCenterOffset,
  gestureProgress,
  isCentered,
  GESTURES,
  GESTURE_LABEL,
  type Gesture,
  type Landmark,
} from "@/lib/face-liveness";

type Phase = "loading" | "ready" | "success" | "error";

// Ring geometry.
const SIZE = 260;
const RADIUS = 118;
const STROKE = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CAMERA = SIZE - 30;

// Temporary on-screen diagnostics for the face detection. Flip off once tuned.
const DEBUG = true;

/**
 * Municipality face-login step: a "center your face → turn left → turn right" liveness
 * gesture driven by real in-browser MediaPipe head-pose detection. A granular, ratcheting
 * ring fills as each gesture completes, a live landmark mesh is drawn over the face, and a
 * success flourish plays on completion. Honest framing: a *demo* presence check, with a
 * password fallback so a lighting hiccup never blocks sign-in.
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
  const [progress, setProgress] = useState(0);
  const [gesture, setGesture] = useState<Gesture | "done">("center");
  const [faceVisible, setFaceVisible] = useState(false);
  const [centered, setCentered] = useState(false);
  const [struggling, setStruggling] = useState(false);
  const [dbg, setDbg] = useState({
    face: false,
    yaw: 0,
    offset: 0,
    hold: 0,
    err: null as string | null,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // Temporal detection state (kept in refs so the rAF loop reads fresh values).
  const gestureIndexRef = useRef(0);
  const firstTurnSignRef = useRef<-1 | 0 | 1>(0);
  const holdMsRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const progressRef = useRef(0); // ratcheted: only ever grows, for a smooth ring
  const lastVideoTimeRef = useRef(-1);
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

    const drawOverlay = (landmarks: readonly Landmark[]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const g = canvas.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = "rgba(0, 94, 184, 0.5)";
      for (const p of landmarks) {
        g.beginPath();
        g.arc(p.x * canvas.width, p.y * canvas.height, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    };

    const clearOverlay = () => {
      const canvas = canvasRef.current;
      const g = canvas?.getContext("2d");
      if (canvas && g) g.clearRect(0, 0, canvas.width, canvas.height);
    };

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearOverlay();
      setGesture("done");
      setProgress(1);
      setPhase("success");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      window.setTimeout(() => {
        if (!cancelled) onSuccess();
      }, 1100);
    };

    const loop = () => {
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2 || !video.videoWidth) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const dt = lastTsRef.current == null ? 16 : now - lastTsRef.current;
      lastTsRef.current = now;

      // Only run detection on a fresh frame (MediaPipe needs increasing timestamps).
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        let landmarks: readonly Landmark[] | undefined;
        try {
          if (getFaceDelegate() === "CPU") {
            // CPU fallback uses IMAGE mode (no WebGL textures required)
            landmarks = lm.detect(video).faceLandmarks?.[0];
          } else {
            // GPU uses VIDEO mode
            landmarks = lm.detectForVideo(video, now).faceLandmarks?.[0];
          }
        } catch (err) {
          const msg = (err as Error)?.message ?? String(err);
          console.error("[FaceGate] detect failed:", err);
          if (DEBUG) setDbg((d) => ({ ...d, face: false, err: msg }));
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        if (landmarks && landmarks.length) {
          setFaceVisible(true);
          drawOverlay(landmarks);

          const yaw = estimateYaw(landmarks) ?? 0;
          const offset = faceCenterOffset(landmarks) ?? 1;
          if (DEBUG) setDbg({ face: true, yaw, offset, hold: holdMsRef.current, err: null });
          const idx = gestureIndexRef.current;
          const current = GESTURES[idx];

          const centredNow = isCentered({ yaw, offset });
          setCentered(centredNow);
          if (current === "center") {
            holdMsRef.current = centredNow ? holdMsRef.current + dt : 0;
          }

          const local = gestureProgress(
            current,
            { yaw, offset, holdMs: holdMsRef.current },
            firstTurnSignRef.current,
          );

          // Ratcheted overall progress: base for completed gestures + this one's fraction.
          const base = idx / GESTURES.length;
          const candidate = base + local / GESTURES.length;
          if (candidate > progressRef.current + 0.002) {
            progressRef.current = candidate;
            setProgress(candidate);
          }

          if (local >= 1) {
            if (current === "left") firstTurnSignRef.current = yaw < 0 ? -1 : 1;
            gestureIndexRef.current = idx + 1;
            holdMsRef.current = 0;
            if (gestureIndexRef.current >= GESTURES.length) {
              finish();
              return;
            }
            setGesture(GESTURES[gestureIndexRef.current]);
          }
        } else {
          setFaceVisible(false);
          holdMsRef.current = 0; // lose the centre hold if the face leaves the frame
          clearOverlay();
          if (DEBUG) setDbg((d) => ({ ...d, face: false }));
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
      } catch (e) {
        const msg = (e as Error)?.message;
        setErrorMsg(
          msg === WEBGL2_UNAVAILABLE
            ? "Your browser can't use WebGL. Turn on hardware acceleration (browser Settings → System), then reload — or use your password."
            : "Couldn't start face detection on this device. Use your password to sign in.",
        );
        setPhase("error");
        return;
      }

      lastTsRef.current = null;
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
  const instruction =
    phase === "error"
      ? "Face check unavailable"
      : phase === "loading"
        ? "Downloading face model… (first load only)"
        : !faceVisible
          ? "Center your face in the circle"
          : gesture === "center" && !centered
            ? "Move your face into the middle"
            : GESTURE_LABEL[gesture];

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
                  style={{
                    transition: isDone
                      ? "stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1), stroke 0.3s ease"
                      : "stroke-dashoffset 0.12s linear, stroke 0.3s ease",
                  }}
                />
              </svg>

              {/* Circular camera + live landmark overlay */}
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className={cn(
                    "relative rounded-full overflow-hidden bg-slate-900 transition-all duration-500",
                    isDone && "ring-4 ring-emerald-400/50",
                  )}
                  style={{ width: CAMERA, height: CAMERA }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "w-full h-full object-cover -scale-x-100 transition-all duration-500",
                      phase === "loading" && "opacity-0",
                      isDone && "brightness-90 saturate-125",
                    )}
                  />
                  <canvas
                    ref={canvasRef}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none transition-opacity duration-300",
                      isDone ? "opacity-0" : "opacity-100",
                    )}
                  />
                  {/* Green wash on success */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-emerald-500/25 transition-opacity duration-500",
                      isDone ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              </div>

              {/* Loading overlay */}
              {phase === "loading" && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="w-7 h-7 text-[#005EB8] animate-spin" />
                </div>
              )}

              {/* Success flourish */}
              {isDone && (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="absolute w-24 h-24 rounded-full bg-emerald-400/30 animate-ping" />
                  <span
                    className="absolute w-16 h-16 rounded-full bg-emerald-400/40 animate-ping"
                    style={{ animationDelay: "160ms" }}
                  />
                  <div className="relative w-20 h-20 rounded-full bg-emerald-500 grid place-items-center shadow-xl animate-in zoom-in-50 fade-in duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]">
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instruction */}
          <p
            className={cn(
              "mt-5 text-sm font-semibold text-center transition-colors",
              isDone ? "text-emerald-600" : "text-slate-800",
            )}
            aria-live="assertive"
          >
            {instruction}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 text-center">
            Demo liveness check — not used for identification.
          </p>

          {DEBUG && phase !== "error" && (
            <div className="mt-3 w-full rounded-md bg-slate-900 text-slate-100 text-[10px] font-mono px-2 py-1.5 leading-relaxed">
              <div>
                phase: {phase} · model: {getFaceDelegate() ?? "loading"} · webgl2:{" "}
                {hasWebGL2() ? "yes" : "NO"}
              </div>
              <div>
                face: {dbg.face ? "YES" : "no"} · yaw: {dbg.yaw.toFixed(2)} · off:{" "}
                {dbg.offset.toFixed(2)} · hold: {Math.round(dbg.hold)}ms
              </div>
              <div>
                gesture: {gesture} · progress: {(progress * 100).toFixed(0)}%
                {dbg.err ? ` · ERR: ${dbg.err}` : ""}
              </div>
            </div>
          )}
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
