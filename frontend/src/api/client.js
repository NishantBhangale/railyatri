// In dev, requests go to the relative "/api" path and Vite's proxy (see
// vite.config.js) forwards them to the backend. In a production build there
// is no dev server to proxy for you, so set VITE_API_URL to the backend's
// full API URL at build time, e.g.:
//   VITE_API_URL=https://api.example.com/api npm run build
const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  createProfile: (name, email) =>
    request("/profile", { method: "POST", body: JSON.stringify({ name, email }) }),
  findProfileByEmail: (email) => request(`/profile?email=${encodeURIComponent(email)}`),
  getProfile: (userId) => request(`/profile/${userId}`),

  getWallet: (userId) => request(`/wallet/${userId}`),
  topUpWallet: (userId, amount) =>
    request("/wallet/topup", { method: "POST", body: JSON.stringify({ userId, amount }) }),

  getTrains: () => request("/trains"),
  getAvailability: (trainClassId, date) => request(`/train-classes/${trainClassId}/availability?date=${date}`),

  createBooking: (payload) =>
    request("/bookings", { method: "POST", body: JSON.stringify(payload) }),
  getMyBookings: (userId) => request(`/bookings/${userId}`),
  cancelBooking: (bookingId, userId) =>
    request(`/bookings/${bookingId}`, { method: "DELETE", body: JSON.stringify({ userId }) }),
};
