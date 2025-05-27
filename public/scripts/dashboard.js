// dashboard.js using Supabase-compatible backend API

let currentUser = null;
const logContainer = document.getElementById('log-container');
const evidenceInput = document.getElementById('evidence');
const evidenceCounter = document.getElementById('evidence-counter');
const evidenceList = document.getElementById('evidence-list');
const addEvidenceBtn = document.getElementById('add-evidence');
const logoutBtn = document.getElementById('logout');
const actionForm = document.getElementById('action-form');
const reviewContainer = document.getElementById('review-ban-requests-section');
const myRequestsContainer = document.getElementById('my-ban-requests-section');
const banRequestForm = document.getElementById('ban-request-form');

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
  const level = currentUser.level;

  if (level < 2) {
    document.getElementById('kick-btn').disabled = true;
  }
  if (level < 3) {
    document.getElementById('ban-btn').disabled = true;
    reviewContainer.style.display = 'none';
    document.getElementById('my-ban-requests-section').classList.remove('hidden');
    loadMyRequests();
  } else {
    banRequestForm.style.display = 'none';
    myRequestsContainer.style.display = 'none';
    document.getElementById('review-ban-requests-section').classList.remove('hidden');
    loadReviewRequests();
  }
}
const banRequestFormElement = document.getElementById('ban-request-form-element');
const banEvidenceInput = document.getElementById('ban-evidence-input');
const banAddEvidenceBtn = document.getElementById('ban-add-evidence');
const banEvidenceCounter = document.getElementById('ban-evidence-counter');
const banEvidenceList = document.getElementById('ban-evidence-list');

let banEvidenceLinks = [];

banAddEvidenceBtn.addEventListener('click', () => {
  const link = banEvidenceInput.value.trim();
  if (link && banEvidenceLinks.length < 3) {
    banEvidenceLinks.push(link);
    const li = document.createElement('li');
    li.textContent = `${banEvidenceLinks.length}/3: ${link}`;
    banEvidenceList.appendChild(li);
    banEvidenceInput.value = '';
    banEvidenceCounter.textContent = `${banEvidenceLinks.length}/3`;
  }
});

banRequestFormElement.addEventListener('submit', async (e) => {
  e.preventDefault();
  const target = document.getElementById('ban-target').value.trim();
  const reason = document.getElementById('ban-reason').value.trim();
  const duration = document.getElementById('ban-duration').value;

  if (!target || !reason || banEvidenceLinks.length !== 3) return alert('Please fill out all fields and add 3 evidence links.');

  const res = await fetch('/api/submit-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'Ban',
      target,
      reason,
      duration,
      evidence: banEvidenceLinks
    })
  });

  if (res.ok) {
    alert('Ban request submitted!');
    banEvidenceLinks = [];
    banEvidenceList.innerHTML = '';
    banEvidenceCounter.textContent = '0/3';
    banRequestFormElement.reset();
    loadMyRequests();
  } else {
    alert('Failed to submit ban request.');
  }
});


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
if (!res.ok) {
  const errorText = await res.text(); // not JSON!
  throw new Error(errorText);
}
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

async function loadReviewRequests() {
  const res = await fetch('/api/ban-requests');
  const data = await res.json();
  const table = document.getElementById('review-requests-table');
  table.innerHTML = '';

  data.forEach(req => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border px-2 py-1">${req.target}</td>
      <td class="border px-2 py-1">${req.reason}</td>
      <td class="border px-2 py-1">${req.duration}</td>
      <td class="border px-2 py-1 text-blue-600">
        <a href="${req.evidence1}" target="_blank">1</a> |
        <a href="${req.evidence2}" target="_blank">2</a> |
        <a href="${req.evidence3}" target="_blank">3</a>
      </td>
      <td class="border px-2 py-1">${req.status}</td>
      <td class="border px-2 py-1">
        ${req.status === 'Pending' ? `
          <button onclick="approveRequest('${req.id}')" class="text-green-600 font-bold">✅</button>
          <button onclick="denyRequest('${req.id}')" class="text-red-600 font-bold">❌</button>
        ` : ''}
      </td>
    `;
    table.appendChild(row);
  });
}

async function loadMyRequests() {
  const res = await fetch('/api/my-ban-requests');
  const data = await res.json();
  const table = document.getElementById('my-requests-table');
  table.innerHTML = '';

  data.forEach(req => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border px-2 py-1">${req.target}</td>
      <td class="border px-2 py-1">${req.reason}</td>
      <td class="border px-2 py-1">${req.duration}</td>
      <td class="border px-2 py-1 text-blue-600">
        <a href="${req.evidence1}" target="_blank">1</a> |
        <a href="${req.evidence2}" target="_blank">2</a> |
        <a href="${req.evidence3}" target="_blank">3</a>
      </td>
      <td class="border px-2 py-1">${req.status}</td>
    `;
    table.appendChild(row);
  });
}

async function approveRequest(id) {
  await fetch('/api/ban-request/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  loadReviewRequests(); // refresh
}

async function denyRequest(id) {
  await fetch('/api/ban-request/deny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  loadReviewRequests(); // refresh
}

getUser();
