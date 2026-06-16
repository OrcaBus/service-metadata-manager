import path from 'path';
import { Construct } from 'constructs';
import { StackProps } from 'aws-cdk-lib';
import { Vpc, VpcLookupOptions, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Code, Runtime, Architecture, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { OrcaBusApiGatewayProps } from '@orcabus/platform-cdk-constructs/api-gateway';

import { LambdaSyncGsheetConstruct } from './construct/lambda-sync-gsheet';
import { LambdaMigrationConstruct } from './construct/lambda-migration';
import { LambdaAPIConstruct } from './construct/lambda-api';
import { LambdaLoadCustomCSVConstruct } from './construct/lambda-load-custom-csv';
import { LambdaDjangoCommandConstruct } from './construct/lambda-django-command';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  DB_CLUSTER_ENDPOINT_HOST_PARAMETER_NAME,
  formatRdsPolicyName,
} from '@orcabus/platform-cdk-constructs/shared-config/database';
import { EventSchemaConstruct } from './construct/event-schema';
import { GitStack } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';

export type MetadataManagerStackProps = {
  /**
   * VPC (lookup props) that will be used by resources
   */
  vpcProps: VpcLookupOptions;
  /**
   * Existing security group name to be attached on lambdas
   */
  lambdaSecurityGroupName: string;
  /**
   * A boolean to tell whether the sync lambda should run daily
   */
  isDailySync: boolean;
  /**
   * API Gateway props
   */
  apiGatewayCognitoProps: OrcaBusApiGatewayProps;
  /**
   * API Gateway props
   */
  eventBusName: string;
};

export class MetadataManagerStack extends GitStack {
  private readonly METADATA_MANAGER_DB_NAME = 'metadata_manager';
  private readonly METADATA_MANAGER_DB_USER = 'metadata_manager';

  constructor(scope: Construct, id: string, props: StackProps & MetadataManagerStackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    const lambdaSG = SecurityGroup.fromLookupByName(
      this,
      'LambdaSecurityGroup',
      props.lambdaSecurityGroupName,
      vpc
    );

    // despite of multiple lambda all of them will share the same dependencies
    const dependencySlimLayer = new LayerVersion(this, 'DependenciesLayer', {
      code: Code.fromDockerBuild(__dirname + '/../../', {
        file: 'metadata-manager/deps/requirements-slim.Dockerfile',
        imagePath: 'home/output',
      }),
      compatibleArchitectures: [Architecture.ARM_64],
      compatibleRuntimes: [Runtime.PYTHON_3_12],
    });

    const clusterHostEndpoint = StringParameter.valueForStringParameter(
      this,
      DB_CLUSTER_ENDPOINT_HOST_PARAMETER_NAME
    );
    const rdsConnectPolicy = ManagedPolicy.fromManagedPolicyName(
      this,
      'RdsConnectPolicy',
      formatRdsPolicyName(this.METADATA_MANAGER_DB_USER)
    );

    const basicLambdaConfig = {
      entry: path.join(__dirname, '../../metadata-manager'),
      runtime: Runtime.PYTHON_3_12,
      layers: [dependencySlimLayer],
      bundling: {
        assetExcludes: ['*__pycache__*', '*.DS_Store*', '*.idea*', '*.venv*'],
      },
      environment: {
        DJANGO_SETTINGS_MODULE: 'app.settings.aws',
        PG_HOST: clusterHostEndpoint,
        PG_USER: this.METADATA_MANAGER_DB_USER,
        PG_DB_NAME: this.METADATA_MANAGER_DB_NAME,
      },
      securityGroups: [lambdaSG],
      vpc: vpc,
      vpcSubnets: { subnets: vpc.privateSubnets },
      architecture: Architecture.ARM_64,
      memorySize: 1024,
    };

    new LambdaMigrationConstruct(this, 'MigrationLambda', {
      basicLambdaConfig: basicLambdaConfig,
      rdsConnectPolicy: rdsConnectPolicy,
      vpc: vpc,
    });

    new LambdaDjangoCommandConstruct(this, 'DjangoCommandLambda', {
      basicLambdaConfig: basicLambdaConfig,
      rdsConnectPolicy: rdsConnectPolicy,
    });

    const syncGsheetLambda = new LambdaSyncGsheetConstruct(this, 'SyncGsheetLambda', {
      basicLambdaConfig: basicLambdaConfig,
      rdsConnectPolicy: rdsConnectPolicy,
      isDailySync: props.isDailySync,
      eventBusName: props.eventBusName,
    });

    const syncCustomCsvLambda = new LambdaLoadCustomCSVConstruct(this, 'CustomCsvLoaderLambda', {
      basicLambdaConfig: basicLambdaConfig,
      rdsConnectPolicy: rdsConnectPolicy,
      eventBusName: props.eventBusName,
    });

    new LambdaAPIConstruct(this, 'APILambda', {
      basicLambdaConfig: basicLambdaConfig,
      rdsConnectPolicy: rdsConnectPolicy,
      apiGatewayConstructProps: props.apiGatewayCognitoProps,
      syncCustomCsvLambda: syncCustomCsvLambda.lambda,
      syncGsheetLambda: syncGsheetLambda.lambda,
    });

    new EventSchemaConstruct(this, 'EventSchema');
  }
}
