---
name: Market data display rights
description: The user's confirmation about Twelve Data customer-display rights.
---

The user confirmed that customer-display rights with Twelve Data are arranged.

**Why:** The user answered “Display rights are arranged” when asked whether they had arranged customer-display rights with Twelve Data.

**How to apply:** Treat this as the user's confirmation, not as verification of particular instrument coverage or the current subscription. Verify coverage before enabling additional instruments.

The user chose “Stocks and gold only” after being told this option also requires customer-display rights covering gold.

**Why:** The tested Dow and Nasdaq index symbols were unavailable from the selected feed, while the requested stocks and gold spot were supported; the user approved the supported subset.

**How to apply:** Omit unsupported Dow and Nasdaq rows. Do not silently substitute ETFs or add indices without a new request and verified coverage.

The user says they cannot obtain the Twelve Data API key again because “it's once.”

**Why:** The user explicitly asked to remember this constraint during the project handoff.

**How to apply:** Preserve the existing Twelve Data secret. Reuse it through secure project Secrets when moving the app; do not assume a replacement can be obtained, rotate/delete it, or put its value into GitHub, chat, instructions or memory.
