/* Universal AI Conductor - front end. Talks to the local Python server only. */
const $ = (s) => document.querySelector(s);
let STATE = null;
let MEM = null;
let PROMPT = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // sandboxed iframe fallback: execCommand on a temp textarea
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ------------------------------------------------------------------ render */
function render() {
  const s = STATE;
  if (!s) return;

  const nSeats = s.seats.length;
  $("#seatCount").textContent = `${nSeats}/10`;
  $("#stats").innerHTML = [
    ["memories", s.memory_stats.active_memories],
    ["entities", s.memory_stats.entities],
    ["turns", s.memory_stats.turns],
    ["seats", nSeats],
  ].map(([k, v]) => `<div class="stat">${k} <b>${v}</b></div>`).join("");

  $("#episodePill").textContent = s.episode
    ? `${s.episode.title} · ${s.steps.filter((x) => x.status === "done").length}/${s.steps.length}`
    : "no session";

  renderSeats(s);
  renderPlanChips();
  renderStepStrip(s);
  renderNext(s);
  renderTranscript(s);
  renderCaptureSelect(s);
  if (MEM) renderMemory(MEM);
}

function renderSeats(s) {
  const list = $("#seatList");
  list.innerHTML = "";
  s.seats.forEach((seat) => {
    const el = document.createElement("div");
    el.className = "seat" + (s.next && s.next.seat_id === seat.id ? " speaking" : "");
    const local = seat.kind !== "bridge";
    el.innerHTML = `
      <div class="seat-top">
        <span class="seat-num">${seat.id}</span>
        <span class="seat-name">${esc(seat.name)}</span>
        <span class="kindtag ${local ? "local" : ""}">${local ? "local" : "bridge"}</span>
      </div>
      <div class="seat-fields">
        <input data-f="name" value="${esc(seat.name)}" placeholder="seat name" />
        <select data-f="kind">
          <option value="bridge" ${seat.kind === "bridge" ? "selected" : ""}>bridge (paste into web UI)</option>
          <option value="ollama" ${seat.kind === "ollama" ? "selected" : ""}>ollama (local)</option>
          <option value="openai_compatible" ${seat.kind === "openai_compatible" ? "selected" : ""}>lmstudio / llama.cpp</option>
        </select>
        ${local ? `<input data-f="endpoint" value="${esc(seat.endpoint || "")}" placeholder="http://localhost:11434" />
        <input data-f="model" value="${esc(seat.model || "")}" placeholder="model name e.g. llama3.2" />` : ""}
        <input data-f="persona" value="${esc(seat.persona || "")}" placeholder="brief for this seat (optional)" />
      </div>
      <div class="seat-actions">
        <button data-act="use">Use next</button>
        <button data-act="remove">Remove</button>
      </div>`;
    el.querySelectorAll("[data-f]").forEach((inp) => {
      inp.addEventListener("change", () => saveSeat(seat.id, { [inp.dataset.f]: inp.value }));
    });
    el.querySelector('[data-act="use"]').addEventListener("click", () => {
      $("#planInput").value = ($("#planInput").value ? $("#planInput").value + ", " : "") + seat.id;
      renderPlanChips();
    });
    el.querySelector('[data-act="remove"]').addEventListener("click", () =>
      api(`/api/seats/${seat.id}/delete`, { method: "POST", body: {} })
        .then((r) => { STATE = r; render(); toast(`Seat ${seat.id} removed — its memory stays.`); })
        .catch((e) => toast(e.message))
    );
    list.appendChild(el);
  });
  $("#btnAddSeat").disabled = s.seats.length >= 10;
}

function renderStepStrip(s) {
  const wrap = $("#stepStrip");
  wrap.innerHTML = "";
  if (!s.steps.length) return;
  s.steps.forEach((st) => {
    const el = document.createElement("div");
    el.className = "step" + (st.status === "done" ? " done" : "") + (s.cursor === st.idx ? " current" : "");
    el.innerHTML = `
      <div class="step-idx"><span>step ${st.idx + 1}</span><b>seat ${st.seat_id}</b></div>
      <div class="seatpick">${esc(st.seat_name)}</div>
      <select data-f="mode">
        ${s.modes.map((m) => `<option value="${m.key}" ${m.key === st.mode ? "selected" : ""}>${esc(m.label)}</option>`).join("")}
      </select>`;
    el.querySelector('[data-f="mode"]').addEventListener("change", async (e) => {
      STATE = await api("/api/plan/step", { method: "POST", body: { idx: st.idx, mode: e.target.value } });
      render();
      await refreshPrompt();
      toast(`Step ${st.idx + 1} is now ${e.target.value}.`);
    });
    wrap.appendChild(el);
  });
}

function renderNext(s) {
  const n = s.next;
  const box = $("#promptBox");
  if (!n) {
    $("#stepTitle").textContent = s.steps.length ? "Plan complete" : "No active step";
    $("#stepSub").textContent = s.steps.length
      ? "All steps done. Rewind the plan or start a new one."
      : "Type a speaking order above and hit Start.";
    box.value = "";
    $("#memUsed").textContent = "";
    $("#btnCopyPrompt").disabled = true;
    $("#btnRunHere").disabled = true;
    return;
  }
  $("#stepTitle").textContent = `Step ${n.step_no}/${n.step_total} → Seat ${n.seat_id} (${n.seat_name})`;
  $("#stepSub").textContent = `${n.mode_label} · ${n.seat_kind === "bridge" ? "bridge seat: copy the prompt into that app" : "local seat: can run directly"}`;
  $("#btnCopyPrompt").disabled = false;
  $("#btnRunHere").disabled = n.seat_kind === "bridge";
  $("#btnRunHere").textContent = n.seat_kind === "bridge" ? "Run here" : "Run on " + n.seat_name;
}

function renderTranscript(s) {
  const wrap = $("#transcript");
  wrap.innerHTML = "";
  $("#turnCount").textContent = `${s.turns.length} turns`;
  if (!s.turns.length) {
    wrap.innerHTML = `<div class="hint">Nothing captured yet.</div>`;
    return;
  }
  s.turns.forEach((t) => {
    const el = document.createElement("div");
    el.className = "turn" + (t.role === "user" ? " user" : "");
    el.innerHTML = `
      <div class="turn-meta">
        <span class="who">${t.role === "user" ? "YOU" : `Seat ${t.seat_id} · ${esc(t.seat_name || "")}`}</span>
        <span>${esc(t.mode || "")}</span>
        <span>#${t.id}</span>
      </div>
      <div class="turn-body">${esc(t.content)}</div>`;
    wrap.appendChild(el);
  });
  wrap.scrollTop = wrap.scrollHeight;
}

function renderCaptureSelect(s) {
  const sel = $("#captureSeat");
  const prev = sel.value;
  sel.innerHTML = s.seats.map((x) => `<option value="${x.id}">Seat ${x.id} · ${esc(x.name)}</option>`).join("");
  if (s.next) sel.value = String(s.next.seat_id);
  else if (prev) sel.value = prev;
}

function renderMemory(m) {
  $("#memStats").textContent = `${m.stats.active_memories} active / ${m.stats.memories}`;
  const list = $("#memList");
  list.innerHTML = "";
  if (!m.memories.length) {
    list.innerHTML = `<div class="hint">Memory is empty. Capture a reply or teach it something.</div>`;
  }
  m.memories.forEach((row) => {
    const el = document.createElement("div");
    el.className = "mem" + (row.pinned ? " pinned" : "") + (row.valid_to ? " retired" : "");
    el.innerHTML = `
      <div class="mem-top">
        <span class="mem-kind">${esc(row.kind)}</span>
        <span>sal ${Number(row.salience).toFixed(2)}</span>
        ${row.valid_to ? "<span>retired</span>" : ""}
        <span class="mem-btns">
          <button data-act="pin">${row.pinned ? "unpin" : "pin"}</button>
          <button data-act="del">x</button>
        </span>
      </div>
      <div class="mem-text">${esc(row.text)}</div>`;
    el.querySelector('[data-act="pin"]').addEventListener("click", async () => {
      await api(`/api/memory/${row.id}/pin`, { method: "POST", body: { pinned: !row.pinned } });
      loadMemory($("#memSearch").value);
    });
    el.querySelector('[data-act="del"]').addEventListener("click", async () => {
      await api(`/api/memory/${row.id}/delete`, { method: "POST", body: {} });
      loadMemory($("#memSearch").value);
    });
    list.appendChild(el);
  });

  $("#entityList").innerHTML = m.entities.length
    ? m.entities.map((e) => `<span class="ent">${esc(e.display)} <span>×${e.mentions}</span></span>`).join("")
    : `<span class="hint">no entities yet</span>`;
}

/* --------------------------------------------------------- plan preview */
let _chipTimer = null, _chipSeq = 0;
function renderPlanChips() {
  // The server is the single source of truth for parsing, so the preview can never disagree with it.
  clearTimeout(_chipTimer);
  _chipTimer = setTimeout(async () => {
    const seq = ++_chipSeq;
    const text = $("#planInput").value;
    const el = $("#planPreview");
    if (!text.trim()) {
      el.innerHTML = `<span class="hint">Seat numbers or names become the speaking order. A mode phrase ("against each other", "running a relay") labels the group of seats just before it.</span>`;
      return;
    }
    try {
      const r = await api("/api/plan/preview", { method: "POST", body: { text } });
      if (seq !== _chipSeq) return;
      let html = r.steps.map((c) =>
        `<span class="chip"><span class="n">${esc(c.seat_id)}</span><span class="m">${esc(c.mode)}</span></span>`).join("");
      if (r.unknown.length) html += `<span class="hint">no such seat: ${esc(r.unknown.join(", "))}</span>`;
      el.innerHTML = html || `<span class="hint">No seats recognised yet.</span>`;
    } catch (e) { /* preview is best-effort */ }
  }, 150);
}

/* ----------------------------------------------------------------- actions */
async function saveSeat(id, fields) {
  STATE = await api("/api/seats", { method: "POST", body: { id, ...fields } });
  render();
}

async function loadMemory(q = "") {
  MEM = await api(`/api/memory?q=${encodeURIComponent(q)}`);
  renderMemory(MEM);
  if (STATE) STATE.memory_stats = MEM.stats;
}

async function refreshPrompt() {
  try {
    PROMPT = await api("/api/prompt/preview", { method: "POST", body: { note: $("#noteInput").value } });
    $("#promptBox").value = PROMPT.prompt;
    $("#memUsed").innerHTML = PROMPT.memories_used.length
      ? `<b>${PROMPT.memories_used.length} memories injected:</b><br>` +
        PROMPT.memories_used.map((t) => "· " + esc(t.slice(0, 90))).join("<br>")
      : "no memories matched yet";
  } catch (e) {
    $("#promptBox").value = "";
    $("#memUsed").textContent = "";
    PROMPT = null;
  }
}

async function boot() {
  STATE = await api("/api/state");
  render();
  await loadMemory();
  await refreshPrompt();
}

/* ------------------------------------------------------------------ events */
$("#planInput").addEventListener("input", renderPlanChips);

$("#btnStartPlan").addEventListener("click", async () => {
  try {
    const r = await api("/api/plan", {
      method: "POST",
      body: {
        text: $("#planInput").value,
        title: $("#titleInput").value,
        note: $("#noteInput").value,
      },
    });
    STATE = r.state;
    render();
    await refreshPrompt();
    toast(`Plan started: ${r.steps} steps.`);
  } catch (e) { toast(e.message); }
});

$("#btnCopyPrompt").addEventListener("click", async () => {
  await refreshPrompt();
  const txt = $("#promptBox").value;
  if (!txt) return toast("Nothing to copy — start a plan first.");
  const ok = await copyText(txt);
  toast(ok ? `Copied for Seat ${STATE.next.seat_id} (${STATE.next.seat_name}). Paste it there now.`
           : "Copy blocked by the browser — select the prompt box and copy manually.");
});

$("#btnRunHere").addEventListener("click", async () => {
  try {
    toast("Running locally…", 1200);
    const r = await api("/api/run", { method: "POST", body: { note: $("#noteInput").value } });
    STATE = r.state;
    render();
    await loadMemory();
    await refreshPrompt();
    toast(`Local seat replied. +${r.memories_added} memories.`);
  } catch (e) { toast(e.message, 5000); }
});

$("#btnCapture").addEventListener("click", async () => {
  const text = $("#captureBox").value.trim();
  if (!text) return toast("Paste the AI's reply first.");
  try {
    const r = await api("/api/capture", {
      method: "POST",
      body: { text, seat_id: parseInt($("#captureSeat").value, 10), mode: STATE.next ? STATE.next.mode : "" },
    });
    $("#captureBox").value = "";
    STATE = r.state;
    render();
    await loadMemory();
    await refreshPrompt();
    if (STATE.next) {
      const ok = await copyText($("#promptBox").value);
      toast(`Captured. +${r.memories_added} memories. Next: Seat ${STATE.next.seat_id} (${STATE.next.seat_name}) — ${ok ? "prompt copied" : "prompt ready, copy it"}.`, 4000);
    } else {
      toast(`Captured. +${r.memories_added} memories. Plan complete.`, 4000);
    }
  } catch (e) { toast(e.message, 5000); }
});

$("#btnPaste").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    $("#captureBox").value = t;
    toast("Pasted from clipboard.");
  } catch (e) {
    toast("Browser blocked clipboard read — click the box and press Ctrl/Cmd+V.");
  }
});

$("#btnAddSeat").addEventListener("click", async () => {
  try {
    STATE = await api("/api/seats", { method: "POST", body: { name: "New seat" } });
    render();
  } catch (e) { toast(e.message); }
});

$("#btnRewind").addEventListener("click", async () => {
  STATE = await api("/api/plan/rewind", { method: "POST", body: {} });
  render();
  await refreshPrompt();
  toast("Plan rewound — every step is pending again.");
});

$("#btnExport").addEventListener("click", async () => {
  const data = await api("/api/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `conductor-memory-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast("Exported. That file is your memory — keep it.");
});

$("#btnMemSearch").addEventListener("click", () => loadMemory($("#memSearch").value));
$("#memSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") loadMemory($("#memSearch").value); });
$("#btnMemAdd").addEventListener("click", async () => {
  const text = $("#memAddInput").value.trim();
  if (!text) return;
  await api("/api/memory/add", { method: "POST", body: { text, kind: "directive", pinned: true } });
  $("#memAddInput").value = "";
  await loadMemory($("#memSearch").value);
  await refreshPrompt();
  toast("Pinned to memory.");
});

$("#noteInput").addEventListener("change", refreshPrompt);

/* keyboard: ctrl+shift+C copy prompt, ctrl+shift+V capture */
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); $("#btnCopyPrompt").click(); }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") { e.preventDefault(); $("#btnCapture").click(); }
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

boot().catch((e) => toast("Server not reachable: " + e.message, 8000));
