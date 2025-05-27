// dashboard.js using Supabase-compatible backend API

let currentUser = null;
const logContainer = document.getElementById('log-container');
const evidenceInput = document.getElementById('evidence');
const evidenceCounter = document.getElementById('evidence-counter');
const evidenceList = document.getElementById('evidence-list');
const addEvidenceBtn = document.getElementById('add-evidence');
const logoutBtn = document.getElementById('logout');
const actionForm = document.getElementById('action-form');
const banRequestForm = document.getElementById('ban-request-form');
const reviewContainer = document.getElementById('review-container');
const myRequestsContainer = document.getElementById('my-requests');

let evidenceLinks = [];

async function getUser() {
  const res = await fetch('/api/user');
  if (!res.ok) return (window.location.href = '/');
  const data = await res.json();
  currentUser = data;
  adjustUI();
  loadLogs();
  if (currentUser.level < 3) loadMyBanRequests();
  else loadAllBanRequests();
}

function adjustUI() {
  if (currentUser.level < 2) {
    document.getElementById('kick-btn').disabled = true;
  }
  if (currentUser.level < 3) {
    document.getElementById('ban-btn').disabled = true;
    reviewContainer.style.display = 'none';
  } else {
    banRequestForm.style.display = 'none';
    myRequestsContainer.style.display = 'none';
  }
}

addEvidenceBtn.addEventListener('click', () => {
  const link = evidenceInput.value.trim();
  if (link && evidenceLinks.length < 3) {
    evidenceLinks.push(link);
    const li = document.createElement('li');
    li.textContent = `${evidenceLinks.length}/3: ${link}`;
    evidenceList.appendChild(li);
    evidenceInput.value = '';
    evidenceCounter.textContent = `${evidenceLinks.length}/3`;
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout');
  window.location.href = '/';
});

actionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.querySelector('input[name="action"]:checked').value;
  const target = document.getElementById('target').value.trim();
  const reason = document.getElementById('reason').value.trim();
  const duration = type === 'Ban' ? document.getElementById('duration').value : null;

  if (!target || !reason || evidenceLinks.length !== 3) return alert('Fill all fields and include 3 evidence links');

  const res = await fetch('/api/submit-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, target, reason, duration, evidence: evidenceLinks }),
  });

  if (res.ok) {
    alert('Action submitted');
    evidenceLinks = [];
    evidenceList.innerHTML = '';
    evidenceCounter.textContent = '0/3';
    loadLogs();
  } else {
    alert('Failed to submit');
  }
});

async function loadLogs() {
  const res = await fetch('/api/logs');
  const logs = await res.json();
  logContainer.innerHTML = '';
  logs.forEach((log) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
      <strong>${log.type}</strong> on <strong>${log.target}</strong> by <em>${log.created_by}</em><br>
      Reason: ${log.reason}<br>
      Evidence: <ul>
        <li>${log.evidence1}</li>
        <li>${log.evidence2}</li>
        <li>${log.evidence3}</li>
      </ul>
      ${log.duration ? 'Duration: ' + log.duration + '<br>' : ''}
      <button onclick="deleteLog(${log.id})">Delete</button>
      <hr>`;
    logContainer.appendChild(div);
  });
}

async function deleteLog(id) {
  if (!confirm('Delete this log?')) return;
  const res = await fetch('/api/delete-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (res.ok) loadLogs();
  else alert('Failed to delete');
}

// -------- BAN REQUESTS (1–2) --------
banRequestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const target = document.getElementById('req-target').value.trim();
  const reason = document.getElementById('req-reason').value.trim();
  const duration = document.getElementById('req-duration').value;
  const evidence = [
    document.getElementById('req-evidence1').value,
    document.getElementById('req-evidence2').value,
    document.getElementById('req-evidence3').value,
  ];
  if (!target || !reason || evidence.some(e => !e)) return alert('Fill all fields');

  const res = await fetch('/api/ban-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, reason, duration, evidence }),
  });

  if (res.ok) {
    alert('Request submitted');
    loadMyBanRequests();
  } else {
    alert('Failed to submit');
  }
});

async function loadMyBanRequests() {
  const res = await fetch('/api/my-ban-requests');
  const data = await res.json();
  const container = document.getElementById('my-requests');
  container.innerHTML = '<h3>My Requests</h3>';
  data.forEach(req => {
    container.innerHTML += `
      <div>
        <strong>${req.target}</strong> (${req.duration}) — ${req.status}
        <br>Reason: ${req.reason}<br>
        Evidence: <ul><li>${req.evidence1}</li><li>${req.evidence2}</li><li>${req.evidence3}</li></ul>
        <hr>
      </div>
    `;
  });
}

// -------- REVIEW PANEL (3) --------
async function loadAllBanRequests() {
  const res = await fetch('/api/ban-requests');
  const data = await res.json();
  const container = document.getElementById('review-container');
  container.innerHTML = '<h3>Review Ban Requests</h3>';
  data.forEach(req => {
    if (req.status !== 'Pending') return;
    container.innerHTML += `
      <div>
        <strong>${req.target}</strong> (${req.duration}) — Requested by ${req.requested_by}<br>
        Reason: ${req.reason}<br>
        Evidence: <ul><li>${req.evidence1}</li><li>${req.evidence2}</li><li>${req.evidence3}</li></ul>
        <button onclick="reviewBan(${req.id}, 'Approved')">Approve</button>
        <button onclick="reviewBan(${req.id}, 'Denied')">Deny</button>
        <hr>
      </div>
    `;
  });
}

async function reviewBan(id, status) {
  const res = await fetch('/api/update-ban-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (res.ok) loadAllBanRequests();
  else alert('Failed to update request');
}

getUser();
