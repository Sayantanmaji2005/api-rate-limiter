import { useState, useContext } from "react";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await API.post("/auth/login", { email, password });
      await login(res.data.token);
      navigate("/dashboard");
    } catch (error) {
      setError(getApiErrorMessage(error, "Invalid credentials or server unavailable."));
    }
  };

  return (
    <section className="panel narrow reveal">
      <h2>Welcome Back</h2>
      <p className="muted">Sign in to monitor traffic, limits, and analytics.</p>
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
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary">Login</button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="muted">
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
};

export default Login;
