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
  if (currentUser.level < 3) loadMyRequests();
  else loadReviewRequests(); // Updated function name
}


function adjustUI() {
  const level = currentUser.level;

  // Restrict Kick/Ban buttons based on permission
  if (level < 2) {
    document.getElementById('kick-btn').disabled = true;
  }
  if (level < 3) {
    document.getElementById('ban-btn').disabled = true;
  }

  // Show/hide ban request sections
  if (level < 3) {
    // Levels 1–2 can submit ban requests and view their own
    banRequestForm.classList.remove('hidden');
    myRequestsContainer.classList.remove('hidden');
    reviewContainer.classList.add('hidden');
    loadMyRequests();
  }
  if (level >= 3) {
  reviewContainer.classList.remove('hidden');
  banRequestForm.classList.add('hidden');
  myRequestsContainer.classList.add('hidden');
  loadReviewRequests();  // ✅
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

  const res = await fetch('/api/submit-ban-request', {
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
    console.error('❌ Failed to load logs:', errorText);
    return;
  }

  const logs = await res.json();

  if (!logContainer) {
    console.error('❌ logContainer element not found in HTML!');
    return;
  }

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
  const container = document.getElementById('review-requests-section');
  const table = document.getElementById('review-requests-table');

  table.innerHTML = `
    <thead class="bg-gray-100 text-sm text-gray-700 uppercase">
      <tr>
        <th class="px-4 py-3 text-left">User</th>
        <th class="px-4 py-3 text-left">Target</th>
        <th class="px-4 py-3 text-left">Reason</th>
        <th class="px-4 py-3 text-left">Evidence</th>
        <th class="px-4 py-3 text-left">Duration</th>
        <th class="px-4 py-3 text-left">Timestamp</th>
        <th class="px-4 py-3 text-left">Status</th>
        <th class="px-4 py-3 text-left">Actions</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200 text-sm"></tbody>
  `;

  const tbody = table.querySelector('tbody');

  data.forEach(req => {
    const row = document.createElement('tr');
    row.classList.add('hover:bg-gray-50');

    const timestamp = new Date(req.timestamp).toLocaleString();

    row.innerHTML = `
      <td class="px-4 py-3 font-semibold text-gray-800">${req.created_by || 'Unknown'}</td>
      <td class="px-4 py-3">${req.target}</td>
      <td class="px-4 py-3 max-w-xs">
        <button class="text-blue-600 underline hover:text-blue-800" onclick="alert(\`${req.reason.replace(/`/g, "'")}\`)">View</button>
      </td>
      <td class="px-4 py-3 space-x-1">
        <a href="${req.evidence1}" target="_blank" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">1</a>
        <a href="${req.evidence2}" target="_blank" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">2</a>
        <a href="${req.evidence3}" target="_blank" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">3</a>
      </td>
      <td class="px-4 py-3">${req.duration}</td>
      <td class="px-4 py-3 text-gray-500">${timestamp}</td>
      <td class="px-4 py-3">
        <span class="inline-block px-2 py-1 rounded-full text-xs font-semibold
          ${req.status === 'Approved' ? 'bg-green-100 text-green-800' : ''}
          ${req.status === 'Denied' ? 'bg-red-100 text-red-800' : ''}
          ${req.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : ''}
        ">
          ${req.status}
        </span>
      </td>
      <td class="px-4 py-3 space-x-2">
        ${req.status === 'Pending' ? `
          <button onclick="approveRequest('${req.id}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs">✅ Approve</button>
          <button onclick="denyRequest('${req.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs">❌ Deny</button>
        ` : `<span class="text-gray-400 italic text-xs">Reviewed</span>`}
      </td>
    `;

    tbody.appendChild(row);
  });
}



async function loadMyRequests() {
  const res = await fetch('/api/my-ban-requests');
  const data = await res.json();
  const table = document.getElementById('my-requests-table');

  // Clear previous content
  table.innerHTML = `
    <thead class="bg-gray-200">
      <tr>
        <th class="px-4 py-2 text-left">Target</th>
        <th class="px-4 py-2 text-left">Reason</th>
        <th class="px-4 py-2 text-left">Duration</th>
        <th class="px-4 py-2 text-left">Evidence</th>
        <th class="px-4 py-2 text-left">Status</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200"></tbody>
  `;

  const tbody = table.querySelector('tbody');

  data.forEach(req => {
    const row = document.createElement('tr');
    row.classList.add('hover:bg-gray-50');
    row.innerHTML = `
      <td class="px-4 py-2 font-medium text-gray-800">${req.target}</td>
      <td class="px-4 py-2 text-gray-700">${req.reason}</td>
      <td class="px-4 py-2 text-gray-700">${req.duration}</td>
      <td class="px-4 py-2 text-blue-600">
        <a href="${req.evidence1}" target="_blank">1</a> |
        <a href="${req.evidence2}" target="_blank">2</a> |
        <a href="${req.evidence3}" target="_blank">3</a>
      </td>
      <td class="px-4 py-2">
        <span class="inline-block px-2 py-1 text-sm rounded 
          ${req.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : ''}
          ${req.status === 'Approved' ? 'bg-green-100 text-green-800' : ''}
          ${req.status === 'Denied' ? 'bg-red-100 text-red-800' : ''}">
          ${req.status}
        </span>
      </td>
    `;
    tbody.appendChild(row);
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
