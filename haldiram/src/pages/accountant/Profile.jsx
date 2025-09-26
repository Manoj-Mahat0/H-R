import React, { useEffect, useRef, useState, useCallback } from "react";
import AccountantSidebar from "../../components/AccountantSidebar";
import { authFetch, getToken } from "../../lib/auth";
import { API_URL } from "../../lib/config";
import { useToast } from "../../components/Toast";
import { FiCamera, FiTrash2, FiCheck, FiX, FiUpload, FiEye, FiRotateCw, FiRefreshCw, FiZoomIn, FiZoomOut } from "react-icons/fi";



const API_UPLOADS = "http://127.0.0.1:8000";
const OUTPUT_SIZE = 800; // final cropped image size
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function dataURLtoFile(dataurl, filename = "image.jpg") {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

// Reusable accessible file uploader card
function UploaderCard({ title, preview, onUploadClick, onRemove, onOpenCrop, inputId }) {
  return (
    <div
      className="p-4 border rounded-lg flex flex-col items-center text-center bg-white"
      role="group"
      aria-labelledby={`${inputId}-label`}
    >
      <div className="flex items-center gap-2">
        <FiCamera className="w-5 h-5 text-gray-500" />
        <div id={`${inputId}-label`} className="text-sm font-medium">{title}</div>
      </div>

      <div className="mt-3 w-36 h-24 rounded overflow-hidden border bg-gray-50 flex items-center justify-center">
        {preview ? (
          <img src={preview} alt={`${title} preview`} className="object-contain w-full h-full" />
        ) : (
          <div className="text-xs text-gray-400">No image</div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white border cursor-pointer" htmlFor={inputId}>
          <FiUpload />
          <span className="sr-only">Upload {title}</span>
          Upload
        </label>

        <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onUploadClick} />

        {preview && (
          <>
            <button type="button" onClick={onOpenCrop} className="px-3 py-1 border rounded text-sm">Preview</button>
            <button type="button" onClick={onRemove} className="px-3 py-1 border rounded text-sm text-red-600" aria-label={`Remove ${title}`}>
              <FiTrash2 />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function useObjectUrl() {
  const urls = useRef([]);
  useEffect(() => {
    return () => {
      for (const u of urls.current) try { URL.revokeObjectURL(u); } catch {}
      urls.current = [];
    };
  }, []);
  const create = useCallback((file) => {
    const u = URL.createObjectURL(file);
    urls.current.push(u);
    return u;
  }, []);
  return create;
}

function CropModal({ file, initialUrl, onCancel, onSave, title, aspect = 1 }) {
  // Live canvas cropping modal with better controls and keyboard support
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [intrinsic, setIntrinsic] = useState({ w: 0, h: 0 });

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  draggingRef.current = dragging;

  // load image (robust: try direct load, if CORS prevents it then fetch the image and create an object URL)
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    async function loadImg() {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        setIntrinsic({ w: img.naturalWidth, h: img.naturalHeight });
        setImgLoaded(true);
        setPos({ x: 0, y: 0 });
      };
      img.onerror = async () => {
        // try fetching the image and creating an object URL (works if server allows same-origin or CORS)
        try {
          const resp = await fetch(initialUrl, { credentials: 'same-origin' });
          if (!resp.ok) throw new Error('fetch failed');
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } catch (e) {
          // final fallback: mark as not loaded so user sees error
          if (!cancelled) {
            console.warn('Failed to load image for cropping', e);
            setImgLoaded(false);
          }
        }
      };

      img.src = initialUrl;
      imgRef.current = img;
    }

    loadImg();

    return () => {
      cancelled = true;
      if (objectUrl) try { URL.revokeObjectURL(objectUrl); } catch {}
    };
  }, [initialUrl]);

  // pointer handlers
  const last = useRef([0, 0]);
  function onPointerDown(e) {
    e.preventDefault();
    setDragging(true);
    last.current = [e.clientX, e.clientY];
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    const [lx, ly] = last.current;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    last.current = [e.clientX, e.clientY];
    setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onPointerUp() {
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  // keyboard: R rotate, arrows nudge, +/- zoom
  useEffect(() => {
    function onKey(e) {
      if (e.key === "r" || e.key === "R") setRotation((r) => (r + 90) % 360);
      if (e.key === "+") setZoom((z) => Math.min(3, +(z + 0.05).toFixed(2)));
      if (e.key === "-") setZoom((z) => Math.max(0.5, +(z - 0.05).toFixed(2)));
      if (e.key === "ArrowUp") setPos((p) => ({ ...p, y: p.y - 2 }));
      if (e.key === "ArrowDown") setPos((p) => ({ ...p, y: p.y + 2 }));
      if (e.key === "ArrowLeft") setPos((p) => ({ ...p, x: p.x - 2 }));
      if (e.key === "ArrowRight") setPos((p) => ({ ...p, x: p.x + 2 }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // compute displayed image size
  function getDispDims(containerSize) {
    const r = rotation % 180 === 0 ? intrinsic.w : intrinsic.h;
    const rH = rotation % 180 === 0 ? intrinsic.h : intrinsic.w;
    const baseScale = r === 0 ? 1 : Math.max(containerSize / r, containerSize / rH);
    const dispW = r * baseScale * zoom; // note: we swapped earlier, but keep consistent below
    // easier: compute scale to cover viewport
    const base = Math.max(containerSize / (rotation % 180 === 0 ? intrinsic.w : intrinsic.h), containerSize / (rotation % 180 === 0 ? intrinsic.h : intrinsic.w));
    const dispW2 = (rotation % 180 === 0 ? intrinsic.w : intrinsic.h) * base * zoom;
    const dispH2 = (rotation % 180 === 0 ? intrinsic.h : intrinsic.w) * base * zoom;
    return { dispW: dispW2, dispH: dispH2 };
  }

  async function doCrop() {
    const container = containerRef.current;
    if (!container || !imgRef.current) return;
    const rect = container.getBoundingClientRect();
    const vpSize = Math.min(rect.width, rect.height);

    const intrinsicW = rotation % 180 === 0 ? intrinsic.w : intrinsic.h;
    const intrinsicH = rotation % 180 === 0 ? intrinsic.h : intrinsic.w;
    if (!intrinsicW || !intrinsicH) return;

    const baseScale = Math.max(vpSize / intrinsicW, vpSize / intrinsicH);
    const dispW = intrinsicW * baseScale * zoom;
    const dispH = intrinsicH * baseScale * zoom;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const imgLeft = centerX - dispW / 2 + pos.x;
    const imgTop = centerY - dispH / 2 + pos.y;

    const scaleBackX = intrinsicW / dispW;
    const scaleBackY = intrinsicH / dispH;

    const viewXOnDisp = (rect.width - vpSize) / 2;
    const viewYOnDisp = (rect.height - vpSize) / 2;

    const srcX = Math.max(0, (viewXOnDisp - imgLeft) * scaleBackX);
    const srcY = Math.max(0, (viewYOnDisp - imgTop) * scaleBackY);
    const srcW = Math.min(intrinsicW - srcX, vpSize * scaleBackX);
    const srcH = Math.min(intrinsicH - srcY, vpSize * scaleBackY);

    // draw rotation onto temp canvas with correct dimensions
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgRef.current.src;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    // create temp canvas of rotated intrinsic dims
    const tempCanvas = document.createElement("canvas");
    const tempW = rotation % 180 === 0 ? img.naturalWidth : img.naturalHeight;
    const tempH = rotation % 180 === 0 ? img.naturalHeight : img.naturalWidth;
    tempCanvas.width = tempW;
    tempCanvas.height = tempH;
    const tctx = tempCanvas.getContext("2d");
    tctx.save();
    if (rotation !== 0) {
      tctx.translate(tempW / 2, tempH / 2);
      tctx.rotate((rotation * Math.PI) / 180);
      tctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    } else {
      tctx.drawImage(img, 0, 0);
    }
    tctx.restore();

    // draw to output canvas
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = Math.round(OUTPUT_SIZE / aspect);
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);

    const sx = Math.max(0, Math.floor(srcX));
    const sy = Math.max(0, Math.floor(srcY));
    const sw = Math.max(1, Math.floor(srcW));
    const sh = Math.max(1, Math.floor(srcH));

    ctx.drawImage(tempCanvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

    const dataURL = out.toDataURL("image/jpeg", 0.9);
    const blobFile = dataURLtoFile(dataURL, file?.name ?? "cropped.jpg");
    onSave(blobFile, dataURL);
  }

  function rotate90() {
    setRotation((r) => (r + 90) % 360);
  }

  function resetView() {
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setRotation(0);
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-4xl p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">{title}</div>
          <div className="flex items-center gap-2">
            <button onClick={rotate90} className="px-2 py-1 border rounded flex items-center gap-1 text-sm" title="Rotate (R)"><FiRotateCw /></button>
            <button onClick={resetView} className="px-2 py-1 border rounded flex items-center gap-1 text-sm" title="Reset view"><FiRefreshCw /></button>
            <button onClick={onCancel} className="px-2 py-1 border rounded">Cancel</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div
              ref={containerRef}
              className="relative bg-gray-100 rounded overflow-hidden h-96 flex items-center justify-center"
              onPointerDown={onPointerDown}
              role="application"
              aria-label="Image crop viewport"
            >
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "85%", height: "85%", maxWidth: 640, maxHeight: 640, position: "relative", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}>
                  <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", overflow: "visible" }}>
                    {/* the visual image */}
                    <img
                      src={initialUrl}
                      alt="to-crop"
                      draggable={false}
                      style={{
                        width: `${getDispDims(500).dispW}px`,
                        height: `${getDispDims(500).dispH}px`,
                        transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg)`,
                        cursor: dragging ? "grabbing" : "grab",
                      }}
                    />
                  </div>
                  <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, pointerEvents: "none", border: "2px solid rgba(255,255,255,0.9)", boxSizing: "border-box", borderRadius: 8 }} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-2 border rounded" aria-label="Zoom out"><FiZoomOut /></button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Zoom"
                />
                <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} className="p-2 border rounded" aria-label="Zoom in"><FiZoomIn /></button>
              </div>

              <div className="text-xs text-gray-500">Use drag, arrow keys to nudge, R to rotate.</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">Live Preview</div>
            <div className="w-full h-64 border rounded overflow-hidden flex items-center justify-center bg-white">
              {/* draw live preview using an offscreen canvas to avoid waiting for save */}
              <LivePreview initialUrl={initialUrl} pos={pos} zoom={zoom} rotation={rotation} aspect={aspect} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={doCrop} className="px-4 py-2 bg-indigo-600 text-white rounded-lg inline-flex items-center gap-2">Crop &amp; Save</button>
              <button onClick={onCancel} className="px-4 py-2 border rounded-lg">Cancel</button>
            </div>

            <div className="mt-4 text-xs text-gray-500">Tip: Use the slider or buttons for fine zoom, rotate with R, and nudge with arrow keys. Cropped image will be {OUTPUT_SIZE}px tall (width varies with aspect).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LivePreview({ initialUrl, pos, zoom, rotation, aspect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");

      // use devicePixelRatio to render sharp preview on high-DPI screens
      const DPR = window.devicePixelRatio || 1;
      const CSS_SIZE = 300; // visual size in px
      c.width = CSS_SIZE * DPR;
      c.height = CSS_SIZE * DPR;
      c.style.width = CSS_SIZE + "px";
      c.style.height = CSS_SIZE + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, CSS_SIZE, CSS_SIZE);

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = initialUrl;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

        // high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // compute a precise fit similar to the crop viewport math
        const vp = Math.min(CSS_SIZE, CSS_SIZE);
        const intrinsicW = img.naturalWidth;
        const intrinsicH = img.naturalHeight;
        if (!intrinsicW || !intrinsicH) return;

        const baseScale = Math.max(vp / intrinsicW, vp / intrinsicH);
        const dispW = intrinsicW * baseScale * zoom;
        const dispH = intrinsicH * baseScale * zoom;

        // center position in canvas coords
        const cx = CSS_SIZE / 2 + pos.x * (CSS_SIZE / 500);
        const cy = CSS_SIZE / 2 + pos.y * (CSS_SIZE / 500);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -dispW / 2, -dispH / 2, dispW, dispH);
        ctx.restore();
      } catch (e) {
        // ignore preview errors
      }
    }
    draw();
    return () => { cancelled = true; };
  }, [initialUrl, pos, zoom, rotation, aspect]);

  return <canvas ref={canvasRef} width={300} height={300} className="max-h-full" />;
}

export default function StaffProfile() {
  const toast = useToast();
  const createObjectUrl = useObjectUrl();

  // helper: open crop modal for either local object URLs or remote server URLs
  async function openCropWithUrl(target, url) {
    // if url is already an object URL (starts with blob: or data: or same-origin local path), open directly
    try {
      if (!url) return;
      const isRemote = /^https?:\/\//.test(url) && !url.startsWith(window.location.origin);
      if (!isRemote || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith(window.location.origin)) {
        setCropState({ open: true, target, file: null, url });
        return;
      }

      // fetch remote image and create object URL as a fallback (avoids CORS-taint when server allows fetch)
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to fetch image');
      const blob = await resp.blob();
      const obj = URL.createObjectURL(blob);
      setCropState({ open: true, target, file: blob, url: obj });
    } catch (err) {
      console.warn('openCropWithUrl error', err);
      // fallback: try opening original url (may fail in canvas), but user can still view image
      setCropState({ open: true, target, file: null, url });
    }
  }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");

  const [profileFile, setProfileFile] = useState(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);

  const [previewProfile, setPreviewProfile] = useState(null);
  const [previewAadhaarFront, setPreviewAadhaarFront] = useState(null);
  const [previewAadhaarBack, setPreviewAadhaarBack] = useState(null);

  const [cropState, setCropState] = useState({ open: false, target: null, file: null, url: null });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await authFetch("/profile/me", { method: "GET" });
        if (!mounted) return;
        setProfile(res);
        setName(res?.name ?? "");
        setEmail(res?.email ?? "");
        setPhone(res?.phone ?? "");
        setAddress(res?.address ?? "");
        setAadhaarNumber(res?.aadhaar_number ?? "");
        setPreviewProfile(res?.profile_pic ? `${API_UPLOADS}${res.profile_pic}` : null);
        setPreviewAadhaarFront(res?.aadhaar_front ? `${API_UPLOADS}${res.aadhaar_front}` : null);
        setPreviewAadhaarBack(res?.aadhaar_back ? `${API_UPLOADS}${res.aadhaar_back}` : null);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Failed to load profile", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [toast]);

  function validateFile(f) {
    if (!f) return "No file";
    if (!f.type.startsWith("image/")) return "File must be an image";
    if (f.size > MAX_FILE_SIZE) return `File too large — max ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    return null;
  }

  function handleFileChosen(e, target) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) return toast(err, "error");
    const url = createObjectUrl(f);
    setCropState({ open: true, target, file: f, url });
  }

  function removeFile(target) {
    if (target === "profile") { setProfileFile(null); setPreviewProfile(null); }
    if (target === "front") { setAadhaarFrontFile(null); setPreviewAadhaarFront(null); }
    if (target === "back") { setAadhaarBackFile(null); setPreviewAadhaarBack(null); }
  }

  function onDropFile(e, target) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) return toast(err, "error");
    const url = createObjectUrl(f);
    setCropState({ open: true, target, file: f, url });
  }

  function cropCancel() { setCropState({ open: false, target: null, file: null, url: null }); }
  function cropSaveAsFile(blobFile, dataUrl) {
    const target = cropState.target;
    if (target === "profile") { setProfileFile(blobFile); setPreviewProfile(dataUrl); }
    if (target === "front") { setAadhaarFrontFile(blobFile); setPreviewAadhaarFront(dataUrl); }
    if (target === "back") { setAadhaarBackFile(blobFile); setPreviewAadhaarBack(dataUrl); }
    setCropState({ open: false, target: null, file: null, url: null });
  }

  function validateForm() {
    if (!name?.trim()) return "Name is required";
    if (!email?.trim()) return "Email is required";
    if (phone && !/^\d{6,15}$/.test(phone)) return "Phone looks invalid";
    if (aadhaarNumber && !/^\d{4,12}$/.test(aadhaarNumber)) return "Aadhaar looks invalid";
    return null;
  }

  async function doSave() {
    const err = validateForm();
    if (err) return toast(err, "error");

    const form = new FormData();
    form.append("name", name);
    form.append("email", email);
    form.append("phone", phone);
    form.append("address", address);
    form.append("aadhaar_number", aadhaarNumber);

    if (profileFile) form.append("profile_pic", profileFile);
    if (aadhaarFrontFile) form.append("aadhaar_front", aadhaarFrontFile);
    if (aadhaarBackFile) form.append("aadhaar_back", aadhaarBackFile);

    try {
      setSaving(true);
      const token = getToken();
      if (!token) throw new Error("No auth token — please login");

      const endpoint = `${API_URL}/profile/me`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = `Request failed: ${res.status}`;
        try { const parsed = txt ? JSON.parse(txt) : null; msg = parsed?.detail || parsed?.message || msg; } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      setProfile(data);
      setPreviewProfile(data?.profile_pic ? `${API_UPLOADS}${data.profile_pic}` : previewProfile);
      setPreviewAadhaarFront(data?.aadhaar_front ? `${API_UPLOADS}${data.aadhaar_front}` : previewAadhaarFront);
      setPreviewAadhaarBack(data?.aadhaar_back ? `${API_UPLOADS}${data.aadhaar_back}` : previewAadhaarBack);

      setProfileFile(null); setAadhaarFrontFile(null); setAadhaarBackFile(null);
      toast("Profile updated", "success");
    } catch (err) {
      console.error(err);
      toast(err?.message || "Failed to update profile", "error");
    } finally { setSaving(false); }
  }

  function resetToSaved() {
    if (!profile) return;
    setName(profile?.name ?? "");
    setEmail(profile?.email ?? "");
    setPhone(profile?.phone ?? "");
    setAddress(profile?.address ?? "");
    setAadhaarNumber(profile?.aadhaar_number ?? "");
    setProfileFile(null); setAadhaarFrontFile(null); setAadhaarBackFile(null);
    setPreviewProfile(profile?.profile_pic ? `${API_UPLOADS}${profile.profile_pic}` : null);
    setPreviewAadhaarFront(profile?.aadhaar_front ? `${API_UPLOADS}${profile.aadhaar_front}` : null);
    setPreviewAadhaarBack(profile?.aadhaar_back ? `${API_UPLOADS}${profile.aadhaar_back}` : null);
    toast("Form reset to saved values", "info");
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AccountantSidebar />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="lg:col-span-1 bg-white rounded-2xl border p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-36 h-36 rounded-full bg-gray-100 overflow-hidden border-2 border-gray-200">
                  {previewProfile ? (
                    <img src={previewProfile} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No photo</div>
                  )}
                </div>

                <button
                  onClick={() => previewProfile && openCropWithUrl('profile', previewProfile)}
                  className="absolute right-0 bottom-0 translate-x-3 translate-y-3 bg-white rounded-full p-2 shadow border"
                  title="Preview"
                >
                  <FiEye className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-gray-900">{profile?.name ?? "—"}</h2>
              <div className="text-sm text-gray-500">{profile?.role ?? "staff"}</div>

              <div className="mt-4 w-full space-y-2">
                <div className="flex items-start gap-3"><div className="text-xs text-gray-500 w-28">Email</div><div className="text-sm text-gray-700">{profile?.email ?? "-"}</div></div>
                <div className="flex items-start gap-3"><div className="text-xs text-gray-500 w-28">Phone</div><div className="text-sm text-gray-700">{profile?.phone ?? "-"}</div></div>
                <div className="flex items-start gap-3"><div className="text-xs text-gray-500 w-28">Address</div><div className="text-sm text-gray-700">{profile?.address ?? "-"}</div></div>
                <div className="flex items-start gap-3"><div className="text-xs text-gray-500 w-28">Updated</div><div className="text-sm text-gray-700">{profile ? `count ${profile.profile_update_count ?? 0}` : "-"}</div></div>
              </div>

              <div className="mt-6 w-full">
                <button onClick={doSave} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow">
                  <FiCheck /> {saving ? "Saving..." : "Save changes"}
                </button>
                <button onClick={resetToSaved} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm">
                  <FiX /> Reset
                </button>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">My profile</h1>
            <p className="text-sm text-gray-500 mb-6">Update your personal details and upload Aadhaar / profile images.</p>

            <form onSubmit={(e) => { e.preventDefault(); doSave(); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border" />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border" />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border" />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Aadhaar number</label>
                  <input value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2 rounded-lg border" />
                  <div className="text-xs text-gray-400 mt-1">We store Aadhaar securely. Leave empty to keep current.</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div onDrop={(e) => onDropFile(e, "profile")} onDragOver={(e) => e.preventDefault()}>
                  <UploaderCard
                    title="Profile photo"
                    preview={previewProfile}
                    onUploadClick={(e) => handleFileChosen(e, "profile")}
                    onRemove={() => removeFile("profile")}
                    onOpenCrop={() => previewProfile && setCropState({ open: true, target: "profile", file: null, url: previewProfile })}
                    inputId="profile-input"
                  />
                </div>

                <div onDrop={(e) => onDropFile(e, "front")} onDragOver={(e) => e.preventDefault()}>
                  <UploaderCard
                    title="Aadhaar front"
                    preview={previewAadhaarFront}
                    onUploadClick={(e) => handleFileChosen(e, "front")}
                    onRemove={() => removeFile("front")}
                    onOpenCrop={() => previewAadhaarFront && openCropWithUrl('front', previewAadhaarFront)}
                    inputId="aadhaar-front-input"
                  />
                </div>

                <div onDrop={(e) => onDropFile(e, "back")} onDragOver={(e) => e.preventDefault()}>
                  <UploaderCard
                    title="Aadhaar back"
                    preview={previewAadhaarBack}
                    onUploadClick={(e) => handleFileChosen(e, "back")}
                    onRemove={() => removeFile("back")}
                    onOpenCrop={() => previewAadhaarBack && openCropWithUrl('back', previewAadhaarBack)}
                    inputId="aadhaar-back-input"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={resetToSaved} className="px-4 py-2 rounded border">Reset</button>
                <button type="button" onClick={doSave} disabled={saving} className="px-4 py-2 rounded bg-indigo-600 text-white inline-flex items-center gap-2">
                  {saving ? "Saving..." : (<><FiCheck /> Save</>)}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>

      {cropState.open && (
        <CropModal
          file={cropState.file}
          initialUrl={cropState.url}
          title={cropState.target === "profile" ? "Crop profile photo" : cropState.target === "front" ? "Crop Aadhaar front" : "Crop Aadhaar back"}
          onCancel={cropCancel}
          onSave={(blobFile, dataUrl) => cropSaveAsFile(blobFile, dataUrl)}
          aspect={cropState.target === "profile" ? 1 : 1.6}
        />
      )}
    </div>
  );
}
