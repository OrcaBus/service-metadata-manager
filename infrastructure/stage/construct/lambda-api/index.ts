import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import {
  HttpMethod,
  HttpNoneAuthorizer,
  HttpRoute,
  HttpRouteKey,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { PythonFunction, PythonFunctionProps } from '@aws-cdk/aws-lambda-python-alpha';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  OrcaBusApiGateway,
  OrcaBusApiGatewayProps,
} from '@orcabus/platform-cdk-constructs/api-gateway';
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
   * The props for api-gateway
   */
  apiGatewayConstructProps: OrcaBusApiGatewayProps;
  /**
   * sync db from gsheet lambda
   */
  syncGsheetLambda: Function;
  /**
   * sync db from csv file lambda
   */
  syncCustomCsvLambda: Function;
};

export class LambdaAPIConstruct extends Construct {
  private readonly lambda: PythonFunction;
  private readonly API_VERSION = 'v1';

  constructor(scope: Construct, id: string, lambdaProps: LambdaProps) {
    super(scope, id);

    const apiGW = new OrcaBusApiGateway(
      this,
      'OrcaBusAPI-MetadataManager',
      lambdaProps.apiGatewayConstructProps
    );

    this.lambda = new PythonFunction(this, 'APILambda', {
      ...lambdaProps.basicLambdaConfig,
      index: 'handler/api.py',
      handler: 'handler',
      timeout: Duration.seconds(28),
      // The optimum memory from lambda power tuning tool (Result based on enforcing cold start)
      // https://lambda-power-tuning.show/#gAAAAQACAAQABgAI;ulPPRclpmUU0UHpFIoxhRT3aVkVGyk9F;XJ7INgXRyTZLUMM2DoLGNpPG0DZMo/42
      memorySize: 1024,
    });
    lambdaProps.databaseCluster.grantConnect(this.lambda, lambdaProps.databaseName);

    // add some integration to the http api gw
    const apiIntegration = new HttpLambdaIntegration('ApiLambdaIntegration', this.lambda);

    // Routes for API schemas
    new HttpRoute(this, 'GetSchemaHttpRoute', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      authorizer: new HttpNoneAuthorizer(), // No auth needed for schema
      routeKey: HttpRouteKey.with(`/schema/{PROXY+}`, HttpMethod.GET),
    });

    new HttpRoute(this, 'GetHttpRoute', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      routeKey: HttpRouteKey.with(`/api/${this.API_VERSION}/{PROXY+}`, HttpMethod.GET),
    });
    new HttpRoute(this, 'PostHttpRoute', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      authorizer: apiGW.authStackHttpLambdaAuthorizer,
      routeKey: HttpRouteKey.with(`/api/${this.API_VERSION}/{PROXY+}`, HttpMethod.POST),
    });
    new HttpRoute(this, 'PatchHttpRoute', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      authorizer: apiGW.authStackHttpLambdaAuthorizer,
      routeKey: HttpRouteKey.with(`/api/${this.API_VERSION}/{PROXY+}`, HttpMethod.PATCH),
    });
    new HttpRoute(this, 'DeleteHttpRoute', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      authorizer: apiGW.authStackHttpLambdaAuthorizer,
      routeKey: HttpRouteKey.with(`/api/${this.API_VERSION}/{PROXY+}`, HttpMethod.DELETE),
    });

    // Add permission, HTTP route, and env-var for the sync lambdas

    lambdaProps.syncGsheetLambda.grantInvoke(this.lambda);
    this.lambda.addEnvironment(
      'SYNC_GSHEET_LAMBDA_NAME',
      lambdaProps.syncGsheetLambda.functionName
    );
    new HttpRoute(this, 'PostHttpRouteSyncGsheet', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      routeKey: HttpRouteKey.with(`/api/${this.API_VERSION}/sync/gsheet/{PROXY+}`, HttpMethod.POST),
    });

    lambdaProps.syncCustomCsvLambda.grantInvoke(this.lambda);
    this.lambda.addEnvironment(
      'SYNC_CSV_PRESIGNED_URL_LAMBDA_NAME',
      lambdaProps.syncCustomCsvLambda.functionName
    );
    new HttpRoute(this, 'PostHttpRouteSyncPresignedCsv', {
      httpApi: apiGW.httpApi,
      integration: apiIntegration,
      // Only admin group can use this csv sync endpoint
      authorizer: apiGW.authStackHttpLambdaAuthorizer,
      routeKey: HttpRouteKey.with(
        `/api/${this.API_VERSION}/sync/presigned-csv/{PROXY+}`,
        HttpMethod.POST
      ),
    });
  }
}
