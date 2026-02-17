export const getApiErrorMessage = (error, fallback = "Request failed.") => {
  const message = error?.response?.data?.msg || error?.response?.data?.message;
  if (message) return String(message);
  return fallback;
};
