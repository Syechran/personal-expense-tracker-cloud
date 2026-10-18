import { useState } from "react";
import { apiFetch } from "../api";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = isRegister
        ? { name, email, password }
        : { email, password };

      const result = await apiFetch(
        `/api/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      onAuth(result.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>Keuangan</h1>
          <p className="auth-subtitle">
            {isRegister
              ? "Buat akun untuk mulai mencatat keuanganmu."
              : "Masuk untuk melanjutkan mencatat keuanganmu."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="auth-field">
              Nama
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={60}
                required
              />
            </label>
          )}

          <label className="auth-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Memproses..."
              : isRegister
                ? "Daftar"
                : "Masuk"}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={switchMode}>
          {isRegister
            ? "Sudah punya akun? Masuk"
            : "Belum punya akun? Daftar"}
        </button>
      </div>
    </div>
  );
}
