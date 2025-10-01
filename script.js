// Grayscale collapsible intake + Blob upload + mailto summary
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const qaLog = document.getElementById("qaLog");
const form = document.getElementById("chatForm");
const dynamicField = document.getElementById("dynamicField");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const emailBtn = document.getElementById("emailBtn");
const summaryEl = document.getElementById("summary");

let step = -1;
let openDetails = null;

let data = {
  createdAt: new Date().toISOString(),
  source: "sellmycybertruck-ai-intake-demo",
  vin: "",
  foundation: "",
  trim: "",
  odometer: "",
  titleStatus: "",
  payoff: "",
  zip: "",
  currentOffer: "",
  contact: { name: "", email: "", mobile: "" },
  appScreenFiles: [],       // File objects (local) until upload
  softwareScreenFiles: [],  // File objects (local) until upload
  appScreenUrls: [],        // Blob URLs after upload
  softwareScreenUrls: []    // Blob URLs after upload
};

// ----- FLOw: start with VIN, contact later -----
const steps = [
  // Vehicle first
  { key: "vin", prompt: "VIN (17 characters)", type: "text",
    placeholder: "7G2CEHED8RA004637",
    validate: v => v && v.replace(/\s/g,"").length >= 11
  },
  { key: "foundation", prompt: "Is it a Foundation Series?", type: "select",
    options: ["Yes — Foundation", "No — Not Foundation"],
    map: v => v.startsWith("Yes") ? "Foundation" : "Non-Foundation"
  },
  { key: "trim", prompt: "Which trim?", type: "select", options: ["AWD", "Cyberbeast"] },
  { key: "odometer", prompt: "Current odometer (miles)", type: "number", min: 0 },
  { key: "titleStatus", prompt: "Title on hand or loan?", type: "select", options: ["Title on hand", "Loan"] },
  { key: "payoff", prompt: "Approximate payoff amount today (USD)", type: "number", min: 0, when: () => data.titleStatus === "Loan" },
  { key: "zip", prompt: "ZIP code", type: "text", placeholder: "10001", validate: v => /^\d{5}(-\d{4})?$/.test(v.trim()) },
  { key: "currentOffer", prompt: "Any current valid offers? (optional)", type: "text", placeholder: "Optional", required: false },

  // Contact after the car details
  { key: "contact.name", prompt: "Your full name", type: "text", placeholder: "Jane Doe" },
  { key: "contact.email", prompt: "Your email", type: "text", placeholder: "you@example.com", validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
  { key: "contact.mobile", prompt: "Your mobile number", type: "text", placeholder: "(555) 123-4567", validate: v => v.replace(/\D/g,'').length >= 10 },

  // Required images: app + software screens
  { key: "appScreenFiles", prompt: "Upload APP screen image(s) (local preview; uploaded on Send)", type: "file", accept: "image/*", multiple: true, onAnswer: files => previewLocal(files) },
  { key: "softwareScreenFiles", prompt: "Upload SOFTWARE screen image(s) (local preview; uploaded on Send)", type: "file", accept: "image/*", multiple: true, onAnswer: files => previewLocal(files) },

  { key: "done", prompt: "All set. Review the summary, then click ‘Send to Email’.", type: "end" }
];

// ---------- Greeting + auto-start ----------
function addSystemGreeting() {
  // simple inline-styled banner so no CSS change is required
  const box = document.createElement("div");
  box.style.border = "1px solid #2a2d31";
  box.style.background = "#0f1012";
  box.style.borderRadius = "12px";
  box.style.padding = "14px";
  box.style.marginBottom = "10px";
  box.innerHTML = `<div style="font-weight:600;">Hello! 👋 Ready to begin?</div>
                   <div style="color:#9aa0a6;margin-top:4px;">Let’s start with your VIN.</div>`;
  qaLog.prepend(box);
}

function greetAndStart() {
  startBtn?.classList.add("hidden"); // hide start if present
  addSystemGreeting();
  if (step < 0) nextStep();           // open first step (VIN)
  setTimeout(() => dynamicField.querySelector("input,select")?.focus(), 0);
}

// ---------- UI helpers ----------
function addQAItem(s) {
  const details = document.createElement("details");
  details.className = "qa-item";
  details.open = true;

  const summary = document.createElement("summary");
  const icon = document.createElement("div");
  icon.className = "qa-icon"; icon.textContent = "👤";
  const label = document.createElement("div");
  label.className = "qa-question"; label.textContent = s.prompt;
  summary.appendChild(icon); summary.appendChild(label);
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "qa-answer";
  const live = document.createElement("div");
  live.id = "liveField"; body.appendChild(live);
  const ans = document.createElement("div");
  ans.className = "answer-text"; ans.style.display = "none"; body.appendChild(ans);

  details.appendChild(body);
  qaLog.appendChild(details);

  if (openDetails) openDetails.open = false;
  openDetails = details;

  renderField(s);
  const mirrored = dynamicField.firstElementChild ? dynamicField.firstElementChild.cloneNode(true) : null;
  if (mirrored) { mirrored.disabled = false; live.appendChild(mirrored); }

  return { ans };
}

function renderField(s) {
  dynamicField.innerHTML = "";
  if (s.type === "text") {
    const input = mk("input", { className: "input", type: "text", placeholder: s.placeholder || "", autocomplete: "off" });
    dynamicField.appendChild(input); input.focus();
  } else if (s.type === "number") {
    const input = mk("input", { className: "number", type: "number", placeholder: s.placeholder || "" });
    if (typeof s.min === "number") input.min = s.min;
    dynamicField.appendChild(input); input.focus();
  } else if (s.type === "select") {
    const sel = mk("select", { className: "select" });
    for (const opt of s.options) sel.appendChild(mk("option", { value: opt }, opt));
    dynamicField.appendChild(sel); sel.focus();
  } else if (s.type === "file") {
    const label = mk("label", { className: "small" }, "Files are kept local until you click ‘Send to Email’. Then they upload to Blob.");
    const file = mk("input", { className: "file", type: "file" });
    if (s.accept) file.accept = s.accept;
    if (s.multiple) file.multiple = true;
    dynamicField.appendChild(label); dynamicField.appendChild(file);
  } else if (s.type === "end") {
    dynamicField.appendChild(mk("span", { className: "muted" }, "You're all set."));
  }
}

function mk(tag, props = {}, text = "") {
  const el = document.createElement(tag);
  Object.assign(el, props);
  if (text) el.textContent = text;
  return el;
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
  if (s.type === "file") return true;
  if (s.validate) return s.validate(v);
  return v !== "" && v != null;
}

function setAnswer(s, v) {
  let val = v;
  if (s.map) val = s.map(v);
  if (s.type === "number") val = String(v).trim();
  if (s.type === "file") {
    const arr = [];
    for (const f of v) arr.push(f);
    if (s.key === "appScreenFiles") data.appScreenFiles = arr;
    if (s.key === "softwareScreenFiles") data.softwareScreenFiles = arr;
  } else if (s.key && s.key !== "done") {
    if (s.key.startsWith("contact.")) {
      const sub = s.key.split(".")[1];
      data.contact[sub] = (typeof val === "string") ? val.trim() : val;
    } else {
      data[s.key] = (typeof val === "string") ? val.trim() : val;
    }
  }
  refreshSummary();
}

function nextStep() {
  while (++step < steps.length) {
    const s = steps[step];
    if (s.when && !s.when()) continue;
    const ctx = addQAItem(s);
    s._ansNode = ctx.ans;
    return;
  }
  renderField({ type: "end" });
}

function previewLocal(fileList) {
  const live = openDetails?.querySelector("#liveField");
  const container = mk("div", { className: "preview-media" });
  [...fileList].forEach(f => {
    const url = URL.createObjectURL(f);
    const img = mk("img"); img.src = url; container.appendChild(img);
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
    `Name: ${data.contact.name || "—"}`,
    `Email: ${data.contact.email || "—"}`,
    `Mobile: ${data.contact.mobile || "—"}`,
    `App screen files: ${data.appScreenFiles.length}`,
    `Software screen files: ${data.softwareScreenFiles.length}`,
    data.appScreenUrls.length ? `App Blob URLs:\n${data.appScreenUrls.join("\n")}` : null,
    data.softwareScreenUrls.length ? `Software Blob URLs:\n${data.softwareScreenUrls.join("\n")}` : null
  ].filter(Boolean);

  summaryEl.innerHTML = "<pre><code>" + lines.join("\n") + "</code></pre>";
}

async function getUploadURL(file) {
  const r = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, filename: file.name })
  });
  if (!r.ok) throw new Error('upload-url failed');
  return r.json(); // { url, id }
}

async function uploadToBlob(files) {
  const urls = [];
  for (const f of files) {
    const { url } = await getUploadURL(f);
    await fetch(url, { method: 'PUT', body: f });
    const publicUrl = url.split('?')[0]; // blob public URL
    urls.push(publicUrl);
  }
  return urls;
}

async function sendEmail() {
  // upload images first (if not already uploaded)
  if (data.appScreenFiles.length) {
    data.appScreenUrls = await uploadToBlob(data.appScreenFiles);
  }
  if (data.softwareScreenFiles.length) {
    data.softwareScreenUrls = await uploadToBlob(data.softwareScreenFiles);
  }
  refreshSummary();

  const lines = summaryEl.innerText;
  const subject = encodeURIComponent("New Cybertruck Intake");
  const body = encodeURIComponent(lines + "\n\n(Generated via intake demo)");
  const to = "contact@onlyev.com";
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

// Events
startBtn?.addEventListener("click", () => { if (step < 0) greetAndStart(); });
resetBtn?.addEventListener("click", () => {
  step = -1; openDetails = null;
  data = { createdAt: new Date().toISOString(), source: "sellmycybertruck-ai-intake-demo",
    vin:"", foundation:"", trim:"", odometer:"", titleStatus:"", payoff:"", zip:"",
    currentOffer:"", contact:{name:"",email:"",mobile:""},
    appScreenFiles:[], softwareScreenFiles:[], appScreenUrls:[], softwareScreenUrls:[]
  };
  qaLog.innerHTML = ""; dynamicField.innerHTML = ""; summaryEl.innerHTML = "";
  greetAndStart();
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (step < 0 || step >= steps.length) return;

  const s = steps[step];
  const v = currentInputValue();

  if (!validateAnswer(s, v)) {
    alert("Please provide a valid answer to continue.");
    return;
  }

  if (s.type !== "end") {
    setAnswer(s, v);
    if (s._ansNode) {
      s._ansNode.style.display = "block";
      s._ansNode.textContent = (s.type === "file") ? `${v.length} file(s)` : String(v);
    }
  }

  nextStep();
});
copyBtn?.addEventListener("click", () => {
  const txt = summaryEl.innerText;
  navigator.clipboard.writeText(txt).catch(()=>{});
});
exportBtn?.addEventListener("click", () => {
  const out = { ...data, appScreenFiles: undefined, softwareScreenFiles: undefined };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url; a.download = `cybertruck-intake-${ts}.json`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
emailBtn?.addEventListener("click", () => { sendEmail().catch(err => alert(err.message || "Upload failed")); });

// Init
refreshSummary();
document.addEventListener("DOMContentLoaded", greetAndStart);

