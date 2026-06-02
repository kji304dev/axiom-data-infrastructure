from backend.engine.graph import run_aec_grading


def test_clean_record_passes_without_retry() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "1001",
                "date": "2026-05-01",
                "customer": "Acme Builders",
                "material": "Concrete",
                "quantity": 12,
                "unit": "yd3",
                "job_site": "North Yard",
            }
        ]
    )

    assert result.validation_passed is True
    assert result.retry_count == 0
    assert len(result.cleaned_records) == 1
    assert len(result.failed_records) == 0


def test_repairable_dirty_record_is_transformed() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "1002",
                "date": "05/02/26",
                "customer": "",
                "material": "Gravel",
                "quantity": -4,
                "unit": "tons",
                "job_site": "",
            }
        ]
    )

    assert result.validation_passed is True
    assert result.cleaned_records[0].date == "2026-05-02"
    assert result.cleaned_records[0].quantity == 4
    assert result.cleaned_records[0].customer == "UNKNOWN_CUSTOMER"
    assert result.cleaned_records[0].job_site == "UNASSIGNED"


def test_unrecoverable_record_moves_to_failed_records() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "",
                "date": "bad-date",
                "customer": "River Works",
                "material": "Asphalt",
                "quantity": "not-a-number",
                "unit": "tons",
                "job_site": "Lot 7",
            }
        ]
    )

    assert result.validation_passed is False
    assert result.retry_count == 2
    assert len(result.cleaned_records) == 0
    assert len(result.failed_records) == 1
    assert "ticket_id" in result.failed_records[0].record


def test_retry_dead_letter_behavior_after_max_attempts() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "",
                "date": "bad-date",
                "customer": "Alpha",
                "material": "Concrete",
                "quantity": "abc",
                "unit": "yd3",
                "job_site": "Site A",
            },
            {
                "ticket_id": "2002",
                "date": "2026-05-03",
                "customer": "Beta",
                "material": "Sand",
                "quantity": 3,
                "unit": "tons",
                "job_site": "Site B",
            },
        ]
    )

    assert result.retry_count == 2
    assert len(result.failed_records) == 2
    assert result.validation_passed is False
    assert any(event.status == "retry" for event in result.processing_history)
