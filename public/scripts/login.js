// public/scripts/login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const username = form.get('username');
  const password = form.get('password');

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (res.ok) {
    window.location.href = '/dashboard.html';
  } else {
    document.getElementById('errorMsg').classList.remove('hidden');
  }
});
