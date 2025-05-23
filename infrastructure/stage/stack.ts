import path from 'path';
import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc, VpcLookupOptions, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Code, Runtime, Architecture, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { OrcaBusApiGatewayProps } from '@orcabus/platform-cdk-constructs/api-gateway';

import { LambdaSyncGsheetConstruct } from './construct/lambda-sync-gsheet';
import { LambdaMigrationConstruct } from './construct/lambda-migration';
import { LambdaAPIConstruct } from './construct/lambda-api';
import { LambdaLoadCustomCSVConstruct } from './construct/lambda-load-custom-csv';
import { LambdaDjangoCommandConstruct } from './construct/lambda-django-command';

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

export class MetadataManagerStack extends Stack {
  private readonly MM_RDS_CRED_SECRET_NAME = 'orcabus/metadata_manager/rds-login-credential'; // pragma: allowlist secret

  constructor(scope: Construct, id: string, props: StackProps & MetadataManagerStackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    const lambdaSG = SecurityGroup.fromLookupByName(
      this,
      'LambdaSecurityGroup',
      props.lambdaSecurityGroupName,
      vpc
    );

    // lookup the secret manager resource so we could give lambda permissions to read it
    const dbSecret = Secret.fromSecretNameV2(
      this,
      'DbSecretConnection',
      this.MM_RDS_CRED_SECRET_NAME
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

    const basicLambdaConfig = {
      entry: path.join(__dirname, '../../metadata-manager'),
      runtime: Runtime.PYTHON_3_12,
      layers: [dependencySlimLayer],
      bundling: {
        assetExcludes: ['*__pycache__*', '*.DS_Store*', '*.idea*', '*.venv*'],
      },
      environment: {
        DJANGO_SETTINGS_MODULE: 'app.settings.aws',
        RDS_CRED_SECRET_NAME: this.MM_RDS_CRED_SECRET_NAME,
      },
      securityGroups: [lambdaSG],
      vpc: vpc,
      vpcSubnets: { subnets: vpc.privateSubnets },
      architecture: Architecture.ARM_64,
      memorySize: 1024,
    };

    new LambdaMigrationConstruct(this, 'MigrationLambda', {
      basicLambdaConfig: basicLambdaConfig,
      dbConnectionSecret: dbSecret,
      vpc: vpc,
    });

    new LambdaDjangoCommandConstruct(this, 'DjangoCommandLambda', {
      basicLambdaConfig: basicLambdaConfig,
      dbConnectionSecret: dbSecret,
    });

    const syncGsheetLambda = new LambdaSyncGsheetConstruct(this, 'SyncGsheetLambda', {
      basicLambdaConfig: basicLambdaConfig,
      dbConnectionSecret: dbSecret,
      isDailySync: props.isDailySync,
      eventBusName: props.eventBusName,
    });

    const syncCustomCsvLambda = new LambdaLoadCustomCSVConstruct(this, 'CustomCsvLoaderLambda', {
      basicLambdaConfig: basicLambdaConfig,
      dbConnectionSecret: dbSecret,
      eventBusName: props.eventBusName,
    });

    new LambdaAPIConstruct(this, 'APILambda', {
      basicLambdaConfig: basicLambdaConfig,
      dbConnectionSecret: dbSecret,
      apiGatewayConstructProps: props.apiGatewayCognitoProps,
      syncCustomCsvLambda: syncCustomCsvLambda.lambda,
      syncGsheetLambda: syncGsheetLambda.lambda,
    });
  }
}
