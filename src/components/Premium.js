import React from "react";

export default function Premium() {
  const handleUpgrade = () => {
    alert("Upgrade to Premium (Stripe integration placeholder)");
  };

  return (
    <button className="premium-btn" onClick={handleUpgrade}>
      Upgrade
    </button>
  );
}
