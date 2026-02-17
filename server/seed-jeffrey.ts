import { db } from "./db";
import { customers, transactions, accessCodes, transfers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedJeffreyAnderson() {
  const existing = await db.select().from(customers).where(eq(customers.username, "LeoJeff17"));
  if (existing.length > 0) {
    const jeff = existing[0];
    if (jeff.balance !== "18276999.30") {
      await db.update(customers).set({ balance: "18276999.30" }).where(eq(customers.id, jeff.id));
      console.log("[seed] Fixed Jeffrey Anderson balance to $18,276,999.30");
    }
    const existingTransfers = await db.select().from(transfers).where(eq(transfers.customerId, jeff.id));
    if (existingTransfers.length === 0) {
      await seedJeffreyTransfers(jeff.id);
      console.log("[seed] Added 19 transfers for Jeffrey Anderson");
    }
    console.log("[seed] Jeffrey Anderson already exists, skipping seed.");
    return;
  }

  console.log("[seed] Creating Jeffrey Anderson account...");

  const hashedPassword = await bcrypt.hash("Jeff0817@@@", 10);

  const [jeff] = await db.insert(customers).values({
    firstName: "Jeffrey",
    lastName: "Anderson",
    username: "LeoJeff17",
    password: hashedPassword,
    email: null,
    phone: null,
    address: "1527 Honey Suckle Ct",
    city: "Pleasanton",
    state: "CA",
    zipCode: "94588",
    country: "United States",
    gender: "male",
    accountNumber: "6856764509",
    routingNumber: "121000358",
    accountType: "business",
    balance: "18276999.30",
    status: "active",
    hasDebitCard: true,
    hasCreditCard: true,
    memberSince: new Date("2024-03-15T00:00:00.000Z"),
  }).returning();

  const jeffId = jeff.id;

  const txns = [
    { type: "debit", amount: "425000.00", description: "PO-6341 - Purchase: Blowout Preventer Stack Assembly | Gulf Coast Drilling Solutions | JPMorgan Chase Bank | Acct: 3281047562 | Routing: 021000021 | SWIFT: CHASUS33", date: new Date("2024-04-08T07:22:00.000Z"), reference: "PO-6341", beneficiary: "Gulf Coast Drilling Solutions", beneficiaryBank: "JPMorgan Chase Bank", beneficiaryAccount: "3281047562" },
    { type: "credit", amount: "189500.00", description: "INV-6290 - Sale: Subsea Wellhead Connector Kit | Permian Basin Equipment Co. | Wells Fargo Bank | Acct: 7610283945 | Routing: 121000248 | SWIFT: WFBIUS6S", date: new Date("2024-04-22T15:40:00.000Z"), reference: "INV-6290", beneficiary: "Permian Basin Equipment Co.", beneficiaryBank: "Wells Fargo Bank", beneficiaryAccount: "7610283945" },
    { type: "debit", amount: "328500.00", description: "INV-7821 - Purchase: Subsea Manifold Assembly | Abyssal Dynamics Inc. | Pacific Maritime Bank | Acct: 4001122334 | Routing: 122000496 | SWIFT: PAMBUS4S", date: new Date("2024-05-10T14:30:00.000Z"), reference: "INV-7821", beneficiary: "Abyssal Dynamics Inc.", beneficiaryBank: "Pacific Maritime Bank", beneficiaryAccount: "4001122334" },
    { type: "credit", amount: "198000.00", description: "SALE-8850 - Sale: ROV Tether Management System | Oceanic Robotics Ltd. | Harbor State Bank | Acct: 9876540123 | Routing: 065305436 | SWIFT: HARSUS3A", date: new Date("2024-05-12T09:15:00.000Z"), reference: "SALE-8850", beneficiary: "Oceanic Robotics Ltd.", beneficiaryBank: "Harbor State Bank", beneficiaryAccount: "9876540123" },
    { type: "debit", amount: "156750.00", description: "PO-8103 - Purchase: High-Pressure Drilling Mud Pump | Texas Oilfield Supply Corp. | Bank of America | Acct: 5023891764 | Routing: 111000025 | SWIFT: BOFAUS3N", date: new Date("2024-06-03T16:45:00.000Z"), reference: "PO-8103", beneficiary: "Texas Oilfield Supply Corp.", beneficiaryBank: "Bank of America", beneficiaryAccount: "5023891764" },
    { type: "credit", amount: "542000.00", description: "SALE-9021 - Sale: Deepwater ROV Intervention System | Bayou Offshore Services LLC | Regions Bank | Acct: 4187620935 | Routing: 062005690 | SWIFT: UPNBUS44", date: new Date("2024-07-15T11:30:00.000Z"), reference: "SALE-9021", beneficiary: "Bayou Offshore Services LLC", beneficiaryBank: "Regions Bank", beneficiaryAccount: "4187620935" },
    { type: "debit", amount: "287350.00", description: "PO-9415 - Purchase: Offshore Christmas Tree Valve Assembly | Lone Star Petroleum Equipment | Frost Bank | Acct: 6034718290 | Routing: 114000093 | SWIFT: FRSTUS44", date: new Date("2024-08-19T08:10:00.000Z"), reference: "PO-9415", beneficiary: "Lone Star Petroleum Equipment", beneficiaryBank: "Frost Bank", beneficiaryAccount: "6034718290" },
    { type: "credit", amount: "378200.00", description: "SALE-1087 - Sale: Hydraulic Workover Unit Components | Bakken Formation Resources Inc. | U.S. Bank | Acct: 8291034567 | Routing: 091000022 | SWIFT: USBKUS44", date: new Date("2024-09-05T13:55:00.000Z"), reference: "SALE-1087", beneficiary: "Bakken Formation Resources Inc.", beneficiaryBank: "U.S. Bank", beneficiaryAccount: "8291034567" },
    { type: "debit", amount: "92800.00", description: "PO-1124 - Purchase: PDC Drill Bit Set - 12-1/4 inch | Oklahoma Drill Technologies | BOK Financial | Acct: 2047381956 | Routing: 103900036 | SWIFT: BOKFUS41", date: new Date("2024-09-28T10:20:00.000Z"), reference: "PO-1124", beneficiary: "Oklahoma Drill Technologies", beneficiaryBank: "BOK Financial", beneficiaryAccount: "2047381956" },
    { type: "debit", amount: "463500.00", description: "PO-1298 - Purchase: Topside Separation Module | Midland Energy Systems Inc. | Comerica Bank | Acct: 9182730465 | Routing: 072000096 | SWIFT: MNBDUS33", date: new Date("2024-10-14T17:05:00.000Z"), reference: "PO-1298", beneficiary: "Midland Energy Systems Inc.", beneficiaryBank: "Comerica Bank", beneficiaryAccount: "9182730465" },
    { type: "credit", amount: "215000.00", description: "SALE-1342 - Sale: Gas Compression Skid Package | Eagle Ford Industrial Co. | Capital One Bank | Acct: 3058172946 | Routing: 065000090 | SWIFT: HIBKUS44", date: new Date("2024-11-07T14:35:00.000Z"), reference: "SALE-1342", beneficiary: "Eagle Ford Industrial Co.", beneficiaryBank: "Capital One Bank", beneficiaryAccount: "3058172946" },
    { type: "debit", amount: "679500.00", description: "PO-1510 - Purchase: FPSO Turret Mooring Assembly | Houston Subsea Engineering | Zions Bank | Acct: 7429061538 | Routing: 124000054 | SWIFT: ZFNBUS55", date: new Date("2024-11-22T08:00:00.000Z"), reference: "PO-1510", beneficiary: "Houston Subsea Engineering", beneficiaryBank: "Zions Bank", beneficiaryAccount: "7429061538" },
    { type: "credit", amount: "145800.00", description: "SALE-1623 - Sale: Wellhead Flow Control Valves | Red River Oilfield Services | First Horizon Bank | Acct: 6501829374 | Routing: 084000026 | SWIFT: FTNBUS44", date: new Date("2024-12-10T11:25:00.000Z"), reference: "SALE-1623", beneficiary: "Red River Oilfield Services", beneficiaryBank: "First Horizon Bank", beneficiaryAccount: "6501829374" },
    { type: "debit", amount: "312000.00", description: "PO-1780 - Purchase: Coiled Tubing Unit with BHA | Panhandle Drilling Equipment LLC | BBVA USA | Acct: 8173024596 | Routing: 062001186 | SWIFT: BBVAUS44", date: new Date("2025-01-08T15:30:00.000Z"), reference: "PO-1780", beneficiary: "Panhandle Drilling Equipment LLC", beneficiaryBank: "BBVA USA", beneficiaryAccount: "8173024596" },
    { type: "credit", amount: "498750.00", description: "SALE-1855 - Sale: Offshore Pipeline Laying Equipment | Williston Basin Energy Corp. | Truist Bank | Acct: 2946107385 | Routing: 053101121 | SWIFT: SNTRUS3A", date: new Date("2025-01-25T09:00:00.000Z"), reference: "SALE-1855", beneficiary: "Williston Basin Energy Corp.", beneficiaryBank: "Truist Bank", beneficiaryAccount: "2946107385" },
    { type: "debit", amount: "187400.00", description: "PO-2010 - Purchase: Mud Logging Sensor Array System | Tulsa Well Services Inc. | Arvest Bank | Acct: 5180394726 | Routing: 082000549 | SWIFT: ARVTUS44", date: new Date("2025-03-12T16:45:00.000Z"), reference: "PO-2010", beneficiary: "Tulsa Well Services Inc.", beneficiaryBank: "Arvest Bank", beneficiaryAccount: "5180394726" },
    { type: "credit", amount: "356200.00", description: "SALE-2198 - Sale: Subsea Umbilical Distribution Hub | Kern River Energy Solutions | Silicon Valley Bank | Acct: 4062917385 | Routing: 121140399 | SWIFT: SVBKUS6S", date: new Date("2025-05-06T13:15:00.000Z"), reference: "SALE-2198", beneficiary: "Kern River Energy Solutions", beneficiaryBank: "Silicon Valley Bank", beneficiaryAccount: "4062917385" },
    { type: "debit", amount: "128900.00", description: "PO-2445 - Purchase: Tri-Cone Roller Bit Assembly | North Dakota Oilfield Supplies | Gate City Bank | Acct: 7301824596 | Routing: 091407429 | SWIFT: GTCTUS41", date: new Date("2025-07-21T08:50:00.000Z"), reference: "PO-2445", beneficiary: "North Dakota Oilfield Supplies", beneficiaryBank: "Gate City Bank", beneficiaryAccount: "7301824596" },
    { type: "credit", amount: "245600.00", description: "SALE-2710 - Sale: Electric Submersible Pump System | Shreveport Petroleum Technology | Origin Bank | Acct: 9028374615 | Routing: 065403626 | SWIFT: CMRCUS44", date: new Date("2025-09-15T17:40:00.000Z"), reference: "SALE-2710", beneficiary: "Shreveport Petroleum Technology", beneficiaryBank: "Origin Bank", beneficiaryAccount: "9028374615" },
    { type: "debit", amount: "534000.00", description: "PO-2930 - Purchase: Riser Tensioning System | Odessa Production Equipment Co. | WestStar Bank | Acct: 6183029475 | Routing: 112200407 | SWIFT: WSTRUS41", date: new Date("2025-11-03T14:20:00.000Z"), reference: "PO-2930", beneficiary: "Odessa Production Equipment Co.", beneficiaryBank: "WestStar Bank", beneficiaryAccount: "6183029475" },
    { type: "credit", amount: "167500.00", description: "SALE-3101 - Sale: Casing Running Tool Package | Bakersfield Energy Supply Inc. | Bank of the Sierra | Acct: 3947102856 | Routing: 121137027 | SWIFT: BKSIUS61", date: new Date("2026-01-12T07:10:00.000Z"), reference: "SALE-3101", beneficiary: "Bakersfield Energy Supply Inc.", beneficiaryBank: "Bank of the Sierra", beneficiaryAccount: "3947102856" },
    { type: "debit", amount: "275800.00", description: "PO-3205 - Purchase: Mud Circulation System Upgrade | Corpus Christi Marine Systems | Prosperity Bank | Acct: 8214063597 | Routing: 113122655 | SWIFT: PRSPUS44", date: new Date("2026-02-05T10:30:00.000Z"), reference: "PO-3205", beneficiary: "Corpus Christi Marine Systems", beneficiaryBank: "Prosperity Bank", beneficiaryAccount: "8214063597" },
  ];

  for (const txn of txns) {
    await db.insert(transactions).values({
      customerId: jeffId,
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      date: txn.date,
      status: "completed",
      reference: txn.reference,
      beneficiary: txn.beneficiary,
      beneficiaryBank: txn.beneficiaryBank,
      beneficiaryAccount: txn.beneficiaryAccount,
    });
  }

  await db.insert(accessCodes).values({
    code: "782916",
    customerId: jeffId,
    status: "active",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

  await seedJeffreyTransfers(jeffId);

  console.log(`[seed] Jeffrey Anderson created successfully (ID: ${jeffId}) with 22 transactions, 19 transfers, and access code 782916`);
}

async function seedJeffreyTransfers(customerId: number) {
  const transferData = [
    { type: "wire_transfer", amount: "425000.00", description: "Wire payment for BOP Stack Assembly - PO-6341", status: "approved", recipientName: "Gulf Coast Drilling Solutions", recipientBank: "JPMorgan Chase Bank", recipientAccount: "3281047562", recipientRoutingNumber: "021000021", swiftCode: "CHASUS33", bankAddress: "383 Madison Ave, New York, NY 10179", memo: "Invoice #INV-GCD-6341", purpose: "Equipment purchase", referenceNumber: "WT-20240408-001", createdAt: new Date("2024-04-08T07:22:00.000Z") },
    { type: "wire_transfer", amount: "328500.00", description: "Wire payment for Subsea Manifold Assembly - INV-7821", status: "approved", recipientName: "Abyssal Dynamics Inc.", recipientBank: "Pacific Maritime Bank", recipientAccount: "4001122334", recipientRoutingNumber: "122000496", swiftCode: "PAMBUS4S", bankAddress: "1200 Harbor Blvd, Long Beach, CA 90802", memo: "Subsea equipment procurement", purpose: "Capital equipment", referenceNumber: "WT-20240510-002", createdAt: new Date("2024-05-10T14:30:00.000Z") },
    { type: "external_transfer", amount: "156750.00", description: "Transfer for High-Pressure Drilling Mud Pump - PO-8103", status: "approved", recipientName: "Texas Oilfield Supply Corp.", recipientBank: "Bank of America", recipientAccount: "5023891764", recipientRoutingNumber: "111000025", swiftCode: "BOFAUS3N", bankAddress: "100 N Tryon St, Charlotte, NC 28255", memo: "Drilling equipment order", referenceNumber: "ET-20240603-003", createdAt: new Date("2024-06-03T16:45:00.000Z") },
    { type: "wire_transfer", amount: "287350.00", description: "Wire for Offshore Christmas Tree Valve Assembly - PO-9415", status: "approved", recipientName: "Lone Star Petroleum Equipment", recipientBank: "Frost Bank", recipientAccount: "6034718290", recipientRoutingNumber: "114000093", swiftCode: "FRSTUS44", bankAddress: "100 W Houston St, San Antonio, TX 78205", memo: "Valve assembly procurement", purpose: "Equipment purchase", referenceNumber: "WT-20240819-004", createdAt: new Date("2024-08-19T08:10:00.000Z") },
    { type: "external_transfer", amount: "92800.00", description: "Transfer for PDC Drill Bit Set 12-1/4 inch - PO-1124", status: "approved", recipientName: "Oklahoma Drill Technologies", recipientBank: "BOK Financial", recipientAccount: "2047381956", recipientRoutingNumber: "103900036", swiftCode: "BOKFUS41", bankAddress: "Bank of Oklahoma Tower, Tulsa, OK 74172", memo: "Drill bit order", referenceNumber: "ET-20240928-005", createdAt: new Date("2024-09-28T10:20:00.000Z") },
    { type: "wire_transfer", amount: "463500.00", description: "Wire for Topside Separation Module - PO-1298", status: "approved", recipientName: "Midland Energy Systems Inc.", recipientBank: "Comerica Bank", recipientAccount: "9182730465", recipientRoutingNumber: "072000096", swiftCode: "MNBDUS33", bankAddress: "1717 Main St, Dallas, TX 75201", memo: "Separation module procurement", purpose: "Capital equipment", referenceNumber: "WT-20241014-006", createdAt: new Date("2024-10-14T17:05:00.000Z") },
    { type: "wire_transfer", amount: "679500.00", description: "Wire for FPSO Turret Mooring Assembly - PO-1510", status: "approved", recipientName: "Houston Subsea Engineering", recipientBank: "Zions Bank", recipientAccount: "7429061538", recipientRoutingNumber: "124000054", swiftCode: "ZFNBUS55", bankAddress: "1 S Main St, Salt Lake City, UT 84133", memo: "Turret mooring system", purpose: "Major equipment", referenceNumber: "WT-20241122-007", createdAt: new Date("2024-11-22T08:00:00.000Z") },
    { type: "external_transfer", amount: "312000.00", description: "Transfer for Coiled Tubing Unit with BHA - PO-1780", status: "approved", recipientName: "Panhandle Drilling Equipment LLC", recipientBank: "BBVA USA", recipientAccount: "8173024596", recipientRoutingNumber: "062001186", swiftCode: "BBVAUS44", bankAddress: "1500 Solano Ave, Albany, CA 94707", memo: "Coiled tubing unit purchase", referenceNumber: "ET-20250108-008", createdAt: new Date("2025-01-08T15:30:00.000Z") },
    { type: "wire_transfer", amount: "187400.00", description: "Wire for Mud Logging Sensor Array System - PO-2010", status: "approved", recipientName: "Tulsa Well Services Inc.", recipientBank: "Arvest Bank", recipientAccount: "5180394726", recipientRoutingNumber: "082000549", swiftCode: "ARVTUS44", bankAddress: "1 W 4th St, Tulsa, OK 74103", memo: "Sensor array procurement", purpose: "Equipment purchase", referenceNumber: "WT-20250312-009", createdAt: new Date("2025-03-12T16:45:00.000Z") },
    { type: "external_transfer", amount: "128900.00", description: "Transfer for Tri-Cone Roller Bit Assembly - PO-2445", status: "approved", recipientName: "North Dakota Oilfield Supplies", recipientBank: "Gate City Bank", recipientAccount: "7301824596", recipientRoutingNumber: "091407429", swiftCode: "GTCTUS41", bankAddress: "500 2nd Ave N, Fargo, ND 58102", memo: "Roller bit order", referenceNumber: "ET-20250721-010", createdAt: new Date("2025-07-21T08:50:00.000Z") },
    { type: "wire_transfer", amount: "534000.00", description: "Wire for Riser Tensioning System - PO-2930", status: "approved", recipientName: "Odessa Production Equipment Co.", recipientBank: "WestStar Bank", recipientAccount: "6183029475", recipientRoutingNumber: "112200407", swiftCode: "WSTRUS41", bankAddress: "500 N Grant Ave, Odessa, TX 79761", memo: "Riser tensioning system", purpose: "Capital equipment", referenceNumber: "WT-20251103-011", createdAt: new Date("2025-11-03T14:20:00.000Z") },
    { type: "wire_transfer", amount: "275800.00", description: "Wire for Mud Circulation System Upgrade - PO-3205", status: "approved", recipientName: "Corpus Christi Marine Systems", recipientBank: "Prosperity Bank", recipientAccount: "8214063597", recipientRoutingNumber: "113122655", swiftCode: "PRSPUS44", bankAddress: "4295 San Felipe, Houston, TX 77027", memo: "Circulation system upgrade", purpose: "System upgrade", referenceNumber: "WT-20260205-012", createdAt: new Date("2026-02-05T10:30:00.000Z") },
    { type: "wire_transfer", amount: "892000.00", description: "Wire for Deepwater Drilling Riser Package - PO-3380", status: "processing", recipientName: "Petrobras Equipment Solutions", recipientBank: "Citibank N.A.", recipientAccount: "4829105736", recipientRoutingNumber: "021000089", swiftCode: "CITIUS33", bankAddress: "388 Greenwich St, New York, NY 10013", memo: "Deepwater riser package", purpose: "Major capital equipment", referenceNumber: "WT-20260210-013", createdAt: new Date("2026-02-10T09:15:00.000Z") },
    { type: "external_transfer", amount: "165400.00", description: "Transfer for Wellhead Pressure Control Equipment - PO-3412", status: "processing", recipientName: "Appalachian Energy Equipment", recipientBank: "PNC Bank", recipientAccount: "3918274605", recipientRoutingNumber: "043000096", swiftCode: "PNCCUS33", bankAddress: "The Tower at PNC Plaza, Pittsburgh, PA 15222", memo: "Pressure control equipment", referenceNumber: "ET-20260212-014", createdAt: new Date("2026-02-12T11:40:00.000Z") },
    { type: "wire_transfer", amount: "1250000.00", description: "Wire for Semi-Submersible Platform Components - PO-3500", status: "pending", recipientName: "Nordic Offshore Manufacturing AS", recipientBank: "DNB ASA", recipientAccount: "NO9386011117947", recipientRoutingNumber: "N/A", swiftCode: "DNBANOKKXXX", bankAddress: "Dronning Eufemias gate 30, 0191 Oslo, Norway", memo: "Platform components international", purpose: "International equipment purchase", referenceNumber: "WT-20260214-015", wireType: "international", beneficiaryCountry: "Norway", createdAt: new Date("2026-02-14T08:00:00.000Z") },
    { type: "external_transfer", amount: "78500.00", description: "Transfer for Safety Valve Actuator Set - PO-3515", status: "pending", recipientName: "Permian Basin Safety Systems", recipientBank: "First Financial Bank", recipientAccount: "5601938274", recipientRoutingNumber: "111907700", swiftCode: "FFBKUS41", bankAddress: "400 Pine St, Abilene, TX 79601", memo: "Safety valve actuators", referenceNumber: "ET-20260215-016", createdAt: new Date("2026-02-15T14:25:00.000Z") },
    { type: "wire_transfer", amount: "345000.00", description: "Wire for Subsea BOP Control System - PO-3528", status: "pending", recipientName: "Cameron International Corp.", recipientBank: "HSBC Bank USA", recipientAccount: "6472910385", recipientRoutingNumber: "022000020", swiftCode: "MRMDUS33", bankAddress: "452 Fifth Ave, New York, NY 10018", memo: "BOP control system procurement", purpose: "Safety equipment", referenceNumber: "WT-20260216-017", createdAt: new Date("2026-02-16T10:00:00.000Z") },
    { type: "internal_transfer", amount: "50000.00", description: "Internal transfer to Operating Account for field expenses", status: "approved", internalToAccount: "****7823", memo: "Monthly operating fund allocation", referenceNumber: "IT-20260201-018", createdAt: new Date("2026-02-01T09:00:00.000Z") },
    { type: "internal_transfer", amount: "25000.00", description: "Internal transfer to Payroll Account for contractor payments", status: "approved", internalToAccount: "****4091", memo: "Contractor payroll February 2026", referenceNumber: "IT-20260210-019", createdAt: new Date("2026-02-10T08:30:00.000Z") },
  ];

  for (const t of transferData) {
    await db.insert(transfers).values({
      customerId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      status: t.status,
      recipientName: t.recipientName || null,
      recipientBank: t.recipientBank || null,
      recipientAccount: t.recipientAccount || null,
      recipientRoutingNumber: t.recipientRoutingNumber || null,
      swiftCode: t.swiftCode || null,
      bankAddress: t.bankAddress || null,
      memo: t.memo || null,
      internalToAccount: t.internalToAccount || null,
      wireType: (t as any).wireType || null,
      beneficiaryCountry: (t as any).beneficiaryCountry || null,
      purpose: t.purpose || null,
      referenceNumber: t.referenceNumber || null,
      createdAt: t.createdAt,
      updatedAt: t.createdAt,
    });
  }
}
