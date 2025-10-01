// Collapsible Q/A intake (static demo)
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const qaLog = document.getElementById("qaLog");
const form = document.getElementById("chatForm");
const dynamicField = document.getElementById("dynamicField");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const mailtoBtn = document.getElementById("mailtoBtn");
const summaryEl = document.getElementById("summary");

let step = -1;
let openDetails = null;

let data = {
  createdAt: new Date().toISOString(),
  source: "sellmycybertruck-ai-intake-demo",
  vin: "",
  inferredTrim: "",
  foundation: "",
  trim: "",
  odometer: "",
  titleStatus: "",
  payoff: "",
  zip: "",
  currentOffer: "",
  media: []
};

const steps = [
  {
    key: "vin",
    prompt: "VIN (17 characters)",
    type: "text",
    placeholder: "7G2CEHED8RA004637",
    validate: (v) => v && v.replace(/\s/g, "").length >= 11,
    onAnswer: (v) => {
      data.vin = v.toUpperCase().trim();
      data.inferredTrim = "Unknown (demo)";
    }
  },
  {
    key: "foundation",
    prompt: "Is it a Foundation Series?",
    type: "select",
    options: ["Yes — Foundation", "No — Not Foundation"],
    map: (v) => (v.startsWith("Yes") ? "Foundation" : "Non-Foundation")
  },
  { key: "trim", prompt: "Which trim?", type: "select", options: ["AWD", "Cyberbeast"] },
  { key: "odometer", prompt: "Current odometer (miles)", type: "number", min: 0 },
  { key: "titleStatus", prompt: "Title on hand or loan?", type: "select", options: ["Title on hand", "Loan"] },
  { key: "payoff", prompt: "Approximate payoff amount today (USD)", type: "number", min: 0, when: () => data.titleStatus === "Loan" },
  { key: "zip", prompt: "ZIP code", type: "text", placeholder: "e.g., 10001", validate: (v) => /^\d{5}(-\d{4})?$/.test(v.trim()) },
  { key: "currentOffer", prompt: "Any current valid offers? (optional)", type: "text", placeholder: "Optional", required: false },
  {
    key: "media",
    prompt: "Add images/video (local only; not uploaded). Exterior, interior, odometer, walk-around video.",
    type: "file",
    accept: "image/*,video/*",
    multiple: true,
    required: false,
    onAnswer: (files) => previewMedia(files)
  },
  { key: "done", prompt: "All set. Review the summary and export/copy/email.", type: "end" }
];

// Build a collapsible item for the current step
function addQAItem(s) {
  const details = document.createElement("details");
  details.className = "qa-item";
  details.open = true;

  const summary = document.createElement("summary");
  const icon = document.createElement("div");
  icon.className = "qa-icon";
  icon.textContent = "👤"; // user for question
  const label = document.createElement("div");
  label.className = "qa-question";
  label.textContent = s.prompt;

  summary.appendChild(icon);
  summary.appendChild(label);
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "qa-answer";
  // where the live input renders:
  const live = document.createElement("div");
  live.id = "liveField";
  body.appendChild(live);

  // where we print the frozen answer after submit:
  const ans = document.createElement("div");
  ans.className = "answer-text";
  ans.style.display = "none";
  body.appendChild(ans);

  details.appendChild(body);
  qaLog.appendChild(details);

  // manage which is open
  if (openDetails) openDetails.open = false;
  openDetails = details;

  // render the actual input into the main dynamic field (bottom) AND into the live slot for context
  renderField(s);
  // mirror the control in the card body for visual focus around the current step
  const mirrored = dynamicField.firstElementChild ? dynamicField.firstElementChild.cloneNode(true) : null;
  if (mirrored) {
    // keep mirrored read-only cursor
    mirrored.disabled = false;
    live.appendChild(mirrored);
  }

  return { details, ans };
}

function renderField(s) {
  dynamicField.innerHTML = "";
  if (s.type === "text") {
    const input = document.createElement("input");
    input.className = "input";
    input.type = "text";
    input.placeholder = s.placeholder || "";
    input.autocomplete = "off";
    dynamicField.appendChild(input);
    input.focus();
  } else if (s.type === "number") {
    const input = document.createElement("input");
    input.className = "number";
    input.type = "number";
    if (typeof s.min === "number") input.min = s.min;
    input.placeholder = s.placeholder || "";
    dynamicField.appendChild(input);
    input.focus();
  } else if (s.type === "select") {
    const sel = document.createElement("select");
    sel.className = "select";
    for (const opt of s.options) {
      const o = document.createElement("option");
      o.value = opt; o.textContent = opt;
      sel.appendChild(o);
    }
    dynamicField.appendChild(sel);
    sel.focus();
  } else if (s.type === "file") {
    const label = document.createElement("label");
    label.className = "small";
    label.textContent = "Files are kept in your browser for preview only (not uploaded).";

    const file = document.createElement("input");
    file.className = "file";
    file.type = "file";
    if (s.accept) file.accept = s.accept;
    if (s.multiple) file.multiple = true;

    dynamicField.appendChild(label);
    dynamicField.appendChild(file);
  } else if (s.type === "end") {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "You're all set.";
    dynamicField.appendChild(span);
  }
}

function currentInputValue() {
  const el = dynamicField.querySelector("input, select");
  if (!el) return null;
  if (el.type === "file") return el.files;
  return el.value;
}

function validateAnswer(s, v) {
  if (s.type === "end") return true;
  if (s.required === false && (v === "" || v == null)) return true;
  if (s.type === "file") return true; // optional
  if (s.validate) return s.validate(v);
  return v !== "" && v != null;
}

function setAnswer(s, v) {
  let val = v;
  if (s.map) val = s.map(v);
  if (s.type === "number") val = String(v).trim();
  if (s.type === "file") {
    data.media = [];
    for (const f of v) data.media.push({ name: f.name, type: f.type, size: f.size });
  } else if (s.key && s.key !== "done") {
    data[s.key] = (typeof val === "string") ? val.trim() : val;
  }
  if (s.onAnswer) s.onAnswer(v);
  refreshSummary();
}

function nextStep() {
  while (++step < steps.length) {
    const s = steps[step];
    if (s.when && !s.when()) continue;
    const ctx = addQAItem(s);
    // store a reference on the step so we can fill the frozen answer later
    s._ansNode = ctx.ans;
    return;
  }
  renderField({ type: "end" });
}

function previewMedia(fileList) {
  // Put previews under the current open QA item
  const live = openDetails?.querySelector("#liveField");
  const container = document.createElement("div");
  container.className = "preview-media";
  [...fileList].forEach(f => {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith("video/")) {
      const vid = document.createElement("video");
      vid.src = url; vid.controls = true;
      container.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = url;
      container.appendChild(img);
    }
  });
  live?.appendChild(container);
}

function refreshSummary() {
  const lines = [
    `VIN: ${data.vin || "—"}`,
    `Foundation: ${data.foundation || "—"}`,
    `Trim: ${data.trim || "—"}`,
    `Odometer: ${data.odometer || "—"} miles`,
    `Title Status: ${data.titleStatus || "—"}`,
    data.titleStatus === "Loan" ? `Payoff (approx): $${data.payoff || "—"}` : null,
    `ZIP: ${data.zip || "—"}`,
    `Current Offer: ${data.currentOffer || "—"}`,
    `Files selected (local only): ${data.media.length}`
  ].filter(Boolean);

  summaryEl.innerHTML = "<pre><code>" + lines.join("\n") + "</code></pre>";
  const subject = encodeURIComponent("Sell My Cybertruck — Intake");
  const body = encodeURIComponent(lines.join("\n") + "\n\n(This came from the static demo.)");
  mailtoBtn.href = `mailto:offers@sellmycybertruck.com?subject=${subject}&body=${body}`;
}

function exportJSON() {
  const out = { ...data, media: data.media };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `cybertruck-intake-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copySummary() {
  const txt = summaryEl.innerText;
  navigator.clipboard.writeText(txt).then(() => {})
  .catch(() => alert("Select the summary and copy."));
}

// Basic keyword Q&A (works anywhere)
function keywordQA(text) {
  const t = text.toLowerCase();
  if (t.includes("how much") || t.includes("offer")) return "We generate a cash offer after intake. If you have a valid current offer, include it so we can try to beat it.";
  if (t.includes("loan")) return "Loans are fine. We'll need your approximate payoff today and later a lender payoff letter.";
  if (t.includes("photo") || t.includes("image") || t.includes("video")) return "Upload exterior (all sides), interior, odometer, any damage, and a short walk-around video.";
  if (t.includes("foundation")) return "Foundation Series is supported. Please confirm Foundation vs Non-Foundation.";
  if (t.includes("vin")) return "Paste your 17-character VIN so we can verify the build.";
  return null;
}

// Events
startBtn.addEventListener("click", () => {
  if (step >= 0) return;
  nextStep();
});

resetBtn.addEventListener("click", () => {
  step = -1; openDetails = null;
  data = { createdAt: new Date().toISOString(), source: "sellmycybertruck-ai-intake-demo", vin: "", inferredTrim: "", foundation: "", trim: "", odometer: "", titleStatus: "", payoff: "", zip: "", currentOffer: "", media: [] };
  qaLog.innerHTML = "";
  dynamicField.innerHTML = "";
  summaryEl.innerHTML = "";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (step < 0 || step >= steps.length) return;

  const s = steps[step];
  const v = currentInputValue();

  if (typeof v === "string") {
    const qa = keywordQA(v);
    if (qa && (!s.validate || !s.validate(v))) {
      alert(qa);
      return;
    }
  }

  if (!validateAnswer(s, v)) {
    alert("Please provide a valid answer to continue.");
    return;
  }

  if (s.type !== "end") {
    setAnswer(s, v);
    // freeze the answer in the collapsed card
    if (s._ansNode) {
      s._ansNode.style.display = "block";
      const displayText = (s.type === "file") ? `${v.length} file(s)` : String(v);
      s._ansNode.textContent = displayText;
    }
  }

  nextStep();
});

copyBtn.addEventListener("click", copySummary);
exportBtn.addEventListener("click", exportJSON);

// Initialize
refreshSummary();
