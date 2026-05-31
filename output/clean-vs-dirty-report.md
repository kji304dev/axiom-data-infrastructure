# ADI Clean vs Dirty Report

## Summary

- **Input file:** /Users/kji/dev/axiom-data-infrastructure/samples/unrecoverable_aec_ticket.csv
- **Total rows:** 2
- **Health score:** 70
- **validationPassed:** false
- **Total anomalies:** 2
- **Total repairs:** 7
- **Repairs requiring review:** 7

## Repairs

| row | field | originalValue | cleanedValue | confidence | requiresReview | actionTaken |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | customer | (empty) | UNKNOWN_CUSTOMER | 0.7 | true | Filled missing customer with placeholder |
| 2 | unit | (empty) | UNKNOWN_UNIT | 0.5 | true | Filled missing unit with placeholder |
| 2 | job_site | (empty) | UNASSIGNED | 0.7 | true | Filled missing job site with placeholder |
| 2 | quantity | -5 | 5 | 0.75 | true | Corrected invalid or negative quantity to absolute value |
| 3 | unit | (empty) | UNKNOWN_UNIT | 0.5 | true | Filled missing unit with placeholder |
| 3 | job_site | (empty) | UNASSIGNED | 0.7 | true | Filled missing job site with placeholder |
| 3 | quantity | not-a-number | 1 | 0.75 | true | Corrected invalid or negative quantity to absolute value |

## Anomalies

| row | field | severity | issue |
| --- | --- | --- | --- |
| 2 | date | high | Could not convert "bad-date" into YYYY-MM-DD format |
| 3 | date | high | Could not convert "garbage-date" into YYYY-MM-DD format |

