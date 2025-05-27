// logs.js (in public/scripts)

let currentUser = null;
const logTable = document.getElementById('log-table-body');
const searchInput = document.getElementById('search-user');

async function getUser() {
  const res = await fetch('/api/user');
  if (!res.ok) return (window.location.href = '/');
  const data = await res.json();
  currentUser = data;
}

async function searchLogs() {
  const username = searchInput.value.trim();
  if (!username) return alert('Enter a username');

  const res = await fetch(`/api/logs/user/${encodeURIComponent(username)}`);
  if (!res.ok) return alert('Failed to fetch logs');

  const logs = await res.json();
  renderLogs(logs);
}

function renderLogs(logs) {
  logTable.innerHTML = '';
  if (logs.length === 0) {
    logTable.innerHTML = '<tr><td colspan="6" class="text-center py-4">No logs found</td></tr>';
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border px-3 py-2">${log.type}</td>
      <td class="border px-3 py-2">${log.target}</td>
      <td class="border px-3 py-2">${log.reason}</td>
      <td class="border px-3 py-2">${log.duration || '-'}</td>
      <td class="border px-3 py-2">
        <a href="${log.evidence1}" class="text-blue-600" target="_blank">1</a> |
        <a href="${log.evidence2}" class="text-blue-600" target="_blank">2</a> |
        <a href="${log.evidence3}" class="text-blue-600" target="_blank">3</a>
      </td>
      <td class="border px-3 py-2">
        ${renderActionButtons(log)}
      </td>
    `;
    logTable.appendChild(row);
  });
}

function renderActionButtons(log) {
  let buttons = '';
  if (currentUser.level >= 1 && log.type === 'Warn') {
    buttons += `<button class="text-red-600" onclick="deleteLog(${log.id})">🗑️</button>`;
    buttons += `<button class="ml-2 text-blue-600" onclick="editLog(${log.id}, 'Warn')">✏️</button>`;
  }
  if (currentUser.level >= 2 && log.type === 'Kick') {
    buttons += `<button class="text-red-600" onclick="deleteLog(${log.id})">🗑️</button>`;
    buttons += `<button class="ml-2 text-blue-600" onclick="editLog(${log.id}, 'Kick')">✏️</button>`;
  }
  if (currentUser.level >= 3 && log.type === 'Ban') {
    buttons += `<button class="text-red-600" onclick="deleteLog(${log.id})">🗑️</button>`;
    buttons += `<button class="ml-2 text-blue-600" onclick="editLog(${log.id}, 'Ban')">✏️</button>`;
  }
  return buttons;
}

async function deleteLog(id) {
  if (!confirm('Delete this log?')) return;
  const res = await fetch('/api/delete-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (res.ok) searchLogs();
  else alert('Failed to delete');
}

function editLog(id, currentType) {
  const newType = prompt(`Change punishment type for log ${id} (Warn, Kick, Ban):`, currentType);
  if (!newType || !['Warn', 'Kick', 'Ban'].includes(newType)) return;

  fetch('/api/edit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, newType })
  })
    .then(res => res.ok ? searchLogs() : alert('Failed to update log'));
}

document.getElementById('search-btn').addEventListener('click', searchLogs);

getUser();
