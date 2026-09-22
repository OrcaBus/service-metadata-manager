import path from 'path';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import {
  DockerImageFunction,
  DockerImageFunctionProps,
  DockerImageCode,
} from 'aws-cdk-lib/aws-lambda';
import { IManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';

type LambdaProps = {
  /**
   * The basic common lambda properties that it should inherit from
   */
  basicLambdaConfig: Partial<DockerImageFunctionProps>;
  /**
   * Managed policy granting `rds-db:connect` on the RDS cluster
   */
  rdsConnectPolicy: IManagedPolicy;
};

export class LambdaDjangoCommandConstruct extends Construct {
  readonly lambda: DockerImageFunction;

  constructor(scope: Construct, id: string, lambdaProps: LambdaProps) {
    super(scope, id);

    this.lambda = new DockerImageFunction(this, 'DjangoCommandLambda', {
      environment: {
        ...lambdaProps.basicLambdaConfig.environment,
      },
      securityGroups: lambdaProps.basicLambdaConfig.securityGroups,
      vpc: lambdaProps.basicLambdaConfig.vpc,
      vpcSubnets: lambdaProps.basicLambdaConfig.vpcSubnets,
      architecture: lambdaProps.basicLambdaConfig.architecture,
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../../../'), {
        file: 'infrastructure/stage/construct/lambda-django-command/lambda.Dockerfile',
        platform: Platform.LINUX_ARM64,
      }),
      timeout: Duration.minutes(15),
      memorySize: 4096,
    });
    this.lambda.role?.addManagedPolicy(lambdaProps.rdsConnectPolicy);
  }
}
