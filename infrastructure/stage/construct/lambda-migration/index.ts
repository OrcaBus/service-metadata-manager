import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction, PythonFunctionProps } from '@aws-cdk/aws-lambda-python-alpha';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
// import { TriggerFunction } from 'aws-cdk-lib/triggers';

import { Provider } from 'aws-cdk-lib/custom-resources';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { CfnFunction, IFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnResource, CustomResource } from 'aws-cdk-lib';
import CodeProperty = CfnFunction.CodeProperty;

type LambdaProps = {
  /**
   * The basic common lambda properties that it should inherit from
   */
  basicLambdaConfig: PythonFunctionProps;
  /**
   * The secret for the db connection where the lambda will need access to
   */
  dbConnectionSecret: ISecret;
  /**
   * VPC used for Custom Provider Function
   */
  vpc: IVpc;
};

/* ********* Replace with TriggerFunction ********* */
type ProviderFunctionProps = {
  /**
   * Vpc for the function.
   */
  vpc: IVpc;
  /**
   * The provider function.
   */
  function: IFunction;
  /**
   * Properties that get defined in the template and passed to the Lambda function via `ResourceProperties`.
   */
  resourceProperties?: { [keys: string]: unknown };
  /**
   * An additional hash property that can be used to determine if the custom resource should be updated. By default,
   * this is the s3Key of the Lambda code asset, which is derived from the asset hash. This is used to ensure that
   * the custom resource is updated whenever the Lambda function changes, so that the function gets called again.
   * Add a constant value here to override this behaviour.
   */
  additionalHash?: string;
};
class ProviderFunction extends Construct {
  private readonly _function: IFunction;
  private readonly _response: string;

  constructor(scope: Construct, id: string, props: ProviderFunctionProps) {
    super(scope, id);

    this._function = props.function;

    const provider = new Provider(this, 'Provider', {
      onEventHandler: props.function,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    });
    const customResource = new CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
      properties: props.resourceProperties,
    });

    // Update the custom resource with an additional key.
    (customResource.node.defaultChild as CfnResource).addPropertyOverride(
      'S3Key',
      props.additionalHash ??
        ((this._function.node.defaultChild as CfnFunction).code as CodeProperty).s3Key
    );

    this._response = customResource.getAttString('Response');
  }
}
/* ********* End ********* */

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
    props.dbConnectionSecret.grantRead(this.lambda);

    new ProviderFunction(this, 'AutoMigrateLambdaFunction', {
      vpc: props.vpc,
      function: this.lambda,
    });
  }
}
