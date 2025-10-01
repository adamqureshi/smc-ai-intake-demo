// Minimal guided chat for a static demo (no backend).
// Collects intake answers and exports a JSON summary. Very small JS to keep the demo lightweight.

const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const chat = document.getElementById("chat");
const form = document.getElementById("chatForm");
const dynamicField = document.getElementById("dynamicField");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const mailtoBtn = document.getElementById("mailtoBtn");
const summaryEl = document.getElementById("summary");

let step = -1;
let data = {
  createdAt: new Date().toISOString(),
  source: "sellmycybertruck-ai-intake-demo",
  vin: "",
  inferredTrim: "",     // heuristic / placeholder
  foundation: "",
  trim: "",             // AWD or Cyberbeast
  odometer: "",
  titleStatus: "",      // "title" or "loan"
  payoff: "",
  zip: "",
  currentOffer: "",     // optional text
  media: []             // for previews only (not exported)
};

const steps = [
  {
    key: "vin",
    prompt: "Hey! I’m your Cybertruck intake agent. What’s your VIN? (17 characters)",
    type: "text",
    placeholder: "7G2CEHED8RA004637",
    validate: (v) => v && v.replace(/\s/g, "").length >= 11, // allow partial for demo
    onAnswer: (v) => {
      // Fake VIN "decode" to keep it demo-only
      data.vin = v.toUpperCase().trim();
      data.inferredTrim = "Unknown (demo)";
      msgAgent(`Decoding VIN… (demo) I show <code>${data.inferredTrim}</code>.`);
    }
  },
  {
    key: "foundation",
    prompt: "Is it a Foundation Series?",
    type: "select",
    options: ["Yes — Foundation", "No — Not Foundation"],
    map: (v) => (v.startsWith("Yes") ? "Foundation" : "Non‑Foundation")
  },
  {
    key: "trim",
    prompt: "Which trim?",
    type: "select",
    options: ["AWD", "Cyberbeast"]
  },
  {
    key: "odometer",
    prompt: "What’s the current odometer (miles)?",
    type: "number",
    min: 0
  },
  {
    key: "titleStatus",
    prompt: "Title on hand or loan?",
    type: "select",
    options: ["Title on hand", "Loan"]
  },
  {
    key: "payoff",
    prompt: "Approximate payoff amount today (USD)?",
    type: "number",
    min: 0,
    when: () => data.titleStatus === "Loan"
  },
  {
    key: "zip",
    prompt: "What’s your ZIP code?",
    type: "text",
    placeholder: "e.g., 10001",
    validate: (v) => /^\d{5}(-\d{4})?$/.test(v.trim())
  },
  {
    key: "currentOffer",
    prompt: "Do you have any valid offers already? Paste the amount or details (optional).",
    type: "text",
    placeholder: "Optional",
    required: false
  },
  {
    key: "media",
    prompt: "Add images/video (local only; not uploaded). Exterior, interior, odometer, walk‑around video.",
    type: "file",
    accept: "image/*,video/*",
    multiple: true,
    required: false,
    onAnswer: (files) => previewMedia(files)
  },
  {
    key: "done",
    prompt: "Thanks! Review the summary on the right. You can copy or export it now. (This is a static demo.)",
    type: "end"
  }
];

function msgAgent(html) {
  const div = document.createElement("div");
  div.className = "msg agent";
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function msgUser(text) {
  const div = document.createElement("div");
  div.className = "msg user";
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
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
    // keep only names for export; store object URLs for preview
    data.media = [];
    for (const f of v) {
      data.media.push({ name: f.name, type: f.type, size: f.size });
    }
  } else if (s.key && s.key !== "done") {
    data[s.key] = (typeof val === "string") ? val.trim() : val;
  }

  if (s.onAnswer) s.onAnswer(v);
  refreshSummary();
}

function nextStep() {
  // advance to next step that passes 'when' predicate
  while (++step < steps.length) {
    const s = steps[step];
    if (s.when && !s.when()) continue;
    msgAgent(s.prompt);
    renderField(s);
    return;
  }
  // no more
  renderField({ type: "end" });
}

function previewMedia(fileList) {
  const containerId = "previewMedia";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.className = "preview-media";
    chat.appendChild(container);
  }
  container.innerHTML = "";
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
  chat.scrollTop = chat.scrollHeight;
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
  // mailto convenience (subject + body)
  const subject = encodeURIComponent("Sell My Cybertruck — Intake");
  const body = encodeURIComponent(lines.join("\n") + "\n\n(This came from the static demo.)");
  mailtoBtn.href = `mailto:offers@sellmycybertruck.com?subject=${subject}&body=${body}`;
}

function exportJSON() {
  const out = {
    ...data,
    // Do not include binary media; list names only in demo
    media: data.media
  };
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
  navigator.clipboard.writeText(txt).then(() => {
    msgAgent("Summary copied to clipboard.");
  }).catch(() => {
    msgAgent("Could not copy automatically. Select the text and copy.");
  });
}

// Lightweight keyword Q&A for "ask it questions" feel in any step
function keywordQA(text) {
  const t = text.toLowerCase();
  if (t.includes("how much") || t.includes("offer")) {
    return "We generate a cash offer after intake. If you have a valid current offer, include it so we can beat it when possible.";
  }
  if (t.includes("loan")) {
    return "Loans are fine. We'll need your approximate payoff today and later a lender payoff letter to finalize.";
  }
  if (t.includes("photo") || t.includes("image") || t.includes("video")) {
    return "Please upload exterior (all sides), interior, odometer, any damage, and a short walk‑around video.";
  }
  if (t.includes("foundation")) {
    return "Foundation Series is supported. We just need you to confirm Foundation vs Non‑Foundation.";
  }
  if (t.includes("vin")) {
    return "Your 17‑character VIN helps us verify trim and build. Paste it in the VIN step.";
  }
  return null;
}

// Events
startBtn.addEventListener("click", () => {
  if (step >= 0) return;
  msgAgent("Welcome! Let's get your Cybertruck details.");
  nextStep();
});

resetBtn.addEventListener("click", () => {
  step = -1;
  data = { createdAt: new Date().toISOString(), source: "sellmycybertruck-ai-intake-demo", vin: "", inferredTrim: "", foundation: "", trim: "", odometer: "", titleStatus: "", payoff: "", zip: "", currentOffer: "", media: [] };
  chat.innerHTML = "";
  dynamicField.innerHTML = "";
  summaryEl.innerHTML = "";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (step < 0 || step >= steps.length) return;

  const s = steps[step];
  const v = currentInputValue();

  // Allow Q&A style messages even when expecting an answer
  if (typeof v === "string") {
    const qa = keywordQA(v);
    if (qa && (!s.validate || !s.validate(v))) {
      msgUser(v);
      msgAgent(qa);
      return;
    }
  }

  if (!validateAnswer(s, v)) {
    msgAgent("Please provide a valid answer to continue.");
    return;
  }

  if (s.type !== "end") {
    msgUser(typeof v === "string" ? v : (s.type === "file" ? `${v.length} file(s)` : String(v)));
    setAnswer(s, v);
  }

  nextStep();
});

copyBtn.addEventListener("click", copySummary);
exportBtn.addEventListener("click", exportJSON);

// Initialize UI
refreshSummary();
