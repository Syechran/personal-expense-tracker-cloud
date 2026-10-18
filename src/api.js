export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(path, {
    credentials: "include",
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
  }

  if (!response.ok || payload?.status === "Error") {
    throw new Error(
      payload?.message || `Permintaan gagal (HTTP ${response.status}).`
    );
  }

  return payload;
}
