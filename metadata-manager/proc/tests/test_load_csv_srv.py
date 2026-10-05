import os
from unittest.mock import MagicMock, patch

from django.test import TestCase

from proc.service.load_csv_srv import archive_raw_csv_to_s3

TEST_BUCKET_NAME = "TEST_RAW_METADATA_CSV_BUCKET"


class ArchiveRawCsvToS3UnitTests(TestCase):

    def setUp(self) -> None:
        super().setUp()
        self._env_patcher = patch.dict(os.environ, {"RAW_METADATA_CSV_BUCKET_NAME": TEST_BUCKET_NAME})
        self._env_patcher.start()

    def tearDown(self) -> None:
        self._env_patcher.stop()
        super().tearDown()

    @patch("proc.service.load_csv_srv.boto3.client")
    def test_archive_raw_csv_uploads_to_configured_bucket(self, mock_boto3_client) -> None:
        """
        python manage.py test proc.tests.test_load_csv_srv.ArchiveRawCsvToS3UnitTests.test_archive_raw_csv_uploads_to_configured_bucket
        """
        mock_s3_client = MagicMock()
        mock_boto3_client.return_value = mock_s3_client

        raw_csv = b"subject_id,library_id\nSBJ001,L10001\n"
        source_url = "https://presigned.example.com/path/to/custom_metadata.csv?X-Amz-Signature=abc123"

        object_key = archive_raw_csv_to_s3(raw_csv, source_url=source_url, user_id="test@umccr.org")

        mock_s3_client.put_object.assert_called_once()
        call_kwargs = mock_s3_client.put_object.call_args.kwargs
        self.assertEqual(call_kwargs["Bucket"], TEST_BUCKET_NAME)
        self.assertEqual(call_kwargs["Body"], raw_csv)
        self.assertEqual(call_kwargs["Key"], object_key)

        # Key should end with "<user_id>-<original_filename>", with no date-based subfolder
        self.assertTrue(object_key.endswith("test@umccr.org-custom_metadata.csv"), object_key)
        self.assertNotIn("/", object_key, "object key should be flat, no subfolders")

    def test_archive_raw_csv_raises_when_bucket_not_configured(self) -> None:
        """
        python manage.py test proc.tests.test_load_csv_srv.ArchiveRawCsvToS3UnitTests.test_archive_raw_csv_raises_when_bucket_not_configured
        """
        self._env_patcher.stop()
        os.environ.pop("RAW_METADATA_CSV_BUCKET_NAME", None)

        with self.assertRaises(RuntimeError):
            archive_raw_csv_to_s3(b"a,b\n1,2\n", source_url="https://example.com/data.csv", user_id="test@umccr.org")

        # restart patcher so tearDown doesn't double-stop
        self._env_patcher = patch.dict(os.environ, {"RAW_METADATA_CSV_BUCKET_NAME": TEST_BUCKET_NAME})
        self._env_patcher.start()

    @patch("proc.service.load_csv_srv.boto3.client")
    def test_archive_raw_csv_raises_when_upload_fails(self, mock_boto3_client) -> None:
        """
        python manage.py test proc.tests.test_load_csv_srv.ArchiveRawCsvToS3UnitTests.test_archive_raw_csv_raises_when_upload_fails

        Archival must be mandatory: if the S3 upload fails, this must raise so ingestion is aborted.
        """
        mock_s3_client = MagicMock()
        mock_s3_client.put_object.side_effect = Exception("S3 is down")
        mock_boto3_client.return_value = mock_s3_client

        with self.assertRaises(RuntimeError):
            archive_raw_csv_to_s3(
                b"a,b\n1,2\n", source_url="https://example.com/data.csv", user_id="test@umccr.org"
            )
