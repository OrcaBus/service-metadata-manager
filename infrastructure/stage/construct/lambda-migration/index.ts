import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction, PythonFunctionProps } from '@aws-cdk/aws-lambda-python-alpha';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { InvocationType, Trigger } from 'aws-cdk-lib/triggers';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';

type LambdaProps = {
  /**
   * The basic common lambda properties that it should inherit from
   */
  basicLambdaConfig: PythonFunctionProps;
  /**
   * The db cluster to where the lambda authorize to connect
   */
  databaseCluster: IDatabaseCluster;
  /**
   * The database name that the lambda will use
   */
  databaseName: string;
  /**
   * VPC used for Custom Provider Function
   */
  vpc: IVpc;
};

export class LambdaMigrationConstruct extends Construct {
  private readonly lambda: PythonFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    this.lambda = new PythonFunction(this, 'MigrationLambda', {
      ...props.basicLambdaConfig,
      index: 'handler/migrate.py',
      handler: 'handler',
      timeout: Duration.minutes(5),
    });
    props.databaseCluster.grantConnect(this.lambda, props.databaseName);

    new Trigger(this, 'MigrationLambdaTrigger', {
      handler: this.lambda,
      timeout: Duration.minutes(5),
      invocationType: InvocationType.REQUEST_RESPONSE,
    });
  }
}
