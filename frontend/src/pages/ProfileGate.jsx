import { useState } from "react";
import { api } from "../api/client.js";
import TrainBackground from "../components/TrainBackground.jsx";

export default function ProfileGate({ onProfileReady }) {
  const [mode, setMode] = useState("create"); // 'create' | 'login'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile =
        mode === "create" ? await api.createProfile(name, email) : await api.findProfileByEmail(email);
      onProfileReady(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative bg-platform-950">
      <TrainBackground />
      <div className="w-full max-w-sm relative z-10">
        <div className="mb-8 text-center">
          <p className="font-mono-nums text-flap-amber text-xs tracking-widest">PLATFORM 1</p>
          <h1 className="font-display text-3xl font-bold text-white mt-1">RailYatra</h1>
          <p className="text-platform-700 text-sm mt-2 text-white/50">
            Create a profile to start booking berths.
          </p>
        </div>

        <div className="bg-platform-900 border border-white/10 rounded-lg p-6">
          <div className="flex mb-6 rounded-md overflow-hidden border border-white/10 text-sm">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 py-2 ${
                mode === "create" ? "bg-flap-amber text-platform-950 font-semibold" : "text-white/60"
              }`}
            >
              New profile
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 ${
                mode === "login" ? "bg-flap-amber text-platform-950 font-semibold" : "text-white/60"
              }`}
            >
              Existing profile
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "create" && (
              <div>
                <label className="text-xs text-white/50">Full name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full bg-platform-800 border border-white/10 rounded-md px-3 py-2 text-white outline-none focus:border-flap-amber"
                  placeholder="Nishant Kumar"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-white/50">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-platform-800 border border-white/10 rounded-md px-3 py-2 text-white outline-none focus:border-flap-amber"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-signal-stop text-sm">{error}</p>}

            <button
              disabled={loading}
              className="w-full bg-flap-amber text-platform-950 font-semibold py-2 rounded-md hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "create" ? "Create profile" : "Continue"}
            </button>
          </form>
        </div>

        {mode === "create" && (
          <p className="text-center text-white/40 text-xs mt-4">
            Every new profile starts with a $1000 demo wallet.
          </p>
        )}
      </div>
    </div>
  );
}
