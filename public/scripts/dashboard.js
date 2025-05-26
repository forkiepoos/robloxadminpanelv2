// public/scripts/dashboard.js

let permissionLevel = 0;
let evidenceCount = 1;

const logoutBtn = document.getElementById('logoutBtn');
const actionSelect = document.getElementById('action');
const durationGroup = document.getElementById('durationGroup');
const addEvidenceBtn = document.getElementById('addEvidence');
const evidenceList = document.getElementById('evidenceList');
const logsContainer = document.getElementById('logs');
const banRequestContent = document.getElementById('banRequestContent');

// Logout
logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout');
  window.location.href = '/login.html';
});

// Show/hide duration field
actionSelect.addEventListener('change', () => {
  durationGroup.classList.toggle('hidden', actionSelect.value !== 'Ban');
});

// Add evidence inputs
addEvidenceBtn.addEventListener('click', () => {
  if (evidenceCount >= 3) return;
  evidenceCount++;
  const div = document.createElement('div');
  div.className = 'flex items-center gap-2';
  div.innerHTML = `
    <input type="text" class="w-full p-2 border rounded" placeholder="Evidence Link" />
    <span class="text-sm text-gray-500">${evidenceCount}/3</span>
  `;
  evidenceList.appendChild(div);
});

// Submit action
const actionForm = document.getElementById('actionForm');
actionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const action = actionSelect.value;
  const duration = document.getElementById('duration').value;
  const targetUser = document.getElementById('targetUser').value;
  const reason = document.getElementById('reason').value;
  const evidenceInputs = evidenceList.querySelectorAll('input');

  if (evidenceInputs.length < 3 || [...evidenceInputs].some(el => !el.value)) {
    alert('3 valid evidence links are required.');
    return;
  }

  const evidence = [...evidenceInputs].map(el => el.value);
  const payload = { action, duration, targetUser, reason, evidence };

  const route = (permissionLevel < 3 && action === 'Ban') ? '/api/ban-request' : '/api/submit-action';

  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    alert('Submitted successfully.');
    actionForm.reset();
    evidenceList.innerHTML = '';
    evidenceCount = 1;
    evidenceList.innerHTML = `
      <div class="flex items-center gap-2">
        <input type="text" class="w-full p-2 border rounded" placeholder="Evidence Link" />
        <span class="text-sm text-gray-500">1/3</span>
      </div>`;
    loadLogs();
    loadBanRequests();
  } else {
    alert('Failed to submit.');
  }
});

// Load logs
async function loadLogs() {
  const res = await fetch('/api/logs');
  const data = await res.json();
  logsContainer.innerHTML = data.map(log => `
    <div class="border p-3 rounded shadow flex justify-between items-center">
      <div>
        <p><strong>${log.action}</strong> on <strong>${log.targetUser}</strong></p>
        <p class="text-sm text-gray-600">${log.reason}</p>
        <p class="text-xs text-gray-400">${log.timestamp}</p>
      </div>
      <button onclick="deleteLog('${log.id}')" class="text-red-500 text-sm">Delete</button>
    </div>`).join('');
}

async function deleteLog(id) {
  if (!confirm('Are you sure you want to delete this log?')) return;
  await fetch('/api/delete-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  loadLogs();
}

// Load ban requests
async function loadBanRequests() {
  const res = await fetch('/api/ban-requests');
  const { permissionLevel: level, requests, ownRequests } = await res.json();
  permissionLevel = level;

  if (level === 3) {
    banRequestContent.innerHTML = requests.map(req => `
      <div class="border p-3 rounded shadow">
        <p><strong>${req.targetUser}</strong> — ${req.duration}</p>
        <p>${req.reason}</p>
        <div class="flex gap-2 text-blue-500 text-sm">
          ${req.evidence.map(link => `<a href="${link}" target="_blank">Evidence</a>`).join(', ')}
        </div>
        <div class="flex gap-2 mt-2">
          <button class="bg-green-500 text-white px-2 py-1 rounded" onclick="handleRequest('${req.id}', 'accept')">Accept</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="handleRequest('${req.id}', 'decline')">Decline</button>
        </div>
      </div>`).join('');
  } else {
    banRequestContent.innerHTML = ownRequests.map(req => `
      <div class="border p-3 rounded shadow">
        <p><strong>${req.targetUser}</strong> — ${req.duration}</p>
        <p>${req.reason}</p>
        <p class="text-sm">Status: ${req.status}</p>
      </div>`).join('');
  }
}

async function handleRequest(id, action) {
  await fetch('/api/handle-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action })
  });
  loadBanRequests();
  loadLogs();
}

// Init
loadLogs();
loadBanRequests();
