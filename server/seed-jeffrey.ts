import { db } from "./db";
import { customers, transactions, accessCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedJeffreyAnderson() {
  const existing = await db.select().from(customers).where(eq(customers.username, "LeoJeff17"));
  if (existing.length > 0) {
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

  console.log(`[seed] Jeffrey Anderson created successfully (ID: ${jeffId}) with 22 transactions and access code 782916`);
}
