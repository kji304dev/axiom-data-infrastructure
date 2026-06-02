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
    assert len(result.failed_records) == 0


def test_unrecoverable_record_moves_to_failed_records() -> None:
    raw_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "River Works",
        "material": "Asphalt",
        "quantity": "not-a-number",
        "unit": "tons",
        "job_site": "Lot 7",
    }
    result = run_aec_grading([raw_record])

    assert result.validation_passed is False
    assert result.retry_count == 2
    assert len(result.cleaned_records) == 0
    assert len(result.failed_records) == 1
    assert result.failed_records[0].record == raw_record
    assert result.failed_records[0].reason
    assert any(event.status == "retry" for event in result.processing_history)
    assert any(
        "Dead-lettered" in event.message for event in result.processing_history
    )


def test_retry_dead_letter_behavior_after_max_attempts() -> None:
    bad_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "Alpha",
        "material": "Concrete",
        "quantity": "abc",
        "unit": "yd3",
        "job_site": "Site A",
    }
    good_record = {
        "ticket_id": "2002",
        "date": "2026-05-03",
        "customer": "Beta",
        "material": "Sand",
        "quantity": 3,
        "unit": "tons",
        "job_site": "Site B",
    }
    result = run_aec_grading([bad_record, good_record])

    assert result.retry_count == 2
    assert len(result.failed_records) == 1
    assert result.failed_records[0].row == 1
    assert result.failed_records[0].record == bad_record
    assert result.validation_passed is False
    assert len(result.cleaned_records) == 1
    assert result.cleaned_records[0].ticket_id == "2002"
    assert any(event.status == "retry" for event in result.processing_history)
    assert any(
        "Dead-lettered" in event.message for event in result.processing_history
    )
