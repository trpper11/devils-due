/* =====================================================================
   Devil's Due — IN-APP PURCHASE config (coin packs).
   This is a static site, so real-money fulfillment needs a payment link
   you control. Drop a Payment Link here (Stripe Payment Link, Gumroad,
   Ko-fi, Lemon Squeezy, Paddle…) per pack and it goes live instantly.

   - buyUrl: "" (empty)  -> the pack shows "coming soon" (no purchase).
   - buyUrl: "https://…" -> clicking the pack opens that checkout in a new tab.

   NOTE: coins earned by PLAYING work with no setup. Packs are optional
   monetization; until a buyUrl is set they are display-only. After a buyer
   pays, credit them via a redeem code or a Stripe/webhook flow you host.
   ===================================================================== */
window.SHOP_CONFIG = {
  // a short note shown in the coin-pack section of the shop
  note: "Coin packs are optional — you can earn every coin just by playing. Real-money packs activate once a payment link is set in shop-config.js.",
  packs: [
    { id: "pack_s", name: "Pouch of Souls", coins: 500, priceLabel: "$0.99", buyUrl: "" },
    { id: "pack_m", name: "Sack of Souls", coins: 1500, priceLabel: "$2.49", buyUrl: "", best: false },
    { id: "pack_l", name: "Hoard of Souls", coins: 4000, priceLabel: "$4.99", buyUrl: "", best: true },
    { id: "pack_xl", name: "Devil's Vault", coins: 12000, priceLabel: "$9.99", buyUrl: "" },
  ],
};
