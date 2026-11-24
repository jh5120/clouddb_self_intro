const form = document.getElementById('gb-form');
const list = document.getElementById('gb-list');
const errorEl = document.getElementById('gb-error');

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

// textContent 로만 넣어서 XSS 방지
function renderItem(item) {
  const li = document.createElement('li');
  const meta = document.createElement('div');
  meta.className = 'gb-meta';
  const name = document.createElement('strong');
  name.textContent = item.name;
  const date = document.createElement('span');
  date.textContent = formatDate(item.created_at);
  meta.append(name, date);
  const msg = document.createElement('p');
  msg.className = 'gb-msg';
  msg.textContent = item.message;
  li.append(meta, msg);
  return li;
}

function showEmpty() {
  list.innerHTML = '<li class="gb-empty">아직 방명록이 없어요. 첫 글을 남겨주세요!</li>';
}

async function loadGuestbook() {
  try {
    const res = await fetch('/api/guestbook');
    if (!res.ok) throw new Error();
    const items = await res.json();
    list.innerHTML = '';
    if (items.length === 0) return showEmpty();
    items.forEach((item) => list.append(renderItem(item)));
  } catch {
    list.innerHTML = '<li class="gb-empty">방명록을 불러오지 못했어요.</li>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;

  try {
    const res = await fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('gb-name').value,
        message: document.getElementById('gb-message').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '저장하지 못했어요.');

    if (list.querySelector('.gb-empty')) list.innerHTML = '';
    list.prepend(renderItem(data));
    document.getElementById('gb-message').value = '';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
  }
});

loadGuestbook();
