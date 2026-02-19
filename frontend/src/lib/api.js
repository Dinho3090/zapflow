import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function request(method, path, body, isFormData = false) {
  const token = await getToken();
  const BASE = process.env.NEXT_PUBLIC_API_URL || "";
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const whatsappApi = {
  status: () => request("GET", "/api/whatsapp/status"),
  connect: () => request("GET", "/api/whatsapp/connect"),
  disconnect: () => request("POST", "/api/whatsapp/disconnect"),
};

export const contactsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/contacts${q ? "?" + q : ""}`);
  },
  tags: () => request("GET", "/api/contacts/tags"),
  import: (file, tags = []) => {
    const fd = new FormData();
    fd.append("file", file);
    if (tags.length) fd.append("x-tags", tags.join(","));
    return request("POST", "/api/contacts/import", fd, true);
  },
  delete: id => request("DELETE", `/api/contacts/${id}`),
  updateTags: (id, tags) =>
    request("PATCH", `/api/contacts/${id}/tags`, { tags }),
};

export const campaignsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request("GET", `/api/campaigns${query ? "?" + query : ""}`);
  },
  calendar: (month, year) =>
    request("GET", `/api/campaigns/calendar?month=${month}&year=${year}`),
  get: id => request("GET", `/api/campaigns/${id}`),
  create: body => request("POST", "/api/campaigns", body),
  start: id => request("POST", `/api/campaigns/${id}/start`),
  pause: id => request("POST", `/api/campaigns/${id}/pause`),
  resume: id => request("POST", `/api/campaigns/${id}/resume`),
  delete: id => request("DELETE", `/api/campaigns/${id}`),
  report: id => request("GET", `/api/campaigns/${id}/report`),
};

export const automationsApi = {
  list: () => request("GET", "/api/automations"),
  get: id => request("GET", `/api/automations/${id}`),
  create: body => request("POST", "/api/automations", body),
  update: (id, body) => request("PATCH", `/api/automations/${id}`, body),
  delete: id => request("DELETE", `/api/automations/${id}`),
};

export const mediaApi = {
  list: type => request("GET", `/api/media${type ? "?type=" + type : ""}`),
  upload: file => {
    const fd = new FormData();
    fd.append("file", file);
    return request("POST", "/api/media/upload", fd, true);
  },
  delete: id => request("DELETE", `/api/media/${id}`),
};
