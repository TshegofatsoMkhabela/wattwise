# Research: How to build the municipality "turn-left / turn-right" face-login, and what it can honestly claim

## Decision this informs
Which approach drives the *look → turn left → turn right → circular ring fills → logged in*
flow for the **municipality** role, and **how we frame it** — demo liveness gesture vs.
real biometric authentication. The framing decision changes what we build: a keyless
client-side gesture (ships today) vs. a certified vendor behind a backend (out of the
frontend-only scope).

## Current system (local grounding)
- **Auth is fake.** [authStore.ts](../src/store/authStore.ts) — `login(email, role)` synthesises
  a hard-coded `User` and persists it to `localStorage` (`nexmotion-auth`). No password
  check, no server, no identity store.
- **Login is a plain form.** [login.tsx](../src/routes/login.tsx) — email/password + a 3-role
  selector; submit → `login()` → route by role. The face step would slot in for
  `role === "municipality"` before `navigate()`.
- **Camera plumbing already exists and is reusable.** [webcam-capture.tsx](../src/components/ui/webcam-capture.tsx)
  has a solid `getUserMedia` + `<video>` + `<canvas>` + permission-error pattern
  (`NotAllowedError`/`NotFoundError`). We copy this, swap the rear camera
  (`facingMode:"environment"`) for the **front** camera (`"user"`).
- **Constraints that rule things out:** frontend-only (no backend to store/compare a face
  template or resist injection attacks); SSR via TanStack Start (any ML lib must be
  **client-only / dynamically imported**); no face/ML dependency in `package.json` today;
  ships in the browser bundle (so any "secret" or model is fully exposed).

## How it's solved

### Studies
- **Survey — deep-learning face anti-spoofing (Emerald ATSIP, 2024)** — maps presentation-attack
  detection; the field has moved from motion cues to CNN/transformer texture + depth models.
  *Fits us?* Confirms hand-rolled motion challenges are last-generation. *Trades off:* none we adopt directly (needs training data + a server). **abstract-only.**
  [link](https://www.emerald.com/atsip/article/13/1/1/1331366/A-Survey-on-Deep-Learning-based-Face-Anti-Spoofing)
- **Wild Face Anti-Spoofing Challenge 2023 (arXiv 2304.05753)** — benchmark showing **digital
  forgery / deepfakes remain a threat** even to trained detectors. *Fits us?* Sets the honesty
  bar: even real detectors struggle, so our gesture must not be sold as security. **abstract-only.**
  [link](https://arxiv.org/pdf/2304.05753)
- **LivDet-Face 2024 (NSF PAR)** — 9 presentation-attack types (print, replay, 3D/silicone mask,
  projection…). *Fits us?* A client-side head-turn defeats *none* of these on its own. **abstract-only.**
  [link](https://par.nsf.gov/servlets/purl/10577571)
- **Load-bearing finding (industry + NIST framing):** **active motion challenges — nod / blink /
  head-turn — are the class MOST easily satisfied by real-time face-swap deepfakes**, because
  synthetic video can perform the requested motion on demand; and **NIST biometric evals don't
  measure deepfake/injection resilience** while **injection attacks rose ~9× in 2024**. i.e. the
  exact UX the user wants is the *weakest* liveness signal.
  [ROC](https://roc.ai/2025/05/13/next-gen-liveness-detection-for-deepfake-and-injection-attacks/) ·
  [iProov/Biometric Update](https://www.biometricupdate.com/202408/disconnect-between-deepfake-attacks-and-defenses-revealed-by-iproov-survey)

### Companies
- **MediaPipe Face Landmarker (Google)** — `@mediapipe/tasks-vision`, **runs fully in-browser, no
  server**; outputs 3D landmarks, **52 blendshapes**, and a **facial transformation matrix** (→ derive
  yaw/pitch/roll for turn-left/right; blendshapes give blink/smile). *Fits us?* **Yes — this is the
  build.** *Trades off:* a multi-MB model download on first use (exact size not stated in the docs —
  verify), "early release." [docs](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) ·
  [head-pose via solvePnP walkthrough](https://medium.com/@susanne.thierfelder/head-pose-estimation-with-mediapipe-and-opencv-in-javascript-c87980df3acb)
- **AWS Rekognition Face Liveness** — ships a **React Amplify component** with a **"Face Movement"
  (head-turn) challenge** and a Face-Movement + colored-**light** challenge; cloud-verified, certified.
  *Fits us?* Only if we add a backend + AWS — the real-deployment path, not the demo.
  [Amplify React docs](https://ui.docs.amplify.aws/react/connected-components/liveness) ·
  [product](https://aws.amazon.com/rekognition/face-liveness/)
- **iProov (Flashmark) / FaceTec** — certified vendors; iProov deliberately **avoids head-turn friction**
  in favour of **passive** controlled-illumination liveness (patented Flashmark), citing ~98% completion
  and better deepfake resilience. *Fits us?* The production answer for regulated identity — same UI shell,
  swap the engine. [iProov liveness](https://www.iproov.com/liveness-detection)

## Where they agree / diverge
Academia and the top certified vendors are moving **away** from active nod/turn challenges toward
**passive** liveness (texture/depth/illumination), precisely because a head-turn is easy for a
real-time deepfake to satisfy and can't stop injection attacks. **But** none of that is achievable
in a frontend-only app anyway — real liveness needs a server the attacker can't see, template storage,
and injection defense. So our constraints put us on the **UX side, not the security side**: the
head-turn + ring is excellent, legible *presence theatre*, and MediaPipe makes it cheap to build
client-side — as long as we don't call it security.

## Recommendation (the seed)
Build the flow **client-side with MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`, dynamically
imported so SSR is safe; reuse the [webcam-capture](../src/components/ui/webcam-capture.tsx) camera/permission
pattern with the front camera). Use the transformation matrix for **yaw** to detect *center → left → right*,
optionally a blendshape **blink** as a third step, and drive an **SVG `stroke-dasharray` circular ring**
around the video that fills one arc per completed step (no charting lib needed). Gate the municipality
`login()` on completion. **Frame it explicitly as a demo "liveness check" / presence gesture — not
biometric authentication** (a copy line + a "Demo — not a security control" note), because the app has
no backend and active head-turns are the weakest anti-spoofing signal. **The accepted tradeoff:** it's
convincing UX and a real client-side gesture, but it verifies *a face moved as asked*, not *who* the
person is — production municipal auth would keep this exact UI and delegate verification to a certified
passive-liveness vendor (AWS Face Liveness / iProov / FaceTec) behind a server.

## Open questions
- **Model weight & cold-start:** exact `face_landmarker.task` size and first-load latency on a low-end
  Limpopo tablet — measure before committing (mirrors the STT "first-run download" concern).
- **Thresholds:** what yaw angle (° ) and dwell time count as a valid "turn," tuned for accessibility
  (users who can't turn their head) — need a skip/fallback to password.
- **Lighter alternative:** is `face-api.js` / `vladmandic/human` enough (smaller, but staler) vs.
  MediaPipe's better-maintained pipeline?
- **Enrollment:** do we fake "match against your enrolled face" (store a descriptor in localStorage) or
  keep it pure liveness with no identity claim? (Storing a face descriptor client-side has privacy/POPIA
  implications even in a demo.)
