import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction, PythonFunctionProps } from '@aws-cdk/aws-lambda-python-alpha';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { InvocationType, Trigger } from 'aws-cdk-lib/triggers';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import {
  ChainDefinitionBody,
  IntegrationPattern,
  Pass,
  StateMachine,
  Succeed,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import {
  LambdaInvocationType,
  LambdaInvoke,
  StepFunctionsStartExecution,
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Architecture, DockerImageCode, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import path from 'path';

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
  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    // Lambda to perform migration
    const migrationLambda = new PythonFunction(this, 'MigrationLambda', {
      ...props.basicLambdaConfig,
      index: 'handler/migrate.py',
      handler: 'handler',
      timeout: Duration.minutes(5),
    });
    props.databaseCluster.grantConnect(migrationLambda, props.databaseName);

    // To invoke the migration lambda
    const lambdaMigrationStep = new LambdaInvoke(this, 'MigrationLambdaInvoke', {
      lambdaFunction: migrationLambda,
      integrationPattern: IntegrationPattern.REQUEST_RESPONSE,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      payload: TaskInput.fromObject({}),
    });

    // Execute the backup step (pg-dd)
    const backupStateMachine = StateMachine.fromStateMachineName(
      this,
      'BackupStateMachine',
      'orcabus-pg-dd'
    );
    const backupPgDDStep = new StepFunctionsStartExecution(this, 'ExecuteBackup', {
      stateMachine: backupStateMachine,
      integrationPattern: IntegrationPattern.RUN_JOB,
      input: TaskInput.fromObject({
        commands: ['upload', '--dump-db', '--database', 'metadata_manager'],
      }),
    });

    // Create state machine to orchestrate the backup and migration steps
    const startState = new Pass(this, 'StartState');
    const finish = new Succeed(this, 'SuccessState');

    const backupMigrationStep = new StateMachine(this, 'backupMigrationStep', {
      stateMachineName: 'orcabus-metadata-manager-migration',
      definitionBody: ChainDefinitionBody.fromChainable(
        startState.next(backupPgDDStep).next(lambdaMigrationStep).next(finish)
      ),
    });

    backupStateMachine.grantStartExecution(backupMigrationStep);
    backupStateMachine.grantRead(backupMigrationStep);

    // Trigger lambda to start the backup-migration step function
    const triggerLambda = new DockerImageFunction(this, 'TriggerStepLambda', {
      architecture: Architecture.ARM_64,
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../../../'), {
        file: 'infrastructure/stage/construct/lambda-migration/trigger-handler/Dockerfile',
      }),
      timeout: Duration.minutes(10),
      memorySize: 128,
      environment: {
        STATE_MACHINE_ARN: backupMigrationStep.stateMachineArn,
      },
    });

    backupMigrationStep.grantStartExecution(triggerLambda);
    backupMigrationStep.grantRead(triggerLambda);

    new Trigger(this, 'ExecuteBackupStepLambdaTrigger', {
      handler: triggerLambda,
      timeout: Duration.minutes(5),
      invocationType: InvocationType.REQUEST_RESPONSE,
    });
  }
}
