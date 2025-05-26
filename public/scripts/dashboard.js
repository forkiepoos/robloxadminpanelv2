// public/scripts/dashboard.js

let permission = 0;
let evidenceLinks = [];
const evidenceCounter = document.getElementById("evidence-counter");
const evidenceInput = document.getElementById("evidence-input");
const evidenceAddBtn = document.getElementById("evidence-add");
const evidenceList = document.getElementById("evidence-list");

window.onload = async () => {
  await fetchPermission();
  setupEvidence();
  loadLogs();
  if (permission < 3) loadMyBanRequests();
  else loadBanReviews();
};

async function fetchPermission() {
  const res = await fetch("/api/logs");
  if (res.status === 401) return (window.location.href = "/");
  const logs = await res.json();
  document.getElementById("log-container").innerHTML = logs
    .map(
      (log) => `
      <div class="bg-white shadow-md rounded p-4 mb-2">
        <strong>${log[0]}</strong> ${log[2]}ed <strong>${log[1]}</strong><br/>
        Reason: ${log[3]}<br/>
        Duration: ${log[5] || "-"}<br/>
        Timestamp: ${log[6]}<br/>
        <button onclick="deleteLog(${log.id})" class="text-red-500">Delete</button>
      </div>
    `
    )
    .join("");
}

function setupEvidence() {
  evidenceAddBtn.addEventListener("click", () => {
    if (evidenceLinks.length >= 3) return;
    if (evidenceInput.value.trim()) {
      evidenceLinks.push(evidenceInput.value.trim());
      evidenceInput.value = "";
      evidenceCounter.textContent = `${evidenceLinks.length}/3`;
      const li = document.createElement("li");
      li.textContent = evidenceLinks[evidenceLinks.length - 1];
      evidenceList.appendChild(li);
    }
  });
}

async function submitAction() {
  const action = document.getElementById("action-type").value;
  const target = document.getElementById("target").value;
  const reason = document.getElementById("reason").value;
  const duration = document.getElementById("duration").value;

  if (evidenceLinks.length !== 3) return alert("You must provide exactly 3 evidence links.");
  const body = {
    type: action,
    reason,
    target,
    evidence: evidenceLinks,
    duration: action === "Ban" ? duration : "",
  };

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (result.success) {
    alert("Action submitted");
    location.reload();
  } else {
    alert("Submission failed");
  }
}

async function deleteLog(id) {
  await fetch("/api/delete-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowId: id }),
  });
  location.reload();
}

async function submitBanRequest() {
  const target = document.getElementById("br-target").value;
  const reason = document.getElementById("br-reason").value;
  const duration = document.getElementById("br-duration").value;
  if (evidenceLinks.length !== 3) return alert("Exactly 3 evidence links required");

  const res = await fetch("/api/submit-ban-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, reason, evidence: evidenceLinks, duration }),
  });
  const result = await res.json();
  if (result.success) {
    alert("Request submitted");
    location.reload();
  }
}

async function loadMyBanRequests() {
  const res = await fetch("/api/my-ban-requests");
  const data = await res.json();
  document.getElementById("my-ban-requests").innerHTML = data
    .map(
      (r) => `
      <div class="p-2 border rounded mb-2">
        Target: ${r.target}<br/>
        Reason: ${r.reason}<br/>
        Duration: ${r.duration}<br/>
        Status: ${r.status}
      </div>
    `
    )
    .join("");
}

async function loadBanReviews() {
  const res = await fetch("/api/get-ban-requests");
  const data = await res.json();
  document.getElementById("review-ban-requests").innerHTML = data
    .map(
      (r) => `
      <div class="p-2 border rounded mb-2">
        <strong>${r.username}</strong> requested ban on <strong>${r.target}</strong><br/>
        Reason: ${r.reason}<br/>
        Duration: ${r.duration}<br/>
        <button onclick="reviewBan(${r.id}, 'Approved')">Approve</button>
        <button onclick="reviewBan(${r.id}, 'Denied')">Deny</button>
      </div>
    `
    )
    .join("");
}

async function reviewBan(id, action) {
  const res = await fetch("/api/update-ban-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowId: id, action }),
  });
  const result = await res.json();
  if (result.success) {
    alert("Updated");
    loadBanReviews();
  }
}
