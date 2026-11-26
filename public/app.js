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
  date.textContent = formatDate(item.createdAt);
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

// AppSync GraphQL 호출 (API 키 인증)
async function gql(query, variables = {}) {
  const { url, apiKey } = window.APPSYNC_CONFIG || {};
  if (!url || !apiKey) throw new Error('AppSync 설정(.env)이 비어 있어요.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors && body.errors.length) {
    console.error('GraphQL errors:', body.errors);
    throw new Error(body.errors[0].message);
  }
  if (!res.ok) throw new Error(`요청 실패 (HTTP ${res.status})`);
  return body.data;
}

const LIST_QUERY = `
  query List($limit: Int) {
    listGuestbook(limit: $limit) { id name message createdAt }
  }`;

const ADD_MUTATION = `
  mutation Add($name: String!, $message: String!) {
    addGuestbook(name: $name, message: $message) { id name message createdAt }
  }`;

async function loadGuestbook() {
  try {
    const data = await gql(LIST_QUERY, { limit: 50 });
    const items = data.listGuestbook;
    list.innerHTML = '';
    if (items.length === 0) return showEmpty();
    items.forEach((item) => list.append(renderItem(item)));
  } catch (err) {
    console.error(err);
    list.innerHTML = '<li class="gb-empty">방명록을 불러오지 못했어요.</li>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;

  try {
    const data = await gql(ADD_MUTATION, {
      name: document.getElementById('gb-name').value,
      message: document.getElementById('gb-message').value,
    });

    if (list.querySelector('.gb-empty')) list.innerHTML = '';
    list.prepend(renderItem(data.addGuestbook));
    document.getElementById('gb-message').value = '';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
  }
});

loadGuestbook();
