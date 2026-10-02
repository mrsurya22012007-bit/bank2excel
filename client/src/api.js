const jsonHeaders = { "Content-Type": "application/json" };

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export const api = {
  uploadPdf(file) {
    const body = new FormData();
    body.append("file", file);
    return fetch(`${API_BASE_URL}/api/batches/upload`, {
      method: "POST",
      body,
    }).then(parse);
  },

  listBatches(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query}` : "";
    return fetch(`${API_BASE_URL}/api/batches${suffix}`).then(parse);
  },

  getBatch(id) {
    return fetch(`${API_BASE_URL}/api/batches/${id}`).then(parse);
  },

  saveBatch(id, payload) {
    return fetch(`${API_BASE_URL}/api/batches/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }).then(parse);
  },

  recalculate(id) {
    return fetch(`${API_BASE_URL}/api/batches/${id}/recalculate`, {
      method: "POST",
    }).then(parse);
  },

  deleteBatch(id) {
    return fetch(`${API_BASE_URL}/api/batches/${id}`, {
      method: "DELETE",
    }).then(parse);
  },

  exportUrl(id, format = "xlsx") {
    return `${API_BASE_URL}/api/batches/${id}/export?format=${format}`;
  },
};