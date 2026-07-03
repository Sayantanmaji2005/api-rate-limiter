document.addEventListener("DOMContentLoaded", async () => {
  const me = await fetchMe();
  renderNavbar(me.user);
  if (me.user) {
    window.location.href = "/dashboard";
    return;
  }

  const form = document.getElementById("loginForm");
  const errorElement = document.getElementById("loginError");
  const submitButton = document.getElementById("loginSubmit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.classList.add("hidden");
    submitButton.disabled = true;

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        withAuth: false,
        body: { email, password }
      });
      setToken(response.data.token);
      window.location.href = "/dashboard";
    } catch (error) {
      errorElement.textContent = getApiErrorMessage(
        error,
        "Invalid credentials or server unavailable."
      );
      errorElement.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
    }
  });
});
