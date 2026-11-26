# Statement Studio

A responsive Next.js expense dashboard, ready for Vercel. Supports CSV uploads and PDF bank statements, including scans via OpenAI vision. Starts empty with no sample transactions. Save actual transactions to PostgreSQL when DATABASE_URL is configured, or to Azure Files when it is not. Load the latest saved version in a later session. Unsaved edits remain in browser memory and disappear on refresh. Sign in once per browser: a signed HttpOnly cookie remembers access for seven days, with Secure enabled on the hosted site and SameSite=Strict. The passphrase is not saved in localStorage or sessionStorage. Sign out or rotate APP_ACCESS_TOKEN to invalidate access.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Import your own statement, or enter the app passphrase in settings and select **Load saved data** to restore the latest Azure file.

## Deploy to Vercel

1. Push this folder to a Git repository and import it into Vercel. If importing the parent repository, set **Root Directory** to `statement-studio`.
2. Use the detected **Next.js** preset; build command `npm run build`.
3. Add server environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), and a long, random `APP_ACCESS_TOKEN`.
4. Deploy. Open **Configure AI**, enter your access token (not your OpenAI key), and enable consent.

For Azure save/load, also configure `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_FILE_SHARE=cleanexpense` in Vercel's server environment. Use the same `APP_ACCESS_TOKEN` to authenticate both storage and AI endpoints. Azure storage works independently of OpenAI and does not require AI consent. Do not add these secrets to Git or use `NEXT_PUBLIC_` prefixes. Local credentials are stored in ignored `.env.local`; copy the values into Vercel's environment settings and redeploy. The configured personal workspace is shared by everyone who knows the app passphrase.

## Azure Files persistence

- The selected account for this installation is `applimit97195`, file share `cleanexpense`. The server creates the share if needed, without changing existing shares or files.
- **Save to Azure** writes the entire workspace (all transactions and display currency, regardless of filters) to a new `transactions-<UTC timestamp>-<UUID>.txt` file. The content is readable, formatted JSON with version, saved date, currency, and transaction records. Prior saves are retained; no existing file is overwritten.
- **Load saved data** restores the newest timestamped transaction file. It asks before replacing a nonempty session. Saved files are accessed only through the authenticated server endpoint; storage credentials never go to the browser.
- Changes are saved only when you click **Save to Azure**. **Clear session** clears only the browser workspace and leaves Azure files intact. There is no automatic save or automatic load on refresh.
- Validated files contain 1–5,000 rows and the API body limit is 3 MB. The original PDF is not uploaded to Azure. The account's normal Azure Files storage charges apply.

CSV and local NAB Transaction Listing PDF imports work without environment variables. Other PDF layouts, scanned PDFs and AI categorization require all AI settings. Select the PDF import method above the upload area. The API key is never sent to the browser. The shared access token protects the paid AI endpoint; this is a personal app, not a multiuser authentication system. Use Vercel Deployment Protection for private access and configure an API project budget before wider sharing.

## Import formats

- **CSV**: `Date,Description,Amount`, or `Date,Description,Debit,Credit`. Aliases include Transaction Date, Details, Narrative, Memo, and Posted Date. Negative signed amounts are expenses; positive amounts are income. Dates accept DD/MM/YYYY or YYYY-MM-DD. CSV max 5 MB / 5,000 rows. Ambiguous slash dates use day/month order. One currency per workspace.
- **Local PDF** (default): supports NAB Transaction Listing PDFs with selectable text, up to 20 MB and 100 pages. Reads dates, multiline descriptions, debit and credit columns by their positions in the document. Validates running balances and available summary totals before presenting the import. Everything runs in your browser. Other layouts fail with an explanation; they are never silently sent to AI. The PDF worker is copied from the installed package during `predev` and `prebuild`.
- **AI PDF** (explicit selection): up to 2.5 MB per file. Digital and scanned statements are sent to OpenAI as PDF input. Password-protected PDFs should be unlocked first. Split large statements into smaller PDFs. AI extraction is fallible: review the editable preview against your statement, including dates, debit/credit signs and totals before accepting. At most 1,000 extracted transactions per PDF. No PDF is stored by this app; OpenAI processes it under your API account's data policies. Requests use `store: false`.
- Import preview permits corrections and removing rows. Categories can be changed after import. Later imports skip possible duplicates matching date, description and amount against existing rows; same-day identical legitimate transactions may therefore need a separate session.
- Transfers are excluded from income, expense and net-cash-flow calculations. Other credits count as income (reclassify transfers manually). Currency selection only formats values, with no currency conversion. The app does not reconcile statement opening/closing balances.
- Search, category and month filters control CSV export. The transaction view displays 100 rows per page; totals and export include all matches. Every data column is sortable. Incoming values are green and outgoing values red. Group by category, exact description/merchant (case-insensitive), or incoming/outgoing; groups are ranked by outgoing totals, and group subtotal rows include all filtered transactions even when a group spans pages. AI categorization supports 200 transactions per request.

## Checks

```sh
npm test
npm run build
```

AI uses the OpenAI Responses API with structured outputs and validates the returned data. Categorization rejects changes to dates, descriptions or amounts. PDF data is held for review before updating the dashboard. AI endpoint rejects missing/wrong access tokens, oversized payloads and invalid inputs. Actual PDF extraction requires configured OpenAI credentials and is not covered by offline tests.

OpenAI references: https://developers.openai.com/api/docs/guides/file-inputs and https://developers.openai.com/api/docs/guides/structured-outputs.

## Expenses timeline

Open **Expenses timeline** from Overview, or visit `/expenses`. View daily, weekly (Monday start), and monthly expenses, with date and category filters. Charts label nonzero amounts and identify each category, with horizontal scrolling to keep labels readable. Zero-spend periods are filled between the first and last included expense. Incoming values and transfers are excluded. Workspace data survives client-side navigation between Overview and the timeline; after a full refresh, select Load saved data to restore the latest Azure snapshot using your remembered sign-in.

Manual category corrections update every loaded transaction with the same full description (ignoring letter case and extra whitespace), across all dates and active filters. Similar but different descriptions are kept separate. Select Save to Azure to persist corrections; future imports are not automatically changed by this action.

The timeline defaults to Day and shows one coloured dot per expense. Hover, keyboard-focus, or tap a dot to display its positive expense amount, full description, category, and date. Category colours are consistent across the legend and category charts. The detail panel lists every expense on the selected date so overlapping dots remain accessible. Existing date/category filters apply to the dots.

The Expenses timeline now keeps only the connected individual-expense graph. Click a category legend button to filter it, click it again or All categories to restore all expenses. Straight segments connect the visible dots. Optional CSV Time or Transaction Time columns accept 24-hour HH:mm or HH:mm:ss and survive Azure save/load and CSV export. Hourly positions use the source clock time without timezone conversion; missing times are not inferred. In mixed data, date-only expenses appear in a separate No time lane rather than at a fabricated hour.

The timeline opens on the latest seven calendar days ending on the latest transaction date in the loaded data. Older/Newer moves by the currently visible window length. Latest 7 days restores the initial window; All history shows the full date range. Zoom in halves the visible range (minimum one day), and Zoom out doubles it up to the available history while keeping the current end date fixed. The date fields remain available for custom ranges.

Timeline default updated: all loaded transaction days are shown in descending chronological order, newest on the left and oldest on the right. Source times descend within each date; unknown times stay in the separate untimed lane. Reset filters restores all history. The optional Latest 7 days shortcut and zoom controls remain available.

Graph-level Zoom in, Zoom out and Reset zoom controls change horizontal dot spacing from 25% to 400% without filtering dates or changing totals. These are separate from the date-range zoom controls. Scroll horizontally through the enlarged graph.

Overview Daily spending is a stacked bar chart with actual calendar date/year labels, category colours matching the expenses timeline, a legend, and date/category/amount details on hover, focus or tap. All-time view keeps dates in different months separate; a selected month includes its real calendar days.

Overview chart drilldowns: daily bars show newest dates first. Click a coloured segment to filter transactions by exact date and category; click the daily total to see all expenses on that date. Click a pie slice or legend category to see its expense transactions within the selected month. Each action scrolls to the transaction list, clears search, and displays a removable drilldown filter. Show all transactions clears the chart filter.

## PostgreSQL storage

The `cleanexpense` schema is isolated from other applications in `defaultdb`. `cleanexpense.snapshots` stores save versions and currencies. `cleanexpense.transactions` stores each version's transaction rows, including dates, optional source times, descriptions, exact numeric amounts, categories, and generated incoming/outgoing amounts. `cleanexpense.current_transactions` is a view of the newest complete version. Existing saves remain as history.

Set server-only `DATABASE_URL` and `DATABASE_CA_CERT_BASE64` in local `.env.local` and Vercel Production settings. The CA variable contains the base64-encoded PEM certificate from the Aiven service. TLS always validates the certificate and hostname; sslmode query options are removed before explicit TLS setup. The local pool has at most two connections per server instance.

Run `npm run db:migrate` locally to apply `db/schema.sql` and import the newest saved Azure dataset. The source Azure filename makes repeat imports idempotent. The script verifies all rows and amounts after migration. Azure credentials are required for this import; the runtime database does not need them. Schema creation is an explicit migration, not performed on ordinary requests. When DATABASE_URL is set, database failures are returned as errors; the app never silently falls back to stale Azure data. Existing authentication remains required.

Query the current data with:

```sql
SELECT transaction_date, transaction_time, description, category,
       amount, incoming_amount, outgoing_amount, currency
FROM cleanexpense.current_transactions
ORDER BY transaction_date DESC, transaction_time DESC NULLS LAST, ordinal;
```

## Automatic database workflow

When a remembered session is valid, the workspace automatically loads the latest saved data on refresh and after sign-in. Manual category edits are sent to the server immediately; the server updates every saved transaction with that normalized description and stores a rule in `cleanexpense.category_rules` for future imports. A failure leaves the displayed category unchanged and shows an error.

Statement previews are checked against the latest database version and show only unseen transactions, newest first. Confirming Import & save rechecks duplicates under the same database lock used for category updates, merges new rows into the latest version, applies saved category rules, and commits atomically. Duplicate matching uses date, available time, normalized full description and amount, counting occurrences so legitimate identical purchases are retained. The app does not discard an unseen backdated transaction merely because its date predates the last saved date. Reimporting a complete overlap makes no new snapshot. New imports reset the transaction list to newest-first order. A full workspace is still limited to 5,000 rows per saved version.

## Forecast page

`/forecast` shows a statistical preview and offers an explicit OpenAI prediction for 7, 14 or 30 days. At least 28 calendar days of saved history are required, using up to 180 days. Credits and transfers are excluded. Missing transaction days within the observed span are treated as zero. Forecast dates begin one day after the newest saved transaction; a stale statement therefore gives a historical forecast origin, not a forecast beginning today.

The baseline compares a recent 28-day mean with a recency-weighted weekday model. It selects the model with lower rolling one-day MAE across the most recent 7–14 days, with each test prediction using only prior data. The displayed baseline error does not validate OpenAI predictions. Shaded ranges use the baseline absolute-error quantile and a horizon scaling heuristic and are explicitly not calibrated confidence intervals.

Generate AI prediction requires the remembered sign-in, a server OPENAI_API_KEY, and per-request data consent. Only daily dates/category totals, currency and statistical baseline are sent to OpenAI, with store:false. The API reads the latest saved database snapshot, not a client-supplied transaction list. Returned dates, categories and nonnegative amounts are validated. Predictions are never inserted as real transactions.

Forecast persistence: completed AI forecasts are saved in `cleanexpense.forecasts` with generation date, horizon, category, source snapshot, data cutoff and full output. The page loads saved versions automatically and never calls the OpenAI generation endpoint on refresh, navigation or filter changes. Generate new forecast is the only generation trigger. The saved-forecast selector loads previous versions. A unique request ID claims each generation atomically so simultaneous requests with the same ID cannot trigger duplicate paid calls; interrupted or failed generations are marked separately and do not replace the last successful forecast.
