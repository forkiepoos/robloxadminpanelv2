// public/scripts/log.js

let currentUser = null;

async function getUser() {
  const res = await fetch('/api/user');
  if (!res.ok) return (window.location.href = '/');
  currentUser = await res.json();
}

document.getElementById('search-btn').addEventListener('click', searchLogs);

async function searchLogs() {
  const username = document.getElementById('search-username').value.trim();
  if (!username) return alert('Enter a username.');

  const res = await fetch(`/api/logs/user/${username}`);
  const logs = await res.json();

  console.log('🔍 Logs fetched:', logs);

  const container = document.getElementById('logs-table-container');
  const tableBody = document.getElementById('logs-table-body');
  const searchedUser = document.getElementById('searched-username');

  if (!Array.isArray(logs) || logs.length === 0) {
    container.classList.remove('hidden');
    searchedUser.textContent = username;
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No logs found for ${username}</td></tr>`;
    return;
  }

  container.classList.remove('hidden');
  searchedUser.textContent = username;
  tableBody.innerHTML = '';

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-3 py-2 border">${log.type}</td>
      <td class="px-3 py-2 border">${log.reason}</td>
      <td class="px-3 py-2 border">${log.duration || '-'}</td>
      <td class="px-3 py-2 border text-blue-600">
        <a href="${log.evidence1}" target="_blank">1</a> |
        <a href="${log.evidence2}" target="_blank">2</a> |
        <a href="${log.evidence3}" target="_blank">3</a>
      </td>
      <td class="px-3 py-2 border">${log.created_by}</td>
      <td class="px-3 py-2 border">${new Date(log.timestamp).toLocaleString()}</td>
      <td class="px-3 py-2 border">
        <button onclick="editLog(${log.id})" class="text-blue-600 font-bold">✏️</button>
        <button onclick="deleteLog(${log.id})" class="text-red-600 font-bold ml-2">🗑️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function canEdit(type) {
  if (!currentUser) return false;
  if (type === 'Ban') return currentUser.level === 3;
  if (type === 'Kick') return currentUser.level >= 2;
  if (type === 'Warn') return currentUser.level >= 1;
  return false;
}

async function deleteLog(id) {
  if (!confirm('Delete this log?')) return;
  const res = await fetch('/api/logs/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (res.ok) searchLogs();
  else alert('Failed to delete');
}

function editLog(log) {
  const newType = prompt('New type (Warn/Kick/Ban):', log.type);
  const newReason = prompt('New reason:', log.reason);
  const newDuration = newType === 'Ban' ? prompt('New duration:', log.duration) : '';

  if (!newType || !newReason || (newType === 'Ban' && !newDuration)) return alert('Invalid input');

  fetch('/api/logs/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: log.id,
      type: newType,
      reason: newReason,
      duration: newDuration
    })
  }).then(res => {
    if (res.ok) searchLogs();
    else res.text().then(alert);
  });
}

getUser();
