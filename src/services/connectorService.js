import { auth } from "./firebase";

const API_BASE = "https://eloria-trial.onrender.com";

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function listConnectors() {
  const res = await fetch(`${API_BASE}/api/connectors`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load connectors");
  return res.json();
}

export async function startConnectorOAuth(providerId) {
  const res = await fetch(`${API_BASE}/api/connectors/oauth/${providerId}/start`, {
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to start connection");
  window.location.href = data.url;
}

export async function disconnectConnector(providerId) {
  const res = await fetch(`${API_BASE}/api/connectors/${providerId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to disconnect");
  return res.json();
}

export async function createCustomConnector(payload) {
  const res = await fetch(`${API_BASE}/api/connectors/custom`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create connector");
  return data;
}

export async function updateCustomConnector(id, payload) {
  const res = await fetch(`${API_BASE}/api/connectors/custom/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update connector");
  return data;
}

export async function deleteCustomConnector(id) {
  const res = await fetch(`${API_BASE}/api/connectors/custom/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete connector");
  return res.json();
}