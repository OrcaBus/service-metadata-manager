import os
import json
from typing import TypedDict

from libumccr.aws import libssm
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Configuration
SSM_NAME_TRACKING_SHEET_ID = os.getenv('SSM_NAME_TRACKING_SHEET_ID', '/umccr/google/drive/tracking_sheet_id')
SSM_NAME_GDRIVE_ACCOUNT = os.getenv('SSM_NAME_GDRIVE_ACCOUNT', '/umccr/google/drive/lims_service_account_json')

def get_gsheet_client():
    """Initialize and return Google Sheets client and tracking sheet ID."""

    tracking_sheet_id = libssm.get_secret(SSM_NAME_TRACKING_SHEET_ID)

    account_info = libssm.get_secret(SSM_NAME_GDRIVE_ACCOUNT)
    credentials = service_account.Credentials.from_service_account_info(json.loads(account_info))
    service = build("sheets", "v4", credentials=credentials)
    gsheet_client = service.spreadsheets()

    return gsheet_client, tracking_sheet_id


class SheetData(TypedDict):
    """Structure for sheet data with columns and values."""
    columns: list[str]
    values: list[list[str]]


def get_records_by_sheet_range(sheet_name: str, sheet_range: str) -> SheetData:
    """
    Fetch Google Sheet data by range.

    Args:
        sheet_name: Name of the sheet tab (e.g., '2026')
        sheet_range: Row range excluding header (e.g., '2:994')

    Returns:
        Dict with 'columns' (headers) and 'values' (data rows)
    """
    sheet, sheet_id = get_gsheet_client()
    result = (
        sheet.values()
        .batchGet(spreadsheetId=sheet_id, ranges=[f'{sheet_name}!1:1', f'{sheet_name}!{sheet_range}'])
        .execute()
    )

    value_ranges = result.get("valueRanges", [])
    columns = value_ranges[0].get("values", [[]])[0]
    rows = value_ranges[1].get("values", [])

    return {
        "columns": columns,
        "values": _pad_rows(rows, len(columns))
    }


def get_records_by_sheet_name(sheet_name: str) -> SheetData:
    """
    Fetch entire Google Sheet including header row.

    Args:
        sheet_name: Name of the sheet tab (e.g., '2026')

    Returns:
        Dict with 'columns' (headers) and 'values' (data rows)
    """
    sheet, sheet_id = get_gsheet_client()
    result = (
        sheet.values()
        .batchGet(spreadsheetId=sheet_id, ranges=[sheet_name])
        .execute()
    )

    all_rows = result.get("valueRanges", [])[0].get("values", [])

    if not all_rows:
        return {"columns": [], "values": []}

    columns = all_rows[0]
    rows = all_rows[1:]

    return {
        "columns": columns,
        "values": _pad_rows(rows, len(columns))
    }


def _pad_rows(rows: list[list[str]], num_columns: int) -> list[list[str]]:
    """
    Pad rows with empty strings to match column count.

    Args:
        rows: List of rows (each row is a list of strings)
        num_columns: Expected number of columns

    Returns:
        List of padded rows
    """
    return [row + [""] * (num_columns - len(row)) for row in rows]
