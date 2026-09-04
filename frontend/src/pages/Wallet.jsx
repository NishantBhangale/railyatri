import { useState } from "react";
import { api } from "../api/client.js";

const PRESETS = [500, 1000, 2000];

export default function Wallet({ user, onBalanceChange }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function topUp(amt) {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.topUpWallet(user.id, amt);
      onBalanceChange(res.balance);
      setMessage(`Added $${amt.toFixed(2)} — this is a dummy top-up, no real payment was made.`);
      setAmount("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <p className="font-mono-nums text-flap-amber text-xs tracking-widest">DEMO WALLET</p>
      <h1 className="font-display text-2xl text-white font-semibold mb-4">Wallet</h1>

      <div className="border border-white/10 rounded-lg p-6 bg-platform-900 mb-6">
        <p className="text-white/50 text-sm">Current balance</p>
        <p className="font-mono-nums text-4xl text-white mt-1">${Number(user.wallet_balance).toFixed(2)}</p>
      </div>

      <div className="border border-white/10 rounded-lg p-6 bg-platform-900">
        <p className="text-white font-medium mb-3">Top up (dummy — no real payment)</p>
        <div className="flex gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              disabled={loading}
              onClick={() => topUp(p)}
              className="flex-1 bg-platform-800 border border-white/10 rounded-md py-2 text-white/80 font-mono-nums hover:border-flap-amber disabled:opacity-50"
            >
              +${p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount) topUp(Number(amount));
          }}
          className="flex gap-2"
        >
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom amount"
            className="flex-1 bg-platform-800 border border-white/10 rounded-md px-3 py-2 text-white font-mono-nums outline-none focus:border-flap-amber"
          />
          <button
            disabled={loading || !amount}
            className="bg-flap-amber text-platform-950 font-semibold px-4 rounded-md hover:brightness-110 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {message && <p className="text-signal-go text-sm mt-3">{message}</p>}
        {error && <p className="text-signal-stop text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
