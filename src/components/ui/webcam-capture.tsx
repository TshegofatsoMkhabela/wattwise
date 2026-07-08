"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, X, RotateCcw, Check, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapturedPhoto {
  name: string;
  dataUrl: string; // image/jpeg data URI
  width: number;
  height: number;
}

/**
 * Photo-evidence input with **live webcam capture** (getUserMedia + canvas
 * snapshot) and an upload fallback. Emits a `CapturedPhoto` (JPEG data URI) so
 * callers can preview it and/or forward it as a Direct Line attachment.
 */
export function WebcamCapture({
  value,
  onChange,
}: {
  value: CapturedPhoto | null;
  onChange: (photo: CapturedPhoto | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  const openCamera = useCallback(async () => {
    setError(null);
    setOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This device/browser has no camera API. Use upload instead.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(s);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? "Camera permission denied. Allow access, or use upload."
          : name === "NotFoundError"
            ? "No camera found on this device. Use upload instead."
            : "Could not start the camera. Use upload instead."
      );
    }
  }, []);

  // Bind the stream to the <video> once both exist.
  useEffect(() => {
    if (open && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [open, stream]);

  // Always release the camera on unmount.
  useEffect(() => stopStream, [stopStream]);

  const closeModal = useCallback(() => {
    stopStream();
    setOpen(false);
    setError(null);
  }, [stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    onChange({ name: `evidence-${Date.now()}.jpg`, dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: w, height: h });
    closeModal();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => onChange({ name: file.name, dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => onChange({ name: file.name, dataUrl, width: 0, height: 0 });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {value ? (
        // ── Captured preview ──
        <div className="flex items-center gap-3 border border-input rounded-lg p-2">
          <img src={value.dataUrl} alt="Evidence" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-700 truncate">{value.name}</div>
            <div className="text-[11px] text-slate-400">{value.width ? `${value.width}×${value.height}` : "image"}</div>
          </div>
          <button
            type="button"
            onClick={openCamera}
            className="text-[11px] font-medium text-[#005EB8] hover:underline inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retake
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-slate-400 hover:text-red-500 transition-colors"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // ── Empty: capture or upload ──
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center justify-center gap-2 border border-dashed border-input rounded-lg px-3 py-3 text-xs text-slate-600 hover:bg-muted hover:border-[#005EB8]/40 transition-colors"
          >
            <Camera className="w-4 h-4 text-[#005EB8]" /> Take photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 border border-dashed border-input rounded-lg px-3 py-3 text-xs text-slate-600 hover:bg-muted hover:border-[#005EB8]/40 transition-colors"
          >
            <Upload className="w-4 h-4 text-[#005EB8]" /> Upload
          </button>
        </div>
      )}

      {/* ── Camera modal ── */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Camera className="w-4 h-4 text-[#005EB8]" /> Capture evidence
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-900 aspect-[4/3] grid place-items-center relative">
              {error ? (
                <div className="text-center px-6">
                  <VideoOff className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-300">{error}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn("w-full h-full object-cover", !stream && "opacity-0")}
                />
              )}
              {!error && !stream && (
                <div className="absolute text-xs text-slate-400">Starting camera…</div>
              )}
            </div>

            <div className="flex gap-2 px-4 py-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Upload instead
              </button>
              <button
                onClick={capture}
                disabled={!stream}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[#005EB8] text-white font-semibold hover:bg-[#003F8A] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" /> Capture photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
