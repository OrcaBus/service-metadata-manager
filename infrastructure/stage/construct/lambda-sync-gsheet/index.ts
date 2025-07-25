import path from 'path';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Rule, Schedule, EventBus } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  DockerImageFunction,
  DockerImageFunctionProps,
  DockerImageCode,
} from 'aws-cdk-lib/aws-lambda';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';

type LambdaProps = {
  /**
   * The basic common lambda properties that it should inherit from
   */
  basicLambdaConfig: Partial<DockerImageFunctionProps>;
  /**
   * The db cluster to where the lambda authorize to connect
   */
  databaseCluster: IDatabaseCluster;
  /**
   * The database name that the lambda will use
   */
  databaseName: string;
  /**
   * If the lambda should run daily sync
   */
  isDailySync: boolean;
  /**
   * The eventBusName to notify metadata state change
   */
  eventBusName: string;
};

export class LambdaSyncGsheetConstruct extends Construct {
  private readonly GDRIVE_CRED_PARAM_NAME = '/umccr/google/drive/lims_service_account_json';
  private readonly GDRIVE_SHEET_ID_PARAM_NAME = '/umccr/google/drive/tracking_sheet_id';

  readonly lambda: PythonFunction;

  constructor(scope: Construct, id: string, lambdaProps: LambdaProps) {
    super(scope, id);

    this.lambda = new DockerImageFunction(this, 'SyncGSheetLambda', {
      environment: {
        ...lambdaProps.basicLambdaConfig.environment,
        SSM_NAME_GDRIVE_ACCOUNT: this.GDRIVE_CRED_PARAM_NAME,
        SSM_NAME_TRACKING_SHEET_ID: this.GDRIVE_SHEET_ID_PARAM_NAME,
        EVENT_BUS_NAME: lambdaProps.eventBusName,
      },
      securityGroups: lambdaProps.basicLambdaConfig.securityGroups,
      vpc: lambdaProps.basicLambdaConfig.vpc,
      vpcSubnets: lambdaProps.basicLambdaConfig.vpcSubnets,
      architecture: lambdaProps.basicLambdaConfig.architecture,
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../../../'), {
        file: 'infrastructure/stage/construct/lambda-sync-gsheet/lambda.Dockerfile',
      }),
      timeout: Duration.minutes(15),
      memorySize: 4096,
    });
    lambdaProps.databaseCluster.grantConnect(this.lambda, lambdaProps.databaseName);

    // the sync-db lambda would need some cred to access GDrive and these are stored in SSM
    const trackingSheetCredSSM = StringParameter.fromSecureStringParameterAttributes(
      this,
      'GSheetCredSSM',
      { parameterName: this.GDRIVE_CRED_PARAM_NAME }
    );
    const trackingSheetIdSSM = StringParameter.fromSecureStringParameterAttributes(
      this,
      'TrackingSheetIdSSM',
      { parameterName: this.GDRIVE_SHEET_ID_PARAM_NAME }
    );
    trackingSheetCredSSM.grantRead(this.lambda);
    trackingSheetIdSSM.grantRead(this.lambda);

    // We need to store this lambda ARN somewhere so that we could refer when need to sync this manually
    new StringParameter(this, 'SyncGsheetLambdaArnParameterStore', {
      parameterName: '/orcabus/metadata-manager/sync-gsheet-lambda-arn',
      description: 'The ARN of the lambda that syncs metadata from GSheet',
      stringValue: this.lambda.functionArn,
    });

    if (lambdaProps.isDailySync) {
      // Add scheduled event to re-sync metadata every midnight
      const gsheetSyncLambdaEventTarget = new LambdaFunction(this.lambda);
      new Rule(this, 'SyncGsheetMetadataScheduledRule', {
        description: 'Scheduled rule to sync metadata from GSheet',
        schedule: Schedule.expression('cron(30 12 * * ? *)'), // see ./deploy/readme.md
        targets: [gsheetSyncLambdaEventTarget],
      });
    }

    // The lambda will need permission to put events to the event bus when metadata state change
    const orcabusEventBus = EventBus.fromEventBusName(this, 'EventBus', lambdaProps.eventBusName);
    orcabusEventBus.grantPutEventsTo(this.lambda);
  }
}
