# Statement Studio

A responsive Next.js expense dashboard, ready for Vercel. Supports CSV uploads and PDF bank statements, including scans via OpenAI vision. Starts empty with no sample transactions. Save actual transactions as UTF-8 JSON text files in Azure Files, then load the latest saved file in a later session. Unsaved edits and the app passphrase remain in browser memory and disappear on refresh.

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
