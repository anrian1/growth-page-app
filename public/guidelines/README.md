# Guideline pack (public/guidelines/pack.json)

Put a file named `pack.json` here to switch the guideline checks on. Without it the app says "Belum ada paket pedoman terpasang".

A pack is a REVIEWED list of rules written from a guideline document. At run time the app only checks the numbers against the rules and
shows the matching rule with its citation. It never writes clinical advice of its own.

```json
{
  "id": "short-id",
  "title": "Name of the guideline",
  "source": { "name": "Publisher and document", "year": 2021, "url": "https://..." },
  "reviewedBy": "dr. Name, role (leave null while it is a draft)",
  "diagnoses": [ { "id": "htn", "names": ["Hipertensi", "HT"] } ],
  "rules": [
    {
      "id": "unique-id",
      "when": "sys >= 160 and missing(dx)",
      "text": "What to show the clinician, in Bahasa Indonesia.",
      "cite": { "page": 12, "section": "Tabel 3", "quote": "The exact words from the guideline." },
      "severity": "check"
    }
  ]
}
```

Rules that cannot load (the whole pack is then refused and the app says why):
- no citation (a page or a section, AND the exact quote)
- no text, a repeated id, an unknown variable, or a condition that cannot be read

Condition language: numbers, 'strings', variables, `> >= < <= == !=`, `and`, `or`, `not`, parentheses, `missing(variable)`.
Variables: sys, dia, pulse, temp, weight, height, bmi, age, sex ('L' or 'P'), dx (the diagnosis id from the pack).
A comparison with a number that is not available never matches; the rule is listed as "tidak dapat diperiksa" instead.

`reviewedBy: null` shows the pack as a DRAFT on every result. Do not remove it until a clinician has read every rule against the source.
Do not invent thresholds. Copy them from the guideline and quote it.
