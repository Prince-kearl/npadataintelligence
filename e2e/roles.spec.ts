import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = "Npa-E2E-Password-123!";

const users = {
  collector: "collector-e2e@npa.test",
  analyst: "analyst-e2e@npa.test",
  admin: "admin-e2e@npa.test",
} as const;

test.skip(!url || !serviceKey, "Local Supabase credentials are required");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const [role, email] of Object.entries(users)) {
    let user = existing.data.users.find((candidate) => candidate.email === email);
    if (!user) {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    if (!user) throw new Error(`Unable to seed ${email}`);
    const profile = await admin.from("profiles").update({ status: "active" }).eq("id", user.id);
    if (profile.error) throw profile.error;
    await admin.from("user_roles").delete().eq("user_id", user.id);
    const assignment = await admin.from("user_roles").insert({ user_id: user.id, role });
    if (assignment.error) throw assignment.error;
  }
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("collector sees collection workflow but not elevated intelligence", async ({ page }) => {
  await login(page, users.collector);
  await expect(page.getByText("Submit Incident", { exact: true })).toBeVisible();
  await expect(page.getByText("Records", { exact: true })).toBeVisible();
  await expect(page.getByText("Analytics", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Admin Panel", { exact: true })).toHaveCount(0);
});

test("analyst can reach records, analytics and reports", async ({ page }) => {
  await login(page, users.analyst);
  for (const label of ["Records", "Analytics", "Reports"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "Incident Records" })).toBeVisible();
});

test("administrator can reach the administration panel", async ({ page }) => {
  await login(page, users.admin);
  await page.getByText("Admin Panel", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "System Administration" })).toBeVisible();
});
