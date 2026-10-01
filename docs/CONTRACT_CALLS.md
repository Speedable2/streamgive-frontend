# Frontend → Soroban contract call reference

Maps every Soroban contract method this frontend calls to the UI flow that
calls it, the arguments it sends, and where amounts get converted to
on-chain units. Method signatures are hand-mirrored in
[`src/lib/contractTypes.ts`](../src/lib/contractTypes.ts) (see that file's
docblock for why — `Client.from()` builds methods at runtime from a fetched
contract spec, so TypeScript can't see them otherwise) and must be kept in
step with the contract crates' `src/lib.rs` in `streamgive-contracts`; a
drift here is only caught at runtime as a failed transaction.

Both contract clients (`useDonationVaultClient()` in
[`src/lib/donationVaultClient.ts`](../src/lib/donationVaultClient.ts) and
`useNgoRegistryClient()` in
[`src/lib/ngoRegistryClient.ts`](../src/lib/ngoRegistryClient.ts)) are built
as soon as a wallet connects rather than on first click, and expose
`{ client, ready }` — callers disable contract-calling buttons on `!ready`
so a click can't race the async `Client.from()` spec fetch.

## Unit conversion

All token amounts sent to the contracts are raw integers scaled by
`TOKEN_DECIMALS` (7, i.e. the same scale as XLM's stroops), defined in
[`src/lib/format.ts`](../src/lib/format.ts):

- **UI → contract**: `parseAmount(input)` in `format.ts` parses a decimal
  string typed by the user into a raw `bigint`, rejecting anything with
  more than 7 decimal places or that isn't a positive number. Used by
  `CreateStreamForm` and `StreamControls`' top-up field.
- **Contract → UI**: `formatAmount(raw)` does the reverse for display
  (`impact page`, stream balances, etc.).
- **Per-second rates** are always derived, never typed in directly: both
  `create_stream` and `modify_rate` take a `deposit`/`balance` and a
  duration in seconds and divide (integer division) to get the rate —
  see `computeModifyRate()` in `StreamControls.tsx` and the inline
  `rateRaw` calculation in `CreateStreamForm.tsx`. A result of `0` (amount
  too small for the chosen duration) is treated as invalid and blocks
  submission rather than being sent as a zero-rate stream.

## `donationVaultClient` — `DonationVaultMethods`

| Method          | Called from                                                                               | UI flow                                                                            | Arguments                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_stream` | [`CreateStreamForm.tsx`](../src/components/donate/CreateStreamForm.tsx) `handleSubmit`    | Donor fills out amount/token/duration on an NGO's donate page and submits.         | `donor` (connected wallet address), `ngo` (the NGO's address, from the page route), `token` (native XLM, USDC, or a custom contract address the donor pastes in), `deposit` (raw `bigint` from `parseAmount(amount)`), `rate` (`deposit / durationSeconds`, raw `bigint`). Returns the new stream's on-chain id, which the UI redirects to a success page with. |
| `top_up`        | [`StreamControls.tsx`](../src/components/dashboard/StreamControls.tsx) `handleTopUp`      | Donor clicks "Top up" on an active stream in their dashboard and enters an amount. | `stream_id` (`BigInt(stream.onChainId)`), `amount` (raw `bigint` from `parseAmount(topUpAmount)`).                                                                                                                                                                                                                                                              |
| `cancel_stream` | [`StreamControls.tsx`](../src/components/dashboard/StreamControls.tsx) `handleCancel`     | Donor clicks "Cancel" then confirms in the inline "Yes, cancel" prompt.            | `stream_id` (`BigInt(stream.onChainId)`). No other arguments — cancellation is all-or-nothing.                                                                                                                                                                                                                                                                  |
| `modify_rate`   | [`StreamControls.tsx`](../src/components/dashboard/StreamControls.tsx) `handleModifyRate` | Donor clicks "Modify rate", picks a new duration from a preset list, confirms.     | `stream_id` (`BigInt(stream.onChainId)`), `new_rate` (the stream's **remaining** `balance` divided by the newly chosen duration in seconds, via `computeModifyRate()` — donors pick a duration, never a raw rate).                                                                                                                                              |
| `withdraw`      | [`WithdrawButton.tsx`](../src/components/ngoAdmin/WithdrawButton.tsx) `handleWithdraw`    | NGO admin clicks "Withdraw" on one of their streams.                               | `stream_id` (`BigInt(streamOnChainId)`). The contract returns `NothingToWithdraw` if nothing's accrued yet — surfaced as a toast, treated as a normal outcome rather than a bug.                                                                                                                                                                                |

## `ngoRegistryClient` — `NgoRegistryMethods`

| Method        | Called from                                                                             | UI flow                                                                                 | Arguments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register`    | [`src/app/apply/page.tsx`](../src/app/apply/page.tsx) `handleSubmit`                    | Applicant connects a wallet on `/apply`, fills the NGO application form, and submits.   | `owner` (connected wallet address — **must** be the caller's own address, since `register` requires the owner's own signature; this is what proves the applicant controls the address rather than just typing one in), `name` (trimmed org name). Called **before** the off-chain `submitNgoApplication` — an application is only submitted once the on-chain registration either succeeds or was already done in an earlier attempt (`isAlreadyRegistered()` checks for the registry's `ALREADY_REGISTERED` error code and treats it as a no-op, not a failure). |
| `approve_ngo` | [`src/app/platform-admin/page.tsx`](../src/app/platform-admin/page.tsx) `handleApprove` | Platform admin reviews a pending application on `/platform-admin` and clicks "Approve". | `ngo_owner` (the applicant's address from the application record). Called **before** the off-chain `reviewNgoApplication` call — on-chain approval is the source of truth for `Ngo.verified`; if the transaction fails or is rejected, the off-chain review status deliberately stays "pending" rather than being marked approved while the NGO is still unverified on-chain. Fails with `NotRegistered` (see `NGO_REGISTRY_ERRORS` in `contractTypes.ts`) if the applicant's `register()` call never landed.                                                     |

## Fee estimation

Every call site reads `tx.built?.fee` off the `AssembledTransaction`
returned by the contract method (before calling `.signAndSend()`) and
formats it with `formatEstimatedFee()` from `format.ts`, showing it in the
UI while the wallet's signing prompt is open. This is possible because
`Client.from()`'s generated methods already simulate the call to assemble
the transaction — the fee is known before the user ever signs.

## Error handling pattern

All five call sites follow the same shape: `try { await
client.<method>(...); await tx.signAndSend(); } catch (err) { <surface
err.message, or a fallback string, via toast/inline error> }`. None of them
parse arbitrary contract error codes into friendlier messages today except
the two documented above (`ALREADY_REGISTERED`, implicitly `NotRegistered`
via `approve_ngo`'s precondition) — turning more of `NGO_REGISTRY_ERRORS`
(or an equivalent for the donation vault) into user-facing copy is a
reasonable follow-up, not something this reference assumes has been done.
