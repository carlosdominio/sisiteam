const API_URL = '/api';
let currentAliasId = null;
let currentEditId = null;

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadStatus() {
  const response = await fetch(`${API_URL}/status`);
  const data = await response.json();

  document.getElementById('usedCount').textContent = data.dailyUsage.used;
  document.getElementById('limitCount').textContent = data.dailyUsage.limit;
  document.getElementById('remainingCount').textContent = data.dailyUsage.remaining;

  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = `${data.dailyUsage.percentage}%`;

  renderTodayAliases(data.todayAliases);
  renderUsedEmails(data.usedEmails);
}

function renderTodayAliases(aliases) {
  const container = document.getElementById('todayAliases');
  
  if (!aliases || aliases.length === 0) {
    container.innerHTML = '<p class="empty">Nenhum alias hoje.</p>';
    return;
  }

  container.innerHTML = '<ul class="alias-list">' + 
    aliases.map(a => renderAliasItem(a)).join('') + 
    '</ul>';
}

function renderAliasItem(alias) {
  const isUsed = alias.used === 1;
  const validDate = alias.validity_datetime ? new Date(alias.validity_datetime) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let daysLeft = null;
  if (validDate) {
    const v = new Date(validDate);
    v.setHours(0, 0, 0, 0);
    daysLeft = Math.ceil((v - today) / (1000 * 60 * 60 * 24));
  }
  
  let badge = '';
  if (daysLeft !== null && !isUsed) {
    if (daysLeft <= 0) {
      badge = '<span class="badge expired">Expirado</span>';
    } else {
      badge = `<span class="badge valid">${daysLeft} dias</span>`;
    }
  }
  
  const status = isUsed ? '<span class="badge used">USADO</span>' : 
    (daysLeft !== null && daysLeft <= 0 ? '<span class="badge expired">EXPIRADO</span>' : '<span class="badge active">ATIVO</span>');

  const safeAlias = escapeHtml(alias.alias);
  const safeDesc = escapeHtml(alias.description || '');

  const colorStyle = alias.color ? `style="border-left: 4px solid ${alias.color}"` : '';

  return `<li class="alias-item ${isUsed ? 'used' : ''}" ${colorStyle}>
    <div class="alias-info">
      <div class="alias-email">${escapeHtml(alias.alias)}</div>
      ${alias.description ? `<div class="alias-desc">${escapeHtml(alias.description)}</div>` : ''}
      <div class="alias-meta">
        ${alias.used_at ? `Usado: ${escapeHtml(alias.usage_location || '-')}` : 'Pendente'}
        ${badge}
      </div>
    </div>
    <div class="alias-actions">
      ${!isUsed ? `<button class="btn-primary btn-small" onclick="openUseModal(${alias.id}, '${safeAlias}')">Usar</button>` : ''}
      <button class="btn-secondary btn-small" onclick="openEditModal(${alias.id}, '${safeAlias}', '${safeDesc}')">✏</button>
      <button class="btn-danger btn-small" onclick="deleteAlias(${alias.id}, '${safeAlias}')">🗑</button>
      ${status}
    </div>
  </li>`;
}

function renderUsedEmails(emails) {
  const container = document.getElementById('usedEmails');
  
  if (!emails || emails.length === 0) {
    container.innerHTML = '<p class="empty">Nenhum email utilizado.</p>';
    return;
  }

  container.innerHTML = '<div class="email-tags">' + 
    emails.map(e => `<span class="email-tag">${escapeHtml(e)}</span>`).join('') + 
    '</div>';
}

async function loadAllAliases() {
  const response = await fetch(`${API_URL}/aliases`);
  const data = await response.json();

  const container = document.getElementById('allAliases');
  
  if (!data.aliases || data.aliases.length === 0) {
    container.innerHTML = '<p class="empty">Nenhum alias.</p>';
    return;
  }

  container.innerHTML = '<ul class="alias-list">' + 
    data.aliases.map(a => renderAliasItem(a)).join('') + 
    '</ul>';
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const project = document.getElementById('project').value.trim();
  const description = document.getElementById('description').value.trim();
  const validityDays = parseInt(document.getElementById('validityDays').value) || 30;
  const resultDiv = document.getElementById('createResult');

  if (!project) {
    resultDiv.textContent = 'Projeto obrigatório';
    resultDiv.className = 'result error';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, description, validityDays })
    });

    const data = await response.json();

    if (response.ok) {
      resultDiv.textContent = `Criado: ${data.alias}`;
      resultDiv.className = 'result success';
      document.getElementById('createForm').reset();
      loadStatus();
      loadAllAliases();
    } else {
      resultDiv.textContent = data.error || 'Erro';
      resultDiv.className = 'result error';
    }
  } catch (error) {
    resultDiv.textContent = 'Erro: ' + error.message;
    resultDiv.className = 'result error';
  }
});

function openUseModal(id, alias) {
  currentAliasId = id;
  document.getElementById('modalAlias').textContent = alias;
  document.getElementById('modalUsageLocation').value = '';
  document.getElementById('useModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('useModal').style.display = 'none';
  currentAliasId = null;
}

async function confirmUse() {
  const location = document.getElementById('modalUsageLocation').value.trim();
  if (!location) {
    alert('Informe o local de uso');
    return;
  }

  await fetch(`${API_URL}/aliases/${currentAliasId}/usar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usageLocation: location })
  });

  closeModal();
  loadStatus();
  loadAllAliases();
}

function openEditModal(id, alias, description) {
  currentEditId = id;
  document.getElementById('editAlias').textContent = alias;
  document.getElementById('editDescription').value = description || '';
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  currentEditId = null;
}

async function confirmEdit() {
  const description = document.getElementById('editDescription').value.trim();

  await fetch(`${API_URL}/aliases/${currentEditId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  });

  closeEditModal();
  loadAllAliases();
}

async function deleteAlias(id, alias) {
  if (!confirm(`Excluir ${alias}?`)) return;

  await fetch(`${API_URL}/aliases/${id}`, { method: 'DELETE' });
  loadStatus();
  loadAllAliases();
}

async function clearUsedEmails() {
  if (!confirm('Limpar emails utilizados?')) return;
  await fetch(`${API_URL}/used-emails`, { method: 'DELETE' });
  loadStatus();
}

async function resetDailyUsage() {
  if (!confirm('Resetar limite diário?')) return;
  await fetch(`${API_URL}/daily-usage`, { method: 'DELETE' });
  loadStatus();
}

function exportExcel() {
  window.location.href = `${API_URL}/export/excel`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  loadAllAliases();
});
