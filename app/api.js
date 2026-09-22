const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const databaseEnabled = Boolean(apiUrl);

async function request(path, options = {}) {
  if (!databaseEnabled) return null;
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export function loadCafeState() { return request('/api/state'); }
export function saveMenuItem(item, isNew = false) { return request(`/api/menu${isNew ? '' : `/${item.id}`}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) }); }
export function removeMenuItem(id) { return request(`/api/menu/${id}`, { method: 'DELETE' }); }
export function saveInventoryItem(item) { return request(`/api/inventory/${item.id}`, { method: 'PATCH', body: JSON.stringify(item) }); }
export function saveOrder(order, requirements) { return request('/api/orders', { method: 'POST', body: JSON.stringify({ order, requirements }) }); }
