# GRAINTRACE — Evaluator Demo Guide

## 1. Project overview

GRAINTRACE is a role-based manufacturing intelligence prototype for a small food manufacturer. It follows one material journey from customer order to audit evidence:

`sales order → purchase order → goods receipt → production → Batch DNA → dispatch → GST invoice → collection → audit trail`

The evaluator demo should make the following differentiators visible, using only behavior that exists in the current codebase:

- **Append-only stock ledger:** stock movements have stable movement keys, source references, batch identity, and running balances.
- **Batch DNA:** a posted finished-goods batch traces upstream to suppliers, lots, recipe, ledger movements, and production, and downstream to dispatch and invoice evidence.
- **Weighted average costing:** unit costs are retained as exact rational values and rounded to integer paise only at money boundaries.
- **Planned vs actual production:** BOM scaling, material variance, yield variance, damaged output, and a sealed cost snapshot.
- **Business controls:** separate order creation/approval, purchase commitment/receipt, dispatch-before-invoice, partial fulfilment, and overpayment prevention.
- **GST correctness:** integer basis points, HSN validation, state jurisdiction, CGST/SGST or IGST, and frozen tax fields on the invoice.
- **Auditability:** actor, role, session, timestamp, metadata, and before/after values are written in the same transaction as the workflow.
- **Offline field entry:** salesman orders are stored in IndexedDB with idempotency keys and replay protection before synchronization.

Do not describe GRAINTRACE as an ERP replacement, a production-certified accounting system, or a fully offline system. Recipes and finished goods are explicitly labeled route shells; only salesman order entry has an offline queue.

## 2. Problem solved

Small manufacturers often record purchasing, production, dispatch, tax documents, and collections in disconnected registers. The resulting questions are hard to answer without reconstructing history:

- Which supplier lot became this finished packet batch?
- What did the batch actually cost after yield loss and material variance?
- Can this order be dispatched from real stock, and is a partial dispatch required?
- What tax jurisdiction and HSN applied to the invoice?
- How much is still outstanding, and which actor changed the record?

GRAINTRACE answers those questions from one server-authoritative SQLite database and a shared workflow layer.

## 3. Architecture at a glance

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts.
- **Backend:** Next.js server components and Node.js API route handlers.
- **Validation:** Zod schemas at API and workflow boundaries.
- **Database:** SQLite through `better-sqlite3` and Drizzle ORM; WAL mode and foreign keys enabled.
- **Rules:** pure functions in `src/domain/` for money, units, stock, costing, production, tax, invoices, and payments.
- **Workflows:** transactional services in `src/lib/workflows/`; no client role or user ID is trusted.
- **Auth:** bcrypt password hashes, database-backed sessions with hashed tokens, httpOnly session cookie.
- **Offline:** service worker shell cache plus IndexedDB v2 mutation queue for salesman orders.
- **Reports/audit:** server-filtered reports with CSV, Excel, and PDF exports; append-only audit log and source-to-transaction trails.

## 4. Roles and demo accounts

The login form has a **Demonstration accounts** section. Selecting an account fills its password; no account is preselected. Fields are **Work email** and **Password**; submit with **Enter operating console**.

| Role | Email | Password | Landing view | Demo responsibility |
| --- | --- | --- | --- | --- |
| Owner | `owner@graintrace.local` | `Owner!2026` | `/` | Optional all-access review |
| Admin | `admin@graintrace.local` | `Admin!2026` | `/` | Approve order, purchase, receive, dispatch |
| Salesman | `salesman@graintrace.local` | `Sales!2026` | `/orders` | Create and synchronize order |
| Production | `production@graintrace.local` | `Production!2026` | `/production` | Plan, run, complete, post |
| Accountant | `accountant@graintrace.local` | `Accounts!2026` | `/invoices` | Invoice and collect payment |
| Auditor | `auditor@graintrace.local` | `Auditor!2026` | `/audit` | Trace batch and follow audit trail |

Role constraints to narrate if asked:

- Salesmen can create orders but cannot approve them.
- Production can manage inventory and production but cannot post purchases.
- Accountants can manage invoices and payments but cannot create dispatches.
- Auditors have view/trail access, not posting permissions.
- Owner and Admin have all operations, including user management.

To switch roles, open **Open profile menu**, choose **Operating profile** if needed, then **Confirm sign out**.

## 5. Reset before the evaluator arrives

From PowerShell in the repository root:

```powershell
cd nit_internship
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. `npm run db:seed` is deterministic and safe to rerun. If the demo database has already been used and an exact repeat is required, stop the server, delete the configured SQLite file (default `./data/graintrace.db`), then rerun `npm run db:migrate` and `npm run db:seed`.

Do not delete the repository or committed migrations. Do not commit local database files or `.env`.

## 6. Six-minute connected demo

Use the fixed references below only on a freshly seeded database. Document numbers for dispatch, invoice, and payment are generated by the system and depend on the issue dates and financial-year sequence; the values shown are verified for the documented dates on a fresh database.

### Step 1 — Salesman creates the order (45 seconds)

1. Sign in as **Salesman**.
2. The role-specific field console shows **Local queue / 01**. Click **Start order**.
3. Steps are **Customer → Product → Quantity → Review**.
4. **Customer:** select `Demonstration Foods · retailer`, then **Continue**.
5. **Product:** select `Signature Atta 500 g · 500 g`, then **Continue**.
6. **Quantity:** enter `180` packets, `100` price per packet, `0` discount; point to the **Live preview** of `₹1800.00`, then **Continue**.
7. **Review:** enter requested date `2026-02-08` and reference `SO-DEMO-001`, then **Queue and sync**.
8. Open `SO-DEMO-001` from **Your orders**. Expected status: `submitted`; value: `₹1800.00`.

Talking point: the order passed through the durable local queue with a unique idempotency key, not a hidden direct database write.

### Step 2 — Admin approves and commits purchasing (75 seconds)

1. Sign out, sign in as **Admin**.
2. In **Orders → Order tracking**, inspect `SO-DEMO-001`. Click **Approve**. Expected status: `approved`.
3. Open **Purchases**. Use **New order**.
4. Enter order number `PO-DEMO-001`; supplier `Demonstration Grains`; order date `2026-02-01`; expected date `2026-02-03`.
5. Add three lines:
   - `Raw material` · `RM-WHEAT` · quantity `100000` · unit cost `4`
   - **Line** · `Raw material` · `RM-SALT` · quantity `5000` · unit cost `6`
   - **Line** · `Packaging` · `PKG-POUCH-500` · quantity `500` · unit cost `250`
6. Click **Create draft order**. In **Order book**, click **Inspect** on `PO-DEMO-001`, then **Mark submitted**, then **Mark approved**. Expected value: `₹5550.00`.
7. In the same row, click **Receive**. Enter receipt number `GRN-DEMO-001`, received date `2026-02-02`, and lot codes:
   - `RM-WHEAT`: accepted `100000`, lot `LOT-WHEAT-DEMO`, cost `4`
   - `RM-SALT`: accepted `5000`, lot `LOT-SALT-DEMO`, cost `6`
   - `PKG-POUCH-500`: accepted `500`, lot `LOT-POUCH-DEMO`, cost `250`
8. Click **Post receipt to ledger**. Expected status: `received`.

Talking point: the purchase order is only a commitment; stock appears when the receipt posts, with lot, cost, and ledger source attached.

### Step 3 — Production posts a real batch (90 seconds)

1. Sign out, sign in as **Production**.
2. Open **Production → New production run**.
3. Run number `RUN-DEMO-001`; active recipe `RECIPE-ATTA-500 v1 · 200 packets`; planned packets `200`; selling price per packet `5000`. Click **Create draft**.
4. Inspect the run. Under **Plan source batches**, select `LOT-WHEAT-DEMO`, `LOT-SALT-DEMO`, and `LOT-POUCH-DEMO`, then click **Assign batches and plan**.
5. Click **Start production**.
6. Enter actual quantities: wheat `99000`, salt `1050`, pouches `200`; damaged material quantities `0`.
7. Enter good output `188`, damaged output `12`, labour `120000`, gas `60000`. Click **Complete run**.
8. Expected metrics: actual output `200`, good output `188`, yield variance `-600 bps`, salt variance `+500 bps` and flagged, wheat/pouch variance `0`.
9. Enter finished batch code `FG-DEMO-001`, packed on `2026-02-03`, expiry `2026-08-03`. Click **Post production**.
10. Expected snapshot: material cost `₹4523.00`, labour `₹1200.00`, overhead `₹1800.00`, total run cost `₹6323.00`, cost per packet `₹33.63`. Click **Trace batch**.

Talking point: posting is atomic and sealed; corrections require a separate inventory adjustment.

### Step 4 — Batch DNA shows the journey (45 seconds)

1. Sign out, sign in as **Auditor** (or remain as Production, which also has Batch DNA view access).
2. Open **Batch DNA**, search `FG-DEMO-001`, and select it.
3. Show the stage tabs: **Purchase sources**, **Raw material lots**, **Inventory movements**, **Recipe / BOM**, **Production run**, **Material consumption**, **Yield / variance**, **Finished goods**.
4. Click **Upstream** and **Downstream** to narrow the graph.
5. At this point the trace reports three source lots, six ledger events, `188` current packets, `-600 bps` yield variance, and two variance flags. **Dispatch** and **Invoice / customer** gaps are expected because those steps have not happened yet.

### Step 5 — Admin dispatches the order (45 seconds)

1. Sign out, sign in as **Admin**.
2. Open **Dispatch**. Under **Plan a dispatch**, select order `SO-DEMO-001`; click **Select order**/load the plan. Expected available packets `188` and fulfillable packets `180`.
3. Set dispatch date `2026-02-04`, expected date `2026-02-08`, carrier `Demo Carrier`, tracking `TRACK-DEMO-001`.
4. Click **Create challan and post stock**. Expected dispatch number `DSP/2025-26/0001`; status `in_transit`.
5. Return to **Batch DNA** if desired: the previous dispatch gap is now closed.

Talking point: **No phantom stock** — packets are selected by FEFO/expiry and the ledger posts at challan creation.

### Step 6 — Accountant invoices and collects (75 seconds)

1. Sign out, sign in as **Accountant**.
2. Open **Invoices → Invoice dispatched stock**. Select `SO-DEMO-001 · Demonstration Foods`, then **Load lines**.
3. Expected candidate: `Signature Atta 500 g`, HSN `110100`, fulfilled `180`, available to invoice `180`, net price `₹100.00` per packet.
4. Keep packets `180`, invoice date `2026-02-05`, GST rate `5`, then click **Post tax invoice**.
5. Expected invoice `TN/2025-26/0001`: taxable `₹18000.00`, CGST `₹450.00`, SGST `₹450.00`, total `₹18900.00`, jurisdiction `intra_state`.
6. Open **Collections**, click **Record payment**. Select the invoice, paid date `2026-02-06`, amount `10000`, method `UPI`, reference `UTR-DEMO-001`, then **Post receipt**.
7. Expected payment `PAY/2025-26/0001`, status `partially_paid`, amount paid `₹10000.00`, outstanding `₹8900.00`.

Talking point: invoice lines can only come from dispatched packets, and tax fields are frozen on the document. Overpayment is rejected.

### Step 7 — Auditor follows the evidence (45 seconds)

1. Sign out, sign in as **Auditor**.
2. Open **Audit**. In **AUDITOR TRAIL**, enter `TN/2025-26/0001` and click **Follow trail**.
3. Expected path: source order `SO-DEMO-001`, tax document `TN/2025-26/0001`, collection `PAY/2025-26/0001`, then audit events `PAYMENT RECORDED` and `INVOICE CREATED`.
4. Optionally repeat with `FG-DEMO-001` to show the same source-to-finished-goods evidence.

Close with the claim that is actually defensible: connected records, deterministic calculations, role-controlled workflows, and inspectable evidence — not an assertion of ERP-wide coverage.

## 7. Expected benchmark results

The benchmark is a deterministic pure-domain fixture used for calculation verification; it is separate from the UI demo values above. Run:

```powershell
npm test -- src/tests/benchmark.test.ts
```

Verified on a clean temporary database: 9 tests passed.

| Area | Expected result |
| --- | --- |
| Closing stock | Flour `120 kg`; Oil `19.5 L`; Spice `3.8 kg`; Pouches `306`; Cartons `21` |
| Finished goods | `238` packets after production; `88` after Retailer A dispatch |
| Production cost | Material `₹4055`; labour `₹1200`; gas `₹600`; total `₹5855` |
| Production outcome | `188` good packets; cost per packet `₹31.14`; yield variance `-6%` |
| Margin | Gross margin `₹18.86` / `37.72%`; markup `60.57%` |
| Retailer A | `150` packets; taxable `₹7500`; CGST/SGST `₹187.50` each; total `₹7875`; payment `₹4000`; outstanding `₹3875` |
| Distributor B | `120` ordered, `88` available, `32` backorder; benchmark IGST on 120 packets `₹300`; actual IGST on 88 packets `₹220` |
| Integrity | Integer paise; append-only ledger; weighted average cost stays `₹43.125/kg` after a later `₹60/kg` receipt; invalid/duplicate/negative/over-postings rejected |

Full suite: 11 test files and 49 tests passed.

## 8. Reset checklist after the demo

1. Sign out all demo users.
2. Stop the dev server.
3. Delete the local demo SQLite file if an evaluator will run the fixed script again.
4. Run `npm run db:migrate` and `npm run db:seed`.
5. Run `npm run verify` and, with a server on port 3100, `npm run verify:responsive`.

## 9. Troubleshooting

| Symptom | Cause / action |
| --- | --- |
| Login works but a workspace shows missing-column error | Migration `0007_violet_abomination.sql` was not applied. Run `npm run db:migrate`. |
| Duplicate document reference | Workflow references are unique. Reset the database or choose a new reference. |
| `No stocked batch available` | Goods receipt was not posted, or the selected lot has no available quantity. |
| Dispatch plan shows backorder | Available finished-goods packets are lower than ordered quantity. This is intended partial-fulfilment behavior. |
| Invoice has no lines | No dispatched packets exist for the order. Create the challan first. |
| Payment rejected | Amount would exceed the invoice outstanding balance. |
| Sign-in cannot fill a demo account | Login fills but does not submit; click **Enter operating console**. |
| Production build unavailable after dev mode | `next dev` overwrites `.next`; run `npm run build` before `npm run start`. |
| Docker path fails locally | Docker files exist but the container path was authored, not built in the verification environment. Prefer the exact local setup above. |
| `/recipes` or `/finished-goods` looks static | Expected: those routes are explicitly labeled implementation shells. |
