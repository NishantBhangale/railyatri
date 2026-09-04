import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function MyBookings({ user, onBalanceChange }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    loadBookings();
  }, [user.id]);

  function loadBookings() {
    setLoading(true);
    api
      .getMyBookings(user.id)
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleCancel(bookingId) {
    setError("");
    setCancellingId(bookingId);
    try {
      const res = await api.cancelBooking(bookingId, user.id);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" } : b))
      );
      onBalanceChange(res.walletBalance);
      setConfirmId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <p className="font-mono-nums text-flap-amber text-xs tracking-widest">TICKET WALLET</p>
      <h1 className="font-display text-2xl text-white font-semibold mb-4">My bookings</h1>

      {loading && <p className="text-white/50">Loading…</p>}
      {error && <p className="text-signal-stop mb-3">{error}</p>}
      {!loading && bookings.length === 0 && (
        <p className="text-white/40">No bookings yet — go grab a seat from the departure board.</p>
      )}

      <div className="space-y-3">
        {bookings.map((b) => {
          const cancelled = b.status === "CANCELLED";
          return (
            <div
              key={b.id}
              className={`rounded-lg p-4 flex justify-between items-center flex-wrap gap-3 ${
                cancelled ? "border border-white/5 bg-platform-900/40 opacity-60" : "glass-panel"
              }`}
            >
              <div>
                <p className="font-mono-nums text-flap-amber text-xs">{b.train_number}</p>
                <p className="text-white font-medium">{b.train_name}</p>
                <p className="text-white/50 text-sm">
                  {b.source} → {b.destination} · {b.departure_time}–{b.arrival_time}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      b.is_ac ? "bg-flap-violet/20 text-flap-violet" : "bg-white/10 text-white/60"
                    }`}
                  >
                    {b.is_ac ? "AC" : "NON-AC"}
                  </span>
                  <span className="text-white/50 text-xs">{b.class_name}</span>
                </div>
              </div>
              <div className="text-sm text-white/70 space-y-0.5">
                <p>
                  Passenger: <span className="text-white">{b.passenger_name}</span>
                </p>
                <p>
                  Date: <span className="font-mono-nums text-white">{b.travel_date.slice(0, 10)}</span> ·
                  Seat <span className="font-mono-nums text-white">{b.seat_number}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono-nums text-white text-lg">${Number(b.amount).toFixed(2)}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    cancelled ? "bg-signal-stop/20 text-signal-stop" : "bg-signal-go/20 text-signal-go"
                  }`}
                >
                  {b.status}
                </span>
              </div>
              {!cancelled && (
                <div>
                  {confirmId === b.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-xs">Cancel & refund ${Number(b.amount).toFixed(2)}?</span>
                      <button
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancel(b.id)}
                        className="bg-signal-stop text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:brightness-110 disabled:opacity-50"
                      >
                        {cancellingId === b.id ? "Cancelling…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-white/40 hover:text-white text-xs"
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(b.id)}
                      className="border border-white/10 text-white/60 hover:text-signal-stop hover:border-signal-stop text-xs font-medium px-3 py-1.5 rounded-md"
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
