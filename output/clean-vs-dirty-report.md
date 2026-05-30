# ADI Clean vs Dirty Report

## Summary

- **Input file:** /Users/kji/dev/axiom-data-infrastructure/samples/dirty_aec_ticket.csv
- **Total rows:** 4
- **Health score:** 80
- **validationPassed:** false
- **Total anomalies:** 1
- **Total repairs:** 5
- **Repairs requiring review:** 4

## Repairs

| row | field | originalValue | cleanedValue | confidence | requiresReview | actionTaken |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | customer | (empty) | UNKNOWN_CUSTOMER | 0.7 | true | Filled missing customer with placeholder |
| 3 | job_site | (empty) | UNASSIGNED | 0.7 | true | Filled missing job site with placeholder |
| 3 | date | 05/02/26 | 2026-05-02 | 0.95 | false | Normalized date from MM/DD/YY to ISO YYYY-MM-DD |
| 3 | quantity | -4 | 4 | 0.75 | true | Corrected invalid or negative quantity to absolute value |
| 4 | unit | (empty) | UNKNOWN_UNIT | 0.5 | true | Filled missing unit with placeholder |

## Anomalies

| row | field | severity | issue |
| --- | --- | --- | --- |
| 4 | date | high | Could not convert "bad-date" into YYYY-MM-DD format |

