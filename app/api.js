const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const databaseEnabled = Boolean(apiUrl);
let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  if (!databaseEnabled) return null;
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });
  if (!response.ok) {
    let serverMessage = '';
    try {
      const body = await response.json();
      serverMessage = body?.message || body?.error || '';
    } catch { }
    const error = new Error(serverMessage || `API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function authenticateUser(username, password) {
  if (!databaseEnabled) {
    const localAccounts = [
      { username: 'admin', password: 'admin101', role: 'admin' },
      { username: 'employee', password: 'cafe101', role: 'employee' },
    ];
    const account = localAccounts.find((candidate) => candidate.username === username.trim().toLowerCase() && candidate.password === password);
    if (!account) throw new Error('Incorrect username or password.');
    return { user: { username: account.username, role: account.role } };
  }

  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function loadCafeState() { return request('/api/state'); }
export function loadSalesReport(period, date) {
  const dateFilter = date ? `&date=${encodeURIComponent(date)}` : '';
  return request(`/api/reports/sales?period=${encodeURIComponent(period)}${dateFilter}`);
}
export function loadKitchenOrders() { return request('/api/kitchen/orders'); }
export function completeKitchenOrder(orderId) { return request(`/api/kitchen/orders/${encodeURIComponent(orderId)}/complete`, { method: 'PATCH' }); }
export function loadSpillageInventory() { return request('/api/spillage/inventory'); }
export function saveMenuItem(item, isNew = false) { return request(`/api/menu${isNew ? '' : `/${item.id}`}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) }); }
export function removeMenuItem(id) { return request(`/api/menu/${id}`, { method: 'DELETE' }); }
export function saveInventoryItem(item) { return request(`/api/inventory/${item.id}`, { method: 'PATCH', body: JSON.stringify(item) }); }
export function removeInventoryItem(id) { return request(`/api/inventory/${id}`, { method: 'DELETE' }); }
export function saveOrder(order, requirements) { return request('/api/orders', { method: 'POST', body: JSON.stringify({ order, requirements }) }); }
export function saveSpillageLog(entry) { return request('/api/spillage', { method: 'POST', body: JSON.stringify(entry) }); }
export function loadCategories() { return request('/api/categories'); }
export function createCategoryApi(category) { return request('/api/categories', { method: 'POST', body: JSON.stringify(category) }); }
export function removeCategoryApi(id) { return request(`/api/categories/${id}`, { method: 'DELETE' }); }
export function updateCategoryApi(id, patch) { return request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(patch) }); }
