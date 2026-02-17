import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/dashboard" className="brand">
          RateLimiter Pro
        </Link>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          {user?.role === "ADMIN" && <Link to="/admin">Admin</Link>}
        </div>

        <div className="nav-actions">
          {user ? (
            <button onClick={logout} className="btn btn-outline">
              Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
