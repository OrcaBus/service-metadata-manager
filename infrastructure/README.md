# Metadata Manager Deployment Center

The IaC for this microservice is written in AWS CDK Typescript. The deployment stack named `MetadataManagerStack` is in the
`stack.ts` file in the `./deploy` directory. This will construct the relevant resources.

## Architecture

![arch](../docs/architecture.drawio.svg)

To modify the diagram, open the `docs/architecture.drawio.svg` with [diagrams.net](https://app.diagrams.net/?src=about).

## Construct

### APIGW

- Create an API Gateway to be used for this application

### APILambda

- The Lambda is responsible for dealing with API Request from API Gateway

### MigrationLambda

- Responsible for executing migration to the database

### SyncGsheetLambda

- Load tracking sheet data in Google Drive and map it to the Application model
- Periodically trigger the sync every night (only in PROD)
  - It will trigger at 22:30 AEST or 23:30 AEDT as the schedule is defined at 12:30 (pm) UTC
  - The default synchronization process only occurs for the current year. Therefore, scheduling the sync to run every
    night, as opposed to every morning, ensures that all entries from the day are properly synced to the system.

To manually trigger the sync, the lambda ARN is stored in the SSM Parameter Store named
`/orcabus/metadata-manager/sync-gsheet-lambda-arn`.

To query in a local terminal

```sh
gsheet_sync_lambda_arn=$(aws ssm get-parameter --name '/orcabus/metadata-manager/sync-gsheet-lambda-arn' --with-decryption | jq -r .Parameter.Value)
```

The lambda handler accepts a json with two parameters:
- `year` - a single year from which to run the sheet from the GSheet workbook. Default is the current year.
- `is_emit_eb_events` - determines whether to emit events to event bus. Default is `true`.

```json
{
  "year": "2024",
  "is_emit_eb_events": false
}
```

Invoking lambda cmd:

```sh
aws lambda invoke \
  --function-name $gsheet_sync_lambda_arn \
  --invocation-type Event \
  --payload '{ "year": "2024" }' \
  --cli-binary-format raw-in-base64-out \
  res.json
```

### CustomCsvLambda

- Load tracking sheet data from csv presigned url

To manually trigger the sync, the lambda ARN is stored in the SSM Parameter Store named
`/orcabus/metadata-manager/load-custom-csv-lambda-arn`.

To query in a local terminal

```sh
load_custom_csv_lambda_arn=$(aws ssm get-parameter --name '/orcabus/metadata-manager/load-custom-csv-lambda-arn' --with-decryption | jq -r .Parameter.Value)
```

The lambda handler accepts a json with two parameters:
- `url` - a presigned url of the csv file. _required_
- `user_id` - The user id recorded for auditing (this could be email). _required_.
- `is_emit_eb_events` - determines whether to emit events to the Event Bus. Default is `true`.
- `reason` - The reason/description for the sync.


```json
{
  "url": "https://example.com/csv",
  "is_emit_eb_events": false,
  "user_id": "john.doe@email.com",
  "reason": "reason/comment for the sync"
}
```

Invoking lambda cmd:

```sh
aws lambda invoke \
  --function-name $load_custom_csv_lambda_arn \
  --invocation-type Event \
  --payload '{ "url": "https://the.url.csv" }' \
  --cli-binary-format raw-in-base64-out \
  res.json
```
