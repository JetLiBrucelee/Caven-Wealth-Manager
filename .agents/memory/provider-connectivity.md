---
name: Provider connectivity verification
description: Verify external API connectivity from the actual application runtime.
---

Check provider reachability from the workspace's application runtime before concluding an external API is unavailable.

**Why:** Twelve Data metadata requests failed from the separate code-execution sandbox while equivalent requests from the workspace's Node runtime succeeded.

**How to apply:** Use a server-side probe with safe, minimal output; keep credentials out of logs. A failure from the separate sandbox does not establish that the running app cannot reach the provider.
