import * as fs from 'fs';
import * as path from 'path';
import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { SHARED_SECURITY_GROUP_NAME } from '@orcabus/platform-cdk-constructs/shared-config/networking';
import { StatelessStack } from '../infrastructure/toolchain/stateless-stack';
import { synthesisMessageToString, mockVpcContext } from './utils';

describe('cdk-nag-stateless-toolchain-stack', () => {
  const account = '123456789012';
  const region = 'ap-southeast-2';

  // StatelessStack fans out into beta/gamma/prod stage stacks, each targeting a real
  // OrcaBus account. Those accounts already have real VPC/security-group lookup values
  // cached in cdk.context.json (used automatically by the CDK CLI, but not loaded
  // automatically when constructing an App directly in a test), so load it here too.
  const cdkContextPath = path.join(__dirname, '../cdk.context.json');
  const cdkContext = JSON.parse(fs.readFileSync(cdkContextPath, 'utf-8'));

  const app = new App({ context: cdkContext });
  // Mock context for the pipeline's own (fake) account, which has no real VPC.
  mockVpcContext(app, account, region, SHARED_SECURITY_GROUP_NAME);

  const statelessStack = new StatelessStack(app, 'StatelessStack', {
    env: {
      account,
      region,
    },
  });

  Aspects.of(statelessStack).add(new AwsSolutionsChecks());

  NagSuppressions.addStackSuppressions(statelessStack, [
    { id: 'AwsSolutions-IAM4', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-CB3', reason: 'Allow CDK Pipeline' },
  ]);

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(statelessStack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(statelessStack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
});
