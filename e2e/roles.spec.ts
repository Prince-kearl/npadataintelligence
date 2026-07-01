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
  let collectorId = "";
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
    if (role === "collector") collectorId = user.id;
  }
  const incident = await admin.from("incidents").upsert({
    reference_code: "INC-E2E-0001",
    reporter_id: collectorId,
    reporter_name: "E2E Collector",
    incident_date: "2026-06-20",
    region: "Greater Accra",
    district: "Tema Metropolitan",
    location_name: "E2E Tema Depot",
    category: "Spill",
    description: "Deterministic incident used by role and export browser tests.",
    severity: "medium",
    status: "submitted",
    submission_state: "complete",
  }, { onConflict: "reference_code" });
  if (incident.error) throw incident.error;
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
  await expect(page.getByRole("heading", { name: "Incident Review Desk" })).toBeVisible();
  for (const label of ["Records", "Analytics", "Reports"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "Incident Records" })).toBeVisible();
});

test("administrator can reach the administration panel", async ({ page }) => {
  await login(page, users.admin);
  await page.getByText("Admin Panel", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible();
});

test("mobile records use case cards instead of the desktop table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, users.analyst);
  await page.goto("/records");
  await expect(page.getByRole("link", { name: /Open case workspace/i }).first()).toBeVisible();
  await expect(page.locator("table").first()).toBeHidden();
});

test("analyst downloads genuine XLSX and PDF files with history entries", async ({ page }) => {
  await login(page, users.analyst);
  await page.goto("/reports");

  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export XLSX" }).click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  await expect(page.getByText(xlsx.suggestedFilename(), { exact: true })).toBeVisible();

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByText(pdf.suggestedFilename(), { exact: true })).toBeVisible();
});

test("administrator must confirm account suspension", async ({ page }) => {
  await login(page, users.admin);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Suspend" }).first().click();
  await expect(page.getByRole("alertdialog")).toContainText("Suspend this account?");
  await page.getByRole("button", { name: "Cancel" }).click();
});
