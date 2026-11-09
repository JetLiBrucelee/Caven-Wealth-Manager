import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { ADMIN_CREDIT_REFERENCE } from "../shared/institution";

export async function verifyAdminCreditForms(input: {
  base: string; cookie: string; customerId: number; accountNumber: string;
}) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ baseURL: input.base, viewport: { width: 1440, height: 1000 } });
  try {
    // Reuse the authenticated test admin's real session, without bypassing authorization.
    const equals = input.cookie.indexOf("=");
    await context.addCookies([{ name: input.cookie.slice(0, equals), value: input.cookie.slice(equals + 1), url: input.base }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const checkReference = async (testId: string, readOnly = true) => {
      const field = page.getByTestId(testId);
      assert.equal(await field.evaluate((element: HTMLInputElement) => element.readOnly), readOnly);
      if (readOnly) assert.equal(await field.inputValue(), ADMIN_CREDIT_REFERENCE);
    };
    const selectType = async (testId: string, name: string) => {
      await page.getByTestId(testId).click();
      await page.getByRole("option", { name, exact: true }).click();
    };
    const closeDialog = async () => {
      await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    };
    await page.goto("/admin/transactions");
    await page.getByTestId("button-add-transaction").click();
    assert.match(await page.getByTestId("text-manual-ledger-notice").innerText(), /does not send money/);
    await page.getByTestId("select-type").click();
    assert.deepEqual(await page.getByRole("option").allTextContents(), [
      "Credit", "Deposit", "Debit", "Withdrawal", "Wire transfer", "External transfer", "Internal transfer", "Bill payment",
    ]);
    await page.keyboard.press("Escape");
    await checkReference("input-reference");
    await selectType("select-type", "Deposit");
    await checkReference("input-reference");
    await selectType("select-type", "Debit");
    await checkReference("input-reference", false);
    await page.getByTestId("input-reference").fill("NORMAL-UI-DEBIT");
    await selectType("select-type", "Credit");
    await checkReference("input-reference");
    await page.getByTestId("select-customer").click();
    await page.getByRole("option").filter({ hasText: input.accountNumber }).click();
    await page.getByTestId("input-amount").fill("0.01");
    await page.getByTestId("input-description").fill("Verification admin credit form");
    await mkdir("generated-artifacts", { recursive: true });
    await page.screenshot({ path: "generated-artifacts/admin-credit-reference.png", fullPage: true });
    const response = page.waitForResponse((reply) => reply.url().endsWith("/api/transactions") && reply.request().method() === "POST");
    await page.getByRole("button", { name: "Create Transaction", exact: true }).click();
    const createdResponse = await response;
    assert.equal(createdResponse.status(), 201);
    const created = await createdResponse.json();
    assert.equal(created.reference, ADMIN_CREDIT_REFERENCE);
    assert.equal(created.customerId, input.customerId);
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    const outgoingEntries: { id: number; type: string; label: string }[] = [];
    for (const [type, label] of [
      ["debit", "Debit"], ["withdrawal", "Withdrawal"], ["wire_transfer", "Wire transfer"],
      ["external_transfer", "External transfer"], ["internal_transfer", "Internal transfer"], ["bill_pay", "Bill payment"],
    ]) {
      await page.getByTestId("button-add-transaction").click();
      await checkReference("input-reference");
      await selectType("select-type", label);
      await checkReference("input-reference", false);
      assert.equal(await page.getByTestId("input-reference").inputValue(), "");
      const reference = `NORMAL-UI-${type}-${created.id}`;
      await page.getByTestId("input-reference").fill(reference);
      // Switching through deposit must not replace the stored outgoing reference.
      await selectType("select-type", "Deposit");
      await checkReference("input-reference");
      await selectType("select-type", label);
      assert.equal(await page.getByTestId("input-reference").inputValue(), reference);
      await page.getByTestId("select-customer").click();
      await page.getByRole("option").filter({ hasText: input.accountNumber }).click();
      await page.getByTestId("input-amount").fill("0.01");
      await page.getByTestId("input-description").fill(`Verification manual ${label}`);
      const outgoingResponse = page.waitForResponse((reply) => reply.url().endsWith("/api/transactions") && reply.request().method() === "POST");
      await page.getByTestId("button-submit-transaction").click();
      const reply = await outgoingResponse;
      assert.equal(reply.status(), 201);
      const entry = await reply.json();
      assert.equal(entry.type, type);
      assert.equal(entry.reference, reference);
      assert.equal(entry.institutionAccountReference, null);
      assert.equal(entry.customerId, input.customerId);
      assert.equal(entry.status, "completed");
      outgoingEntries.push({ id: entry.id, type, label });
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    // A reload proves that filters work against the persisted explicit types.
    await page.reload();
    await page.getByTestId(`row-transaction-${outgoingEntries.at(-1)!.id}`).waitFor();
    await page.getByTestId("button-toggle-filters").click();
    await page.getByTestId("filter-type").click();
    assert.deepEqual(await page.getByRole("option").allTextContents(), [
      "All types", "Credit", "Deposit", "Debit", "Withdrawal", "Wire transfer", "External transfer", "Internal transfer", "Bill payment",
    ]);
    await page.keyboard.press("Escape");
    await page.getByTestId("filter-customer").click();
    const customerResponse = await context.request.get(`/api/customers/${input.customerId}`);
    assert.equal(customerResponse.status(), 200);
    const customer = await customerResponse.json();
    await page.getByRole("option", { name: `${customer.firstName} ${customer.lastName}`, exact: true }).click();
    for (const entry of outgoingEntries) {
      await selectType("filter-type", entry.label);
      await page.getByTestId(`row-transaction-${entry.id}`).waitFor();
      assert.ok(await page.getByTestId(`row-transaction-${entry.id}`).getByText(entry.label, { exact: true }).isVisible());
      for (const other of outgoingEntries.filter((other) => other.id !== entry.id)) {
        assert.equal(await page.getByTestId(`row-transaction-${other.id}`).count(), 0);
      }
      assert.equal(await page.getByTestId(`row-transaction-${created.id}`).count(), 0);
    }
    await selectType("filter-type", "Credit");
    await page.getByTestId(`row-transaction-${created.id}`).waitFor();
    for (const entry of outgoingEntries) assert.equal(await page.getByTestId(`row-transaction-${entry.id}`).count(), 0);
    await selectType("filter-type", "All types");
    for (const entry of outgoingEntries) await page.getByTestId(`row-transaction-${entry.id}`).waitFor();
    await page.screenshot({ path: "generated-artifacts/admin-outgoing-filters.png", fullPage: true });

    await page.goto("/admin/customers");
    await page.getByTestId(`button-history-customer-${input.customerId}`).click();
    await checkReference("input-history-reference");
    await selectType("select-history-type", "Deposit");
    await checkReference("input-history-reference");
    await selectType("select-history-type", "Debit");
    await checkReference("input-history-reference", false);
    await closeDialog();
    await page.getByTestId(`button-fund-customer-${input.customerId}`).click();
    await checkReference("input-fund-reference");
    await closeDialog();
    await page.getByTestId("button-add-customer").click();
    await page.getByTestId("input-balance").fill("1.00");
    assert.ok((await page.getByRole("dialog").innerText()).includes(`Credit transaction reference: ${ADMIN_CREDIT_REFERENCE}`));
    await closeDialog();
    await page.goto("/admin/dashboard");
    await page.getByTestId("button-create-full-user").click();
    await page.getByTestId("input-opening-balance").fill("1.00");
    assert.ok((await page.getByRole("dialog").innerText()).includes(`Credit transaction reference: ${ADMIN_CREDIT_REFERENCE}`));
    assert.deepEqual(errors, []);
    return created;
  } finally {
    await context.close();
    await browser.close();
  }
}
