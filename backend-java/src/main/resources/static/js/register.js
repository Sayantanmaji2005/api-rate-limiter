document.addEventListener("DOMContentLoaded", async () => {
  const me = await fetchMe();
  renderNavbar(me.user);
  if (me.user) {
    window.location.href = "/dashboard";
    return;
  }

  const form = document.getElementById("registerForm");
  const errorElement = document.getElementById("registerError");
  const apiKeyPanel = document.getElementById("apiKeyPanel");
  const apiKeyValue = document.getElementById("apiKeyValue");
  const submitButton = document.getElementById("registerSubmit");
  const continueButton = document.getElementById("continueToLogin");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.classList.add("hidden");
    submitButton.disabled = true;

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await apiRequest("/auth/register", {
        method: "POST",
        withAuth: false,
        body: { email, password }
      });

      apiKeyValue.textContent = response.data.apiKey || "N/A";
      apiKeyPanel.classList.remove("hidden");
      submitButton.textContent = "Registered";
      submitButton.disabled = true;
    } catch (error) {
      errorElement.textContent = getApiErrorMessage(
        error,
        "Registration failed. Backend may be unavailable."
      );
      errorElement.classList.remove("hidden");
      submitButton.disabled = false;
    }
  });

  continueButton.addEventListener("click", () => {
    window.location.href = "/login";
  });
});
