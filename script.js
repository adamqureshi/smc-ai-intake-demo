// Dead-simple Cybertruck intake with section chunks, stage bar, VIN-first flow,
// progress, Blob uploads, VIN decode, and mailto to contact@onlyev.com

// --- DOM refs ---
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const qaLog = document.getElementById("qaLog");
const form = document.getElementById("chatForm");
const dynamicField = document.getElementById("dynamicField");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const emailBtn = document.getElementById("emailBtn");
const summaryEl = document.getElementById("summary");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");

// NEW: stage bar + continue button
const stagebarEl = document.getElementById("stagebar");
const nextSectionBtn = document.getElementById("nextSectionBtn");

// --- State ---
let step = -1;
let openDetails = null;

let data = {
  createdAt: new Date().toISOString(),
  source: "sellmycybertruck-ai-intake-demo",
  vin: "",
  vinDecoded: {},                 // <- decoded Year/Make/Model goes here
  foundation: "",
  trim: "",
  odometer: "",
  titleStatus: "",
  payoff: "",
  bank: "",
  zip: "",
  currentOfferYN: "",
  currentOffer: "",
  contact: { name: "", email: "", mobile: "" },
  truckPhotos: [],
  appScreenFiles: [],
  softwareScreenFiles: [],
  truckPhotoUrls: [],
  appScreenUrls: [],
  softwareScreenUrls: []
};

// NEW: top-level sections for the stage bar
const sections = [
  { id: "vin",     label: "VIN" },
  { id: "owner",   label: "Ownership & ZIP" },
  { id: "photos",  label: "Photos" },
  { id: "contact", label: "Contact" },
  { id: "review",  label: "Review & Send" },
];
let currentSectionIndex = 0;

// Steps with section markers (type:"section")
const steps = [
  { type: "section", id: "vin" },

  // Greeting (non-input; opens VIN immediately)
  { key: "_greet", prompt: "Hello! 👋 Ready to begin? Let’s start with your VIN.", type: "info" },

  // Vehicle
  { key: "vin", prompt: "VIN (17 characters)", type: "text", placeholder: "7G2CEHED8RA004637", validate: v => v && v.replace(/\s/g, "").length >= 11 },

  { type: "section", id: "owner" },

  { key: "foundation", prompt: "Foundation Series?", type: "select", options: ["Yes", "No"], map: v => v === "Yes" ? "Foundation" : "Non-Foundation" },
  { key: "trim", prompt: "Trim", type: "select", options: ["AWD (All-Wheel Drive)", "Cyberbeast (Triple Motor)"], map: v => v.startsWith("AWD") ? "AWD" : "Cyberbeast" },
  { key: "odometer", prompt: "How many miles today?", type: "number", min: 0 },
  { key: "titleStatus", prompt: "Do you have the title on hand?", type: "select", options: ["Yes", "No"], map: v => v === "Yes" ? "Title on hand" : "Loan" },
  { key: "payoff", prompt: "If loan: payoff amount today (USD)", type: "number", min: 0, when: () => data.titleStatus === "Loan" },
  { key: "bank", prompt: "What bank is the loan with?", type: "text", placeholder: "e.g., Wells Fargo, US Bank", when: () => data.titleStatus === "Loan" },
  { key: "zip", prompt: "Your ZIP code", type: "text", placeholder: "10001", validate: v => /^\d{5}(-\d{4})?$/.test(v.trim()) },

  { type: "section", id: "photos" },

  // Media
  { key: "truckPhotos", prompt: "Upload photos of the truck (exterior/interior, damage if any).", type: "file", accept: "image/*", multiple: true, onAnswer: files => previewLocal(files) },
  { key: "softwareScreenFiles", prompt: "Upload SOFTWARE screen screenshot (VIN + miles).", type: "file", accept: "image/*", multiple: true, onAnswer: files => previewLocal(files) },
  { key: "appScreenFiles", prompt: "Upload APP screen screenshot (VIN + odometer).", type: "file", accept: "image/*", multiple: true, onAnswer: files => previewLocal(files) },

  { type: "section", id: "contact" },

  // Offers + Contact
  { key: "currentOfferYN", prompt: "Do you have any current valid offers?", type: "select", options: ["No", "Yes"] },
  { key: "currentOffer", prompt: "If yes, paste the offer amount/details.", type: "text", placeholder: "e.g., $92,500 from CarbuyerCo", when: () => data.currentOfferYN === "Yes", required: false },
  { key: "contact.mobile", prompt: "Mobile # (we’ll text you)", type: "text", placeholder: "5551234567", validate: v => v.replace(/\D/g, "").length >= 10 },
  { key: "contact.email", prompt: "Email (if you prefer email)", type: "text", placeholder: "you@example.com", validate: v => v.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), required: false },

  { type: "section", id: "review" },

  { key: "done", prompt: "All set. Review summary, then tap ‘Send to Email’.", type: "end" }
];

// --- Progress helpers (ignore section/info steps) ---
function visibleSteps() {
  return steps.filter(s => s.type !== "info" && s.type !== "section" && (!s.when || s.when()));
}
function totalRealSteps() { return visibleSteps().length; }
function currentIndexAmongShown(k) {
  const list = visibleSteps();
  const idx = list.findIndex(s => s.key === k);
  return idx >= 0 ? idx + 1 : 1;
}
function updateProgress(forKey) {
  const total = totalRealSteps();
  const cur = currentIndexAmongShown(forKey);
  progressLabel.textContent = `Step ${Math.min(cur, total)} of ${total}`;
  progressBar.style.width = `${Math.round((cur - 1) / Math.max(total,1) * 100)}%`;
}

// --- Stage bar ---
function renderStagebar() {
  if (!stagebarEl) return;
  stagebarEl.innerHTML = "";
  sections.forEach((s, i) => {
    const pill = document.createElement("div");
    pill.className = "stage-pill" + (i === currentSectionIndex ? " active" : "");
    pill.textContent = `${i + 1}. ${s.label}`;
    stagebarEl.appendChild(pill);
    if (i < sections.length - 1) {
      const sep = document.createElement("div");
      sep.className = "stage-sep";
      stagebarEl.appendChild(sep);
    }
  });
}

// ---------- UI builders ----------
function addQAItem(s) {
  if (s.type === "info") {
    const info = document.createElement("div");
    info.className = "qa-item";
    const inner = document.createElement("div");
    inner.className = "qa-answer";
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = s.prompt;
    inner.appendChild(title); info.appendChild(inner); qaLog.appendChild(info);
    return { ans: null };
  }

  const details = document.createElement("details");
  details.className = "qa-item"; details.open = true;
  const summary = document.createElement("summary");
  const icon = document.createElement("div"); icon.className = "qa-icon"; icon.textContent = "🧑";
  const label = document.createElement("div"); label.className = "qa-question"; label.textContent = s.prompt;
  summary.appendChild(icon); summary.appendChild(label); details.appendChild(summary);

  const body = document.createElement("div"); body.className = "qa-answer";
  const live = document.createElement("div"); live.id = "liveField"; body.appendChild(live);
  const ans = document.createElement("div"); ans.className = "answer-text"; ans.style.display = "none"; body.appendChild(ans);
  details.appendChild(body); qaLog.appendChild(details);

  if (openDetails) openDetails.open = false;
  openDetails = details;

  renderField(s);
  const mirrored = dynamicField.firstElementChild ? dynamicField.firstElementChild.cloneNode(true) : null;
  if (mirrored) { mirrored.disabled = false; live.appendChild(mirrored); }

  if (s.key) updateProgress(s.key);
  return { ans };
}

function renderField(s) {
  dynamicField.innerHTML = "";
  if (s.type === "text") {
    const input = mk("input", { className: "input", type: "text", placeholder: s.placeholder || "", autocomplete: "off" });
    if (s.key === "vin") { input.style.fontSize = "18px"; input.style.padding = "16px 16px"; }
    dynamicField.appendChild(input); input.focus();
  } else if (s.type === "number") {
    const input = mk("input", { className: "number", type: "number", placeholder: s.placeholder || "" });
    if (typeof s.min === "number") input.min = s.min; dynamicField.appendChild(input); input.focus();
  } else if (s.type === "select") {
    const sel = mk("select", { className: "select" });
    for (const opt of s.options) sel.appendChild(mk("option", { value: opt }, opt));
    dynamicField.appendChild(sel); sel.focus();
  } else if (s.type === "file") {
    const label = mk("label", { className: "small" }, "Files stay local until ‘Send to Email’. Then we upload to Blob.");
    const file = mk("input", { className: "file", type: "file" });
    if (s.accept) file.accept = s.accept; if (s.multiple) file.multiple = true;
    dynamicField.appendChild(label); dynamicField.appendChild(file);
  } else if (s.type === "end") {
    dynamicField.appendChild(mk("span", { className: "muted" }, "You're all set."));
  }
}

function mk(tag, props = {}, text = "") { const el = document.createElement(tag); Object.assign(el, props); if (text) el.textContent = text; return el; }
function currentInputValue() { const el = dynamicField.querySelector("input, select"); if (!el) return null; return el.type === "file" ? el.files : el.value; }

function validateAnswer(s, v) {
  if (s.type === "end" || s.type === "info") return true;
  if (s.required === false && (v === "" || v == null)) return true;
  if (s.type === "file") return true;
  if (s.validate) return s.validate(v);
  return v !== "" && v != null;
}

function setAnswer(s, v) {
  let val = v;
  if (s.map) val = s.map(v);
  if (s.type === "number") val = String(v).trim();

  // mobile formatting: store digits and pretty-print later
  if (s.key === "contact.mobile") {
    const digits = String(v).replace(/\D/g, "").slice(0, 15);
    const pretty = digits.replace(/^(\d{3})(\d{3})(\d{4}).*$/, "($1) $2-$3");
    data.contact.mobile = pretty || digits;
  } else if (s.type === "file") {
    const arr = []; for (const f of v) arr.push(f);
    if (s.key === "truckPhotos") data.truckPhotos = arr;
    if (s.key === "appScreenFiles") data.appScreenFiles = arr;
    if (s.key === "softwareScreenFiles") data.softwareScreenFiles = arr;
  } else if (s.key && s.key !== "done" && s.key !== "_greet") {
    if (s.key.startsWith("contact.")) { const sub = s.key.split(".")[1]; data.contact[sub] = (typeof val === "string") ? val.trim() : val; }
    else { data[s.key] = (typeof val === "string") ? val.trim() : val; }
  }
  refreshSummary();
}

// NEW: stepper that pauses at section markers and shows Continue button
function nextStep() {
  while (++step < steps.length) {
    const s = steps[step];

    // Section marker: render stage, show Continue button, pause
    if (s.type === "section") {
      const idx = sections.findIndex(x => x.id === s.id);
      currentSectionIndex = idx >= 0 ? idx : currentSectionIndex;
      renderStagebar();
      dynamicField.innerHTML = "";
      if (nextSectionBtn) nextSectionBtn.style.display = "inline-flex";
      return;
    }

    if (s.when && !s.when()) continue;

    const ctx = addQAItem(s); s._ansNode = ctx.ans; // may be null for info
    if (s.type === "info") continue;               // auto-skip greeting
    return;                                        // stop on first interactive step
  }
  renderField({ type: "end" });
  updateProgress("done");
}

// Continue button moves from section header to first question in section
if (nextSectionBtn) {
  nextSectionBtn.addEventListener("click", () => {
    nextSectionBtn.style.display = "none";
    nextStep();
  });
}

function previewLocal(fileList) {
  const live = openDetails?.querySelector("#liveField");
  const container = mk("div", { className: "preview-media" });
  [...fileList].forEach(f => { const url = URL.createObjectURL(f); const img = mk("img"); img.src = url; container.appendChild(img); });
  live?.appendChild(container);
}

function refreshSummary() {
  const decodedLine = (data.vinDecoded && (data.vinDecoded.year || data.vinDecoded.make || data.vinDecoded.model))
    ? `Decoded: ${[data.vinDecoded.year, data.vinDecoded.make, data.vinDecoded.model].filter(Boolean).join(" ")}`
    : null;

  const lines = [
    `VIN: ${data.vin || "—"}`,
    decodedLine,
    `Foundation: ${data.foundation || "—"}`,
    `Trim: ${data.trim || "—"}`,
    `Odometer: ${data.odometer || "—"} miles`,
    `Title Status: ${data.titleStatus || "—"}`,
    data.titleStatus === "Loan" ? `Payoff: $${data.payoff || "—"}` : null,
    data.titleStatus === "Loan" ? `Bank: ${data.bank || "—"}` : null,
    `ZIP: ${data.zip || "—"}`,
    `Current Offer: ${data.currentOfferYN || "—"}${data.currentOfferYN === "Yes" && data.currentOffer ? ` — ${data.currentOffer}` : ""}`,
    `Mobile: ${data.contact.mobile || "—"}`,
    `Email: ${data.contact.email || "—"}`,
    `Truck photos: ${data.truckPhotos.length}`,
    `Software screen: ${data.softwareScreenFiles.length}`,
    `App screen: ${data.appScreenFiles.length}`,
    data.truckPhotoUrls.length ? `Truck Blob URLs:\n${data.truckPhotoUrls.join("\n")}` : null,
    data.softwareScreenUrls.length ? `Software Blob URLs:\n${data.softwareScreenUrls.join("\n")}` : null,
    data.appScreenUrls.length ? `App Blob URLs:\n${data.appScreenUrls.join("\n")}` : null
  ].filter(Boolean);
  summaryEl.innerHTML = "<pre><code>" + lines.join("\n") + "</code></pre>";
}

// === Upload: POST files to /api/upload-url with FormData (your current API) ===
async function uploadToBlob(files) {
  const urls = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append('file', f);
    const r = await fetch('/api/upload-url', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    const { url } = await r.json(); // expects server to return { url }
    urls.push(url); // public Blob URL
  }
  return urls;
}

async function sendEmail() {
  if (data.truckPhotos.length) data.truckPhotoUrls = await uploadToBlob(data.truckPhotos);
  if (data.softwareScreenFiles.length) data.softwareScreenUrls = await uploadToBlob(data.softwareScreenFiles);
  if (data.appScreenFiles.length) data.appScreenUrls = await uploadToBlob(data.appScreenFiles);
  refreshSummary();

  const lines = summaryEl.innerText;
  const subject = encodeURIComponent("New Cybertruck Intake");
  const body = encodeURIComponent(lines + "\n\n(Generated via intake demo)");
  window.location.href = `mailto:contact@onlyev.com?subject=${subject}&body=${body}`;
}

// ----- VIN decoder (calls /api/decode-vin) -----
async function decodeVin(vin) {
  const res = await fetch('/api/decode-vin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vin })
  });
  if (!res.ok) return null;
  const { info } = await res.json();
  data.vinDecoded = info || {};
  refreshSummary();
  return info;
}

// --- Events ---
resetBtn.addEventListener("click", startOver);
function startOver() {
  step = -1; openDetails = null;
  data = { createdAt: new Date().toISOString(), source: "sellmycybertruck-ai-intake-demo",
    vin: "", vinDecoded: {}, foundation: "", trim: "", odometer: "", titleStatus: "", payoff: "", bank: "",
    zip: "", currentOfferYN: "", currentOffer: "", contact: { name: "", email: "", mobile: "" },
    truckPhotos: [], appScreenFiles: [], softwareScreenFiles: [],
    truckPhotoUrls: [], appScreenUrls: [], softwareScreenUrls: []
  };
  qaLog.innerHTML = ""; dynamicField.innerHTML = ""; summaryEl.innerHTML = ""; progressBar.style.width = "0%";
  currentSectionIndex = 0; renderStagebar();
  nextStep(); // greeting + VIN section
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (step < 0 || step >= steps.length) return;

  const s = steps[step];
  const v = currentInputValue();

  if (!validateAnswer(s, v)) {
    alert("Please provide a valid answer to continue.");
    return;
  }

  if (s.type !== "end" && s.type !== "info") {
    setAnswer(s, v);

    // If this is the VIN step, decode and show Year/Make/Model
    if (s.key === "vin") {
      const info = await decodeVin(String(v).trim());
      if (info && s._ansNode) {
        const badge = [info.year, info.make, info.model].filter(Boolean).join(" • ");
        s._ansNode.style.display = "block";
        s._ansNode.textContent = `${String(v).trim()}${badge ? ` — ${badge}` : ""}`;
      }
    } else if (s._ansNode) {
      s._ansNode.style.display = "block";
      s._ansNode.textContent = (s.type === "file") ? `${v.length} file(s)` : String(v);
    }
  }

  nextStep();
});

exportBtn.addEventListener("click", () => {
  const out = { ...data, truckPhotos: undefined, appScreenFiles: undefined, softwareScreenFiles: undefined };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url; a.download = `cybertruck-intake-${ts}.json`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
emailBtn.addEventListener("click", () => { sendEmail().catch(err => alert(err.message || "Upload failed")); });

// Init
renderStagebar();
nextStep(); // show first section header; user taps Continue to start
refreshSummary();





