import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { customers, type InsertCustomer } from "@shared/schema";
import { INSTITUTION } from "@shared/institution";

export function generateCustomerAccountNumber() {
  return String(randomInt(100_000_000_000, 1_000_000_000_000));
}

export async function allocateCustomerAccount(
  tx: any,
  data: Omit<InsertCustomer, "accountNumber">,
  generate = generateCustomerAccountNumber,
) {
  const [conflict] = await tx.select({ id: customers.id }).from(customers)
    .where(eq(customers.accountNumber, INSTITUTION.accountReference)).limit(1);
  if (conflict) throw new Error("The institution account reference is assigned to an existing customer. Review that account before creating new accounts; no existing number was changed.");
  for (let attempt = 0; attempt < 10; attempt++) {
    const accountNumber = generate();
    if (!/^\d{12}$/.test(accountNumber) || accountNumber === INSTITUTION.accountReference) continue;
    // Only an account-number collision is retried; duplicate usernames still fail.
    const [customer] = await tx.insert(customers).values({ ...data, accountNumber })
      .onConflictDoNothing({ target: customers.accountNumber }).returning();
    if (customer) return customer;
  }
  throw new Error("Could not allocate a unique account number. Please try again.");
}
