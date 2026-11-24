import { mkdirSync } from "node:fs";
import { test as base } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  signIn,
  type TestUser,
} from "./supabase";

/**
 * One signed-in Supabase account per worker (and project). Tests reset its
 * data with resetAccount() instead of creating and signing in a new user each
 * time, which would hit Supabase's verification rate limit.
 */
export const test = base.extend<object, { account: TestUser }>({
  account: [
    async ({ browser }, provide, workerInfo) => {
      const user = await createTestUser({ onboarded: true });
      const dir = "test-results/.auth";
      mkdirSync(dir, { recursive: true });
      const statePath = `${dir}/${workerInfo.project.name}-${workerInfo.workerIndex}.json`;
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      const page = await context.newPage();
      await signIn(page, user);
      await page.waitForURL(/\/registrar$/);
      await context.storageState({ path: statePath });
      await context.close();
      await provide({ ...user, statePath });
      await deleteTestUser(user);
    },
    { scope: "worker" },
  ],
  storageState: async ({ account }, provide) => {
    await provide(account.statePath);
  },
});

export { expect } from "@playwright/test";
