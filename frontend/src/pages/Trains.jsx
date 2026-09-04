import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import BookingModal from "../components/BookingModal.jsx";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Trains({ user, onBalanceChange }) {
  const [trains, setTrains] = useState([]);
  const [availability, setAvailability] = useState({}); // classId -> {available,total}
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBooking, setActiveBooking] = useState(null); // { train, trainClass }

  // Search bar state
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [mode, setMode] = useState("all"); // 'all' | 'search'

  useEffect(() => {
    api
      .getTrains()
      .then((res) => setTrains(res.trains))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const allClassIds = useMemo(
    () => trains.flatMap((t) => t.classes.map((c) => c.id)),
    [trains]
  );

  useEffect(() => {
    allClassIds.forEach((classId) => refreshAvailability(classId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClassIds, date]);

  function refreshAvailability(classId) {
    api
      .getAvailability(classId, date)
      .then((res) =>
        setAvailability((prev) => ({
          ...prev,
          [classId]: { available: res.availableSeats, total: res.totalSeats },
        }))
      )
      .catch(() => {});
  }

  const stationOptions = useMemo(() => {
    const set = new Set();
    trains.forEach((t) => {
      set.add(t.source);
      set.add(t.destination);
    });
    return Array.from(set).sort();
  }, [trains]);

  function handleSearch(e) {
    e.preventDefault();
    setAppliedFrom(fromInput.trim());
    setAppliedTo(toInput.trim());
    setMode("search");
  }

  function handleShowAll() {
    setFromInput("");
    setToInput("");
    setAppliedFrom("");
    setAppliedTo("");
    setMode("all");
  }

  const displayedTrains =
    mode === "search"
      ? trains.filter((t) => {
          const fromMatch = appliedFrom
            ? t.source.toLowerCase().includes(appliedFrom.toLowerCase())
            : true;
          const toMatch = appliedTo
            ? t.destination.toLowerCase().includes(appliedTo.toLowerCase())
            : true;
          return fromMatch && toMatch;
        })
      : trains;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono-nums text-flap-amber text-xs tracking-widest">DEPARTURES</p>
        <h1 className="font-display text-2xl text-white font-semibold mb-4">Find a train</h1>

        <form
          onSubmit={handleSearch}
          className="glass-panel rounded-lg p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="text-xs text-white/50">From</label>
            <input
              list="station-options"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              placeholder="e.g. Mumbai"
              className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white outline-none focus:border-flap-amber"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">To</label>
            <input
              list="station-options"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="e.g. Delhi"
              className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white outline-none focus:border-flap-amber"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Date of travel</label>
            <input
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white font-mono-nums outline-none focus:border-flap-amber"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-flap-amber text-platform-950 font-semibold py-2 rounded-md hover:brightness-110"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleShowAll}
              className={`flex-1 py-2 rounded-md border text-sm font-medium ${
                mode === "all"
                  ? "border-flap-amber text-flap-amber"
                  : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              Show All Trains
            </button>
          </div>
          <datalist id="station-options">
            {stationOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </form>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-white font-medium">
          {mode === "search"
            ? `Results${appliedFrom ? ` from ${appliedFrom}` : ""}${appliedTo ? ` to ${appliedTo}` : ""}`
            : "All trains"}
        </h2>
        <span className="text-white/40 text-xs font-mono-nums">{displayedTrains.length} trains</span>
      </div>

      {loading && <p className="text-white/50">Loading departure board…</p>}
      {error && <p className="text-signal-stop">{error}</p>}
      {!loading && mode === "search" && displayedTrains.length === 0 && (
        <p className="text-white/40 mb-4">
          No trains match that route. Try a different station or tap "Show All Trains".
        </p>
      )}

      <div className="space-y-4">
        {displayedTrains.map((t) => (
          <div key={t.id} className="glass-panel rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-wrap gap-2">
              <div>
                <p className="text-white font-medium">{t.name}</p>
                <p className="font-mono-nums text-white/40 text-xs">
                  {t.train_number} · {t.source} <span className="text-flap-amber">→</span> {t.destination}
                </p>
              </div>
              <p className="font-mono-nums text-white/70 text-sm">
                {t.departure_time} · {t.arrival_time}
              </p>
            </div>

            <div className="divide-y divide-white/5">
              {t.classes.map((c) => {
                const av = availability[c.id];
                const soldOut = av && av.available <= 0;
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-white/[0.03]"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          c.isAc ? "bg-flap-violet/20 text-flap-violet" : "bg-white/10 text-white/60"
                        }`}
                      >
                        {c.isAc ? "AC" : "NON-AC"}
                      </span>
                      <div>
                        <p className="text-white text-sm">{c.className}</p>
                        <p className="text-white/40 text-[11px] font-mono-nums">{c.classCode}</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      {av ? (
                        <span
                          className={`font-mono-nums text-xs px-2 py-1 rounded ${
                            soldOut
                              ? "bg-signal-stop/20 text-signal-stop"
                              : av.available < 8
                              ? "bg-signal-wait/20 text-signal-wait"
                              : "bg-signal-go/20 text-signal-go"
                          }`}
                        >
                          {soldOut ? "SOLD OUT" : `${av.available}/${av.total} open`}
                        </span>
                      ) : (
                        <span className="text-white/30 text-xs font-mono-nums">…</span>
                      )}
                    </div>
                    <div className="col-span-3 font-mono-nums text-white/80 text-sm">
                      ${Number(c.price).toFixed(0)}
                    </div>
                    <div className="col-span-2 text-right">
                      <button
                        disabled={soldOut}
                        onClick={() => setActiveBooking({ train: t, trainClass: c })}
                        className="bg-flap-amber text-platform-950 text-xs font-semibold px-3 py-1.5 rounded-md hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activeBooking && (
        <BookingModal
          train={activeBooking.train}
          trainClass={activeBooking.trainClass}
          user={user}
          onClose={() => {
            const classId = activeBooking.trainClass.id;
            setActiveBooking(null);
            refreshAvailability(classId);
          }}
          onBooked={(newBalance) => onBalanceChange(newBalance)}
        />
      )}
    </div>
  );
}
