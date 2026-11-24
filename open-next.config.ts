// OpenNext for Cloudflare. No incremental cache (R2): the app has no ISR pages,
// and R2 would require a payment method on the Cloudflare account.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
