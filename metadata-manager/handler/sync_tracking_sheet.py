import django
import os
import logging
import datetime
from libumccr import libjson

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings.base')
django.setup()

from proc.service.utils import warn_drop_duplicated_library
from proc.service.tracking_sheet_srv import sanitize_lab_metadata_df, persist_lab_metadata, \
    drop_incomplete_tracking_sheet_records, get_df_tracking_sheet_by_name, get_df_tracking_sheet_by_range

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    logger.info("Start processing update from google tracking sheet")
    logger.info(f'event: {libjson.dumps(event)}')

    year: str = str(event.get('year', datetime.date.today().year))
    if isinstance(year, list):
        raise ValueError("Year cannot be an array")

    is_emit_eb_events: bool = event.get('is_emit_eb_events', True)
    sheet_ranges: list[str] = event.get('ranges', None)

    # To track who initiate this sync at the history
    user_id = event.get('user_id', None)

    if sheet_ranges is None:
        tracking_sheet_df = get_df_tracking_sheet_by_name(sheet_name=year)
    else:
        if not isinstance(sheet_ranges, list):
            raise ValueError("Range must be a list of strings (row ranges)")
        tracking_sheet_df = get_df_tracking_sheet_by_range(sheet_name=year, sheet_ranges=sheet_ranges)

    sanitize_df = sanitize_lab_metadata_df(tracking_sheet_df)
    duplicate_clean_df = warn_drop_duplicated_library(sanitize_df)
    clean_df = drop_incomplete_tracking_sheet_records(duplicate_clean_df)

    result = persist_lab_metadata(df=clean_df, sheet_year=year, is_emit_eb_events=is_emit_eb_events,
                                  user_id=user_id, reason="Google tracking sheet")

    logger.info(f'persist report: {libjson.dumps(result)}')
    return result


if __name__ == '__main__':
    handler({}, {})
