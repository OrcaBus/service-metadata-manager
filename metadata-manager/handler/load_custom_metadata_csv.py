import django
import os
import logging

from libumccr import libjson

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings.base')
django.setup()

from proc.service.utils import sanitize_lab_metadata_df, warn_drop_duplicated_library
from proc.service.load_csv_srv import (
    load_metadata_csv,
    drop_incomplete_csv_records,
    download_csv_raw_bytes,
    parse_raw_csv_to_pandas,
    archive_raw_csv_to_s3,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, _context):
    logger.info(f'event: {libjson.dumps(event)}')

    csv_url = event.get('url', None)
    if csv_url is None:
        raise ValueError("URL is required")

    user_id = event.get('user_id', None)
    if user_id is None:
        raise ValueError("user_id (or email) required")

    reason = event.get('reason', None)

    is_emit_eb_events: bool = event.get('is_emit_eb_events', True)

    # Download the csv once, keep a raw in-house copy for traceability, then parse it.
    raw_csv = download_csv_raw_bytes(csv_url)
    archive_raw_csv_to_s3(raw_csv, source_url=csv_url, user_id=user_id)

    csv_df = parse_raw_csv_to_pandas(raw_csv)
    sanitize_df = sanitize_lab_metadata_df(csv_df)
    duplicate_clean_df = warn_drop_duplicated_library(sanitize_df)
    clean_df = drop_incomplete_csv_records(duplicate_clean_df)

    result = load_metadata_csv(df=clean_df, is_emit_eb_events=is_emit_eb_events, user_id=user_id,
                               reason=reason)

    logger.info(f'persist report: {libjson.dumps(result)}')
    return result


if __name__ == '__main__':
    handler({}, {})
