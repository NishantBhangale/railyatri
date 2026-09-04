import { useState } from "react";
import { api } from "../api/client.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function BookingModal({ train, trainClass, user, onClose, onBooked }) {
  const [step, setStep] = useState("details"); // details | paying | done
  const [passengerName, setPassengerName] = useState(user.name);
  const [travelDate, setTravelDate] = useState(todayISO());
  const [seatNumber, setSeatNumber] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const insufficientFunds = Number(user.wallet_balance) < Number(trainClass.price);

  async function handleConfirm(e) {
    e.preventDefault();
    setError("");

    if (insufficientFunds) {
      setError("Wallet balance is too low for this fare. Top up first.");
      return;
    }

    setStep("paying");
    setTimeout(async () => {
      try {
        const res = await api.createBooking({
          userId: user.id,
          trainClassId: trainClass.id,
          passengerName,
          travelDate,
          seatNumber: seatNumber ? Number(seatNumber) : undefined,
        });
        setResult(res);
        setStep("done");
        onBooked(res.walletBalance);
      } catch (err) {
        setError(err.message);
        setStep("details");
      }
    }, 900);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md glass-panel rounded-lg p-6" style={{ background: "rgba(13,18,38,0.9)" }}>
        {step !== "done" && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-mono-nums text-flap-amber text-xs">{train.train_number}</p>
                <h2 className="font-display text-xl text-white font-semibold">{train.name}</h2>
                <p className="text-white/50 text-sm">
                  {train.source} → {train.destination}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      trainClass.isAc ? "bg-flap-violet/20 text-flap-violet" : "bg-white/10 text-white/60"
                    }`}
                  >
                    {trainClass.isAc ? "AC" : "NON-AC"}
                  </span>
                  <span className="text-white/70 text-xs">{trainClass.className}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">
                ×
              </button>
            </div>

            {step === "details" && (
              <form onSubmit={handleConfirm} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50">Passenger name</label>
                  <input
                    required
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white outline-none focus:border-flap-amber"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50">Travel date</label>
                    <input
                      required
                      type="date"
                      min={todayISO()}
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white font-mono-nums outline-none focus:border-flap-amber"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Seat # (optional)</label>
                    <input
                      type="number"
                      min="1"
                      max={trainClass.totalSeats}
                      value={seatNumber}
                      onChange={(e) => setSeatNumber(e.target.value)}
                      placeholder="auto"
                      className="mt-1 w-full bg-platform-800/80 border border-white/10 rounded-md px-3 py-2 text-white font-mono-nums outline-none focus:border-flap-amber"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-platform-800/80 rounded-md px-3 py-2 text-sm">
                  <span className="text-white/60">Fare ({trainClass.classCode})</span>
                  <span className="font-mono-nums text-white">${Number(trainClass.price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center px-3 text-sm">
                  <span className="text-white/60">Wallet balance</span>
                  <span
                    className={`font-mono-nums ${insufficientFunds ? "text-signal-stop" : "text-white/80"}`}
                  >
                    ${Number(user.wallet_balance).toFixed(2)}
                  </span>
                </div>

                {error && <p className="text-signal-stop text-sm">{error}</p>}

                <button
                  disabled={insufficientFunds}
                  className="w-full bg-flap-amber text-platform-950 font-semibold py-2 rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Pay & confirm booking
                </button>
              </form>
            )}

            {step === "paying" && (
              <div className="py-10 text-center">
                <div className="w-8 h-8 border-2 border-flap-amber border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60 text-sm font-mono-nums">Processing payment…</p>
              </div>
            )}
          </>
        )}

        {step === "done" && result && (
          <div className="text-center py-4">
            <p className="text-signal-go text-3xl mb-2">✓</p>
            <h2 className="font-display text-xl text-white font-semibold">Booking confirmed</h2>
            <p className="text-white/50 text-sm mb-4">
              {result.booking.class_code} · Seat {result.booking.seat_number} · {result.booking.travel_date.slice(0, 10)}
            </p>
            <div className="bg-platform-800/80 rounded-md p-4 text-left text-sm space-y-1 mb-6">
              <Row label="Train" value={`${result.booking.train_number} · ${result.booking.train_name}`} />
              <Row label="Class" value={result.booking.class_name} />
              <Row label="Passenger" value={result.booking.passenger_name} />
              <Row label="Amount paid" value={`$${Number(result.booking.amount).toFixed(2)}`} />
              <Row label="New balance" value={`$${Number(result.walletBalance).toFixed(2)}`} />
            </div>
            <button
              onClick={onClose}
              className="w-full bg-flap-amber text-platform-950 font-semibold py-2 rounded-md hover:brightness-110"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white font-mono-nums">{value}</span>
    </div>
  );
}
