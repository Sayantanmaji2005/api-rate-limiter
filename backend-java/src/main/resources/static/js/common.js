const REQUEST_TIMEOUT_MS = 30000;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

function getApiErrorMessage(error, fallback = "Request failed.") {
  const message = error?.response?.data?.msg || error?.response?.data?.message;
  if (message) {
    return String(message);
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    withAuth = true,
    retry = true
  } = options;

  const token = getToken();
  const requestHeaders = { ...headers };
  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }
  if (withAuth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const data = await parseJsonSafe(response);
    if (!response.ok) {
      const error = new Error(
        data?.msg || data?.message || `Request failed with status ${response.status}`
      );
      error.response = {
        status: response.status,
        data: data || {},
        headers: response.headers
      };
      throw error;
    }

    return {
      data: data || {},
      headers: response.headers,
      status: response.status
    };
  } catch (error) {
    const isTransient =
      error?.name === "AbortError" ||
      String(error?.message || "").toLowerCase().includes("failed to fetch");

    if (retry && isTransient) {
      await sleep(1200);
      return apiRequest(path, { ...options, retry: false });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMe() {
  const token = getToken();
  if (!token) {
    return { user: null, apiKey: null };
  }

  try {
    const response = await apiRequest("/auth/me");
    return {
      user: response.data?.user || null,
      apiKey: response.data?.apiKey || null
    };
  } catch {
    clearToken();
    return { user: null, apiKey: null };
  }
}

function renderNavbar(user) {
  const navLinks = document.getElementById("navLinks");
  const navActions = document.getElementById("navActions");
  if (!navLinks || !navActions) {
    return;
  }

  navLinks.innerHTML = "";
  navActions.innerHTML = "";

  const dashboardLink = document.createElement("a");
  dashboardLink.href = "/dashboard";
  dashboardLink.textContent = "Dashboard";
  navLinks.appendChild(dashboardLink);

  if (user?.role === "ADMIN") {
    const adminLink = document.createElement("a");
    adminLink.href = "/admin";
    adminLink.textContent = "Admin";
    navLinks.appendChild(adminLink);
  }

  if (user) {
    const logoutButton = document.createElement("button");
    logoutButton.className = "btn btn-outline";
    logoutButton.textContent = "Logout";
    logoutButton.type = "button";
    logoutButton.addEventListener("click", () => {
      clearToken();
      window.location.href = "/login";
    });
    navActions.appendChild(logoutButton);
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.className = "btn btn-outline";
  loginLink.href = "/login";
  loginLink.textContent = "Login";
  navActions.appendChild(loginLink);

  const registerLink = document.createElement("a");
  registerLink.className = "btn btn-primary";
  registerLink.href = "/register";
  registerLink.textContent = "Register";
  navActions.appendChild(registerLink);
}

async function requireUser(options = {}) {
  const { adminOnly = false } = options;
  const me = await fetchMe();
  renderNavbar(me.user);
  if (!me.user) {
    window.location.href = "/login";
    return null;
  }
  if (adminOnly && me.user.role !== "ADMIN") {
    window.location.href = "/dashboard";
    return null;
  }
  return me;
}
