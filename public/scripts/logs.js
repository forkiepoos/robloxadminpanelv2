// public/scripts/log.js

let currentUser = null;

async function getUser() {
  const res = await fetch('/api/user');
  if (!res.ok) return (window.location.href = '/');
  currentUser = await res.json();
}

async function searchLogs() {
  const username = document.getElementById('search-user').value.trim();
  if (!username) return alert('Enter a username.');

  const res = await fetch(`/api/logs/user/${username}`);
  const logs = await res.json();

  console.log('🔍 Search result:', logs); // Debugging

  const table = document.getElementById('user-logs-table');
  table.innerHTML = '';

  if (!logs.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-center py-4">No logs found for that user.</td></tr>';
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border px-2 py-1">${log.type}</td>
      <td class="border px-2 py-1">${log.target}</td>
      <td class="border px-2 py-1">${log.reason}</td>
      <td class="border px-2 py-1">${log.duration || '-'}</td>
      <td class="border px-2 py-1 text-blue-600">
        <a href="${log.evidence1}" target="_blank">1</a> |
        <a href="${log.evidence2}" target="_blank">2</a> |
        <a href="${log.evidence3}" target="_blank">3</a>
      </td>
      <td class="border px-2 py-1">${log.created_by}</td>
    `;
    table.appendChild(row);
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
