import path from 'path';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
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
};

export class LambdaDjangoCommandConstruct extends Construct {
  readonly lambda: PythonFunction;

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
      }),
      timeout: Duration.minutes(15),
      memorySize: 4096,
    });
    lambdaProps.databaseCluster.grantConnect(this.lambda, lambdaProps.databaseName);
  }
}
