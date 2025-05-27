// public/scripts/log.js

let currentUser = null;

async function getUser() {
  const res = await fetch('/api/user');
  if (!res.ok) return (window.location.href = '/');
  currentUser = await res.json();
}

document.getElementById('search-btn').addEventListener('click', searchLogs);

function canEdit(type) {
  if (!currentUser) return false;
  if (type === 'Ban') return currentUser.level === 3;
  if (type === 'Kick') return currentUser.level >= 2;
  if (type === 'Warn') return currentUser.level >= 1;
  return false;
}


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
        ${canEdit(log.type) ? `<button onclick='editLog(${JSON.stringify(log)})' class="text-blue-600 font-bold">✏️</button>` : ''}
        <button onclick="deleteLog(${log.id})" class="text-red-600 font-bold ml-2">🗑️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function editLog(log) {
  if (!canEdit(log.type)) {
    return alert('❌ Insufficient permission to edit this type of log.');
  }

  // Show modal
  document.getElementById('edit-modal').classList.remove('hidden');

  // Fill modal with log data
  document.getElementById('edit-log-id').value = log.id;
  document.getElementById('edit-log-type').value = log.type;
  document.getElementById('edit-log-reason').value = log.reason;
  document.getElementById('edit-log-duration').value = log.duration || '';
  document.getElementById('edit-log-evidence1').value = log.evidence1 || '';
  document.getElementById('edit-log-evidence2').value = log.evidence2 || '';
  document.getElementById('edit-log-evidence3').value = log.evidence3 || '';
}

// Save edited log
document.getElementById('edit-log-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('edit-log-id').value;
  const type = document.getElementById('edit-log-type').value;
  const reason = document.getElementById('edit-log-reason').value.trim();
  const duration = type === 'Ban' ? document.getElementById('edit-log-duration').value : '';
  const evidence1 = document.getElementById('edit-log-evidence1').value.trim();
  const evidence2 = document.getElementById('edit-log-evidence2').value.trim();
  const evidence3 = document.getElementById('edit-log-evidence3').value.trim();

  const res = await fetch('/api/logs/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, type, reason, duration, evidence1, evidence2, evidence3 })
  });

  if (res.ok) {
    document.getElementById('edit-modal').classList.add('hidden');
    searchLogs(); // refresh
  } else {
    alert(await res.text());
  }
});

// Cancel button closes the modal
document.getElementById('cancel-edit').addEventListener('click', () => {
  document.getElementById('edit-modal').classList.add('hidden');
});


getUser();
