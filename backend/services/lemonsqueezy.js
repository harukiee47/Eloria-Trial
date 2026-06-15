import "dotenv/config";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

/**
 * Creates a Lemon Squeezy hosted checkout session for the given variant,
 * embedding the Firebase UID so the webhook can later identify the user.
 *
 * Docs: https://docs.lemonsqueezy.com/api/checkouts
 */
export async function createCheckout({ variantId, uid, email }) {
  const response = await fetch(`${LS_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: email || undefined,
            custom: {
              uid, // Firebase UID — read back in the webhook
            },
          },
          product_options: {
            redirect_url: process.env.CHECKOUT_REDIRECT_URL || undefined,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: String(process.env.LEMONSQUEEZY_STORE_ID),
            },
          },
          variant: {
            data: {
              type: "variants",
              id: String(variantId),
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lemon Squeezy checkout error: ${response.status} ${errText}`);
  }

  const json = await response.json();
  return json.data.attributes.url;
}