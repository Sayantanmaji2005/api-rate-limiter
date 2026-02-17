import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <section className="panel narrow route-loader reveal">
        <div className="loader-dot" />
        <h3>Loading Workspace</h3>
        <p className="muted">Fetching your profile and access controls...</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default ProtectedRoute;
