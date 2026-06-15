export const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5001"
    : "https://eloria-trial.onrender.com";