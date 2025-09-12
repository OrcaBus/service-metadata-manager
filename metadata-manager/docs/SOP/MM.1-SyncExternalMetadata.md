# MM.1 - Sync External Metadata

## Introduction

External metadata may need to be imported into the system from sources outside the lab. This SOP describes how to prepare, upload, and sync such metadata using the Metadata Manager service.

---

## Procedure

### 1. Prepare the CSV File

Create a CSV files with the following details:

### Custom CSV File Loader

Create a CSV file with the following columns. Each column header maps to the corresponding table and field name as shown
below:

| Sheet Header         | Table        | Field Name         |
| -------------------- | ------------ | ------------------ |
| individual_id        | `Individual` | individual_id      |
| individual_id_source | `Individual` | source             |
| \*subject_id         | `Subject`    | subject_id         |
| sample_id            | `Sample`     | sample_id          |
| external_sample_id   | `Sample`     | external_sample_id |
| source               | `Sample`     | source             |
| \*library_id         | `Library`    | library_id         |
| phenotype            | `Library`    | phenotype          |
| workflow             | `Library`    | workflow           |
| quality              | `Library`    | quality            |
| type                 | `Library`    | type               |
| coverage             | `Library`    | coverage           |
| assay                | `Library`    | assay              |
| override_cycles      | `Library`    | override_cycles    |
| project_name         | `Project`    | project_id         |
| project_owner        | `Contact`    | contact_id         |

All asterisked (\*) header are required fields to process a record.

- The CSV file must be accessible via a **presigned URL** (e.g., from S3 or GitHub).
- Ensure the file is tracked in your storage (e.g., upload to S3 or GitHub).

### 2. Sync the CSV File

You can sync the CSV file using one of the following methods:

#### **A. Swagger UI**

1. Go to: [Swagger UI](https://metadata.prod.umccr.org/schema/swagger-ui/#/)
2. Use the `/api/v1/sync/presigned-csv/` endpoint.
3. Paste the presigned URL and provide a reason if required.

#### **B. Command Line (CLI)**

```sh
curl -X 'POST' \
  'https://metadata.[STAGE].umccr.org/api/v1/sync/presigned-csv/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "presignedUrl": "THE_URL",
  "reason": "Description of the sync"
}'
```

Replace `THE_URL` with your actual presigned URL.

#### **C. Portal UI**

1. Navigate to the Lab page.
2. Click **Import**.
3. Select **Presigned CSV File**.
4. Paste the presigned link and provide a reason (if any).

---

## References

- [API Documentation](../../README.md#api)
- [CSV Loader Implementation](../proc/service/load_csv_srv.py)
