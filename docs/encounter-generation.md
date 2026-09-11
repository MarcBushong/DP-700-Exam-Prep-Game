# Forging documentation-grounded encounters

The Forge is a maintainer request builder, not an autonomous browser question
generator. It prepares an exam-scoped request and commands. Copilot plus the
appropriate official documentation tools perform authoring in a maintainer
environment; the shipped app only plays a versioned, validated bank.

There is no required runtime AI service, browser API key, remote user-data
upload, or arbitrary documentation proxy.

## Request to reviewed package

1. Select a credential whose identity, status, and objective outline have been verified.
2. Select published objectives, a modest batch size, and the intended difficulty mix.
3. Retrieve the current credential page, study guide or competency outline, and official preparation material.
4. Retrieve direct product articles for each technical distinction being tested.
5. Author original neutral questions, plausible alternatives, explanations, and code where documented.
6. Have a different reviewer evaluate every option and every substantive explanation against the actual evidence.
7. Score each encounter against the realism rubric. Do not derive semantic scores from field presence or model confidence.
8. Inspect duplicates and quality warnings; resolve true duplicates and missing constraints.
9. Keep unsupported or ambiguous candidates excluded with specific reasons.
10. Integrate only matching question content, sources, independent attestations, claim evidence, rubric assessments, and objective-version metadata.

The independent rubric also binds the exact reviewed objective-map fingerprint
and version. Updating a package or envelope's version label is not a new
review. A changed map requires the reviewer to check the affected alignments
and record a new binding and actual review time before the encounter can reopen.

The dungeon theme is applied outside the factual record. Do not insert fantasy
names or jokes into code, commands, source titles, answer alternatives, technical
explanations, or the evidence supporting them.

## Commands

Run from the repository root with an installed supported Node.js version:

```powershell
npm run credentials:discover
npm run credentials:validate
npm run objectives:refresh -- --exam dp-700
npm run questions:generate -- --exam dp-700 --count 6 --difficulty advanced,expert
npm run reviews:sync
npm run questions:validate -- --exam dp-700
npm run questions:verify -- --exam dp-700
npm run questions:duplicates -- --exam dp-700
npm run questions:coverage -- --exam dp-700
npm run questions:report -- --exam dp-700
npm run sources:validate -- --exam dp-700
npm run content:validate-all
npm run content:status
```

Discovery and objective refresh must not silently turn an unknown credential
into an active dungeon or promote unreviewed questions. A generated request is
not evidence that retrieval, generation, or verification occurred.

For Microsoft credentials, use Microsoft Learn MCP. For GitHub credentials, use
official GitHub product documentation and certification outlines. The selected
credential's source policy must permit the actual URL; matching a broad topic
or hostname does not establish relevance.

See [question-bank maintenance](question-bank-maintenance.md) for the detailed
two-pass process, exact review ledger format, diagnostic commands, and truthful
handling of pending, rejected, and stale records.
