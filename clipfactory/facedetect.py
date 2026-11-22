"""Find the streamer's face in a clip and decide the vertical layout automatically.

Samples a few frames with ffmpeg, detects faces (YuNet if its model file is present,
otherwise OpenCV's built-in Haar cascades), keeps the face that shows up consistently,
and returns a layout:
  - "facecam": small face (webcam overlay) -> crop around it, stack on top of gameplay
  - "crop":    big face (full-screen camera / just chatting) -> 9:16 crop centred on the face
  - "blur":    no face found -> full frame over blurred background
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from .util import log, probe_size, run

MODEL = Path(__file__).with_name("models") / "face_detection_yunet_2023mar.onnx"
TOP_ASPECT = 1080 / 700  # aspect of the facecam strip in the facecam layout


def available() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


def _frames(video: Path, start: float, end: float, n: int, tmp: Path) -> list[Path]:
    paths = []
    span = max(0.5, end - start)
    for i in range(n):
        t = start + span * (i + 0.5) / n
        p = tmp / f"f{i:02d}.jpg"
        try:
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                 "-q:v", "3", str(p)])
            paths.append(p)
        except RuntimeError:
            pass
    return paths


class _Detector:
    def __init__(self):
        import cv2
        self.cv2 = cv2
        self.yunet = None
        if MODEL.exists():
            try:
                self.yunet = cv2.FaceDetectorYN.create(str(MODEL), "", (320, 320), 0.7, 0.3, 5000)
            except Exception:  # noqa: BLE001 - fall back to Haar
                self.yunet = None
        if self.yunet is None:
            base = Path(cv2.data.haarcascades)
            self.front = cv2.CascadeClassifier(str(base / "haarcascade_frontalface_default.xml"))
            self.alt = cv2.CascadeClassifier(str(base / "haarcascade_frontalface_alt2.xml"))
            self.profile = cv2.CascadeClassifier(str(base / "haarcascade_profileface.xml"))

    @property
    def name(self) -> str:
        return "YuNet" if self.yunet is not None else "Haar"

    def faces(self, img) -> list[tuple[float, float, float, float, float]]:
        """(x, y, w, h, confidence) in image pixels."""
        cv2 = self.cv2
        h, w = img.shape[:2]
        if self.yunet is not None:
            self.yunet.setInputSize((w, h))
            _, det = self.yunet.detect(img)
            return [(float(d[0]), float(d[1]), float(d[2]), float(d[3]), float(d[14])) for d in (det if det is not None else [])]
        gray = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
        min_side = max(24, int(min(w, h) * 0.04))
        out = []
        for casc, conf in ((self.front, 0.9), (self.alt, 0.85)):
            for (x, y, fw, fh) in casc.detectMultiScale(gray, 1.1, 6, minSize=(min_side, min_side)):
                out.append((float(x), float(y), float(fw), float(fh), conf))
        if not out:  # turned heads
            for flip in (False, True):
                g = cv2.flip(gray, 1) if flip else gray
                for (x, y, fw, fh) in self.profile.detectMultiScale(g, 1.1, 6, minSize=(min_side, min_side)):
                    out.append((float(w - x - fw if flip else x), float(y), float(fw), float(fh), 0.7))
        return out


def _cluster(dets: list[tuple], frame_w: int) -> list[list[tuple]]:
    """Group detections whose centres are close (same face across frames)."""
    groups: list[list[tuple]] = []
    for d in dets:
        cx, cy = d[0] + d[2] / 2, d[1] + d[3] / 2
        for g in groups:
            gx = sum(x[0] + x[2] / 2 for x in g) / len(g)
            gy = sum(x[1] + x[3] / 2 for x in g) / len(g)
            gw = sum(x[2] for x in g) / len(g)
            if abs(cx - gx) < max(gw, frame_w * 0.04) and abs(cy - gy) < max(gw, frame_w * 0.04):
                g.append(d)
                break
        else:
            groups.append([d])
    return groups


def _median(vals):
    s = sorted(vals)
    return s[len(s) // 2]


def find_face(video: Path, start: float, end: float, samples: int = 8):
    """Return (face box in source pixels, frames_with_face, frames_checked, detector name) or None."""
    import cv2
    det = _Detector()
    W, H = probe_size(video)
    with tempfile.TemporaryDirectory() as td:
        frames = _frames(video, start, end, samples, Path(td))
        all_dets = []
        for f in frames:
            img = cv2.imread(str(f))
            if img is None:
                continue
            scale = 1.0
            if img.shape[1] > 1280:  # detect on a smaller copy, map back
                scale = img.shape[1] / 1280
                img = cv2.resize(img, (1280, int(img.shape[0] / scale)))
            for (x, y, w, h, c) in det.faces(img):
                all_dets.append((x * scale, y * scale, w * scale, h * scale, c, f.name))
    if not all_dets or not frames:
        return None
    groups = _cluster(all_dets, W)
    # best = seen in the most distinct frames, then largest
    best = max(groups, key=lambda g: (len({d[5] for d in g}), _median([d[2] for d in g])))
    hits = len({d[5] for d in best})
    if hits < max(2, round(len(frames) * 0.3)):
        return None
    box = (_median([d[0] for d in best]), _median([d[1] for d in best]),
           _median([d[2] for d in best]), _median([d[3] for d in best]))
    return {"box": box, "hits": hits, "frames": len(frames), "detector": det.name, "size": (W, H)}


def plan_layout(video: Path, start: float, end: float) -> dict:
    """Decide layout + crop for one clip. Always returns a plan (falls back to blur)."""
    if not available():
        return {"layout": "blur", "why": "OpenCV belum terpasang (jalankan setup lagi)"}
    try:
        found = find_face(video, start, end)
    except Exception as e:  # noqa: BLE001 - never block a render on detection
        return {"layout": "blur", "why": f"deteksi muka gagal: {e}"}
    if not found:
        return {"layout": "blur", "why": "tidak ada muka yang konsisten"}
    W, H = found["size"]
    x, y, w, h = found["box"]
    cx, cy = x + w / 2, y + h / 2
    tag = f"{found['detector']}, muka di {found['hits']}/{found['frames']} frame"
    if w >= W * 0.095:  # big face: full camera -> vertical crop following the face
        return {"layout": "crop", "center_x": cx / W, "why": f"kamera penuh ({tag})"}
    # webcam overlay: crop a strip around the face (head + shoulders), face in upper half
    cw = min(W, max(w * 4.2, W * 0.2))
    ch = cw / TOP_ASPECT
    if ch > H:
        ch, cw = H, H * TOP_ASPECT
    left = min(max(0, cx - cw / 2), W - cw)
    top = min(max(0, cy - ch * 0.42), H - ch)
    side = "kiri" if cx < W / 3 else "kanan" if cx > W * 2 / 3 else "tengah"
    vert = "atas" if cy < H / 3 else "bawah" if cy > H * 2 / 3 else "tengah"
    return {"layout": "facecam", "facecam": (int(left), int(top), int(cw), int(ch)),
            "why": f"facecam {vert} {side} ({tag})"}


def describe(plan: dict) -> str:
    return {"facecam": "facecam di atas", "crop": "crop ikut muka", "blur": "blur"}[plan["layout"]] + \
        f" · {plan['why']}"


def log_plan(cid: int, plan: dict) -> None:
    log(f"  layout auto #{cid}: {describe(plan)}")
