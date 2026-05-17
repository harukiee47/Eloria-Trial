export async function sendMessageToAMK(message) {
  const res = await fetch("http://localhost:5001/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  let data;

  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  const replyText =
    data?.reply ||
    data?.message ||
    "Eloria is unable to respond right now.";

  return replyText;
}
