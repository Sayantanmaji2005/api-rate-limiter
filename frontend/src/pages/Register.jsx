import { useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await API.post("/auth/register", { email, password });
      setApiKey(res.data.apiKey);
    } catch (error) {
      setError(getApiErrorMessage(error, "Registration failed. Backend may be unavailable."));
    }
  };

  return (
    <section className="panel narrow reveal">
      <h2>Create Account</h2>
      <p className="muted">Start with FREE tier and upgrade anytime.</p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Email
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Choose a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary">{apiKey ? "Registered" : "Register"}</button>
        {error && <p className="error">{error}</p>}
      </form>
      {apiKey && (
        <div className="callout success">
          <p>API key generated:</p>
          <code>{apiKey}</code>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/login")}>
            Continue to login
          </button>
        </div>
      )}
    </section>
  );
};

export default Register;
