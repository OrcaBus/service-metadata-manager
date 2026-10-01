import { SynthesisMessage } from 'aws-cdk-lib/cx-api';
import { App } from 'aws-cdk-lib';

export function synthesisMessageToString(sm: SynthesisMessage): string {
  return `${sm.entry.data} [${sm.id}]`;
}

/**
 * Sets fake-but-valid-shaped VPC and security group lookup context on the given app,
 * so that `Vpc.fromLookup` / `SecurityGroup.fromLookupByName` resolve to realistic
 * dummy values instead of CDK's placeholder fallback (e.g. vpc-12345, subnet-p-12345).
 *
 * This avoids noisy "does not match pattern" template-validation warnings in tests
 * that use fake AWS accounts which have no real VPC context cached in cdk.context.json.
 */
export function mockVpcContext(
  app: App,
  account: string,
  region: string,
  securityGroupName: string
) {
  const vpcId = 'vpc-0123456789abcdef0';

  app.node.setContext(
    `vpc-provider:account=${account}:filter.tag:Name=main-vpc:filter.tag:Stack=networking:region=${region}:returnAsymmetricSubnets=true`,
    {
      vpcId,
      vpcCidrBlock: '10.2.0.0/16',
      ownerAccountId: account,
      availabilityZones: [],
      subnetGroups: [
        {
          name: 'private',
          type: 'Private',
          subnets: [
            {
              subnetId: 'subnet-0123456789abcdef1',
              cidr: '10.2.20.0/23',
              availabilityZone: `${region}a`,
              routeTableId: 'rtb-0123456789abcdef2',
            },
            {
              subnetId: 'subnet-0123456789abcdef3',
              cidr: '10.2.22.0/23',
              availabilityZone: `${region}b`,
              routeTableId: 'rtb-0123456789abcdef2',
            },
          ],
        },
      ],
    }
  );

  app.node.setContext(
    `security-group:account=${account}:region=${region}:securityGroupName=${securityGroupName}:vpcId=${vpcId}`,
    {
      securityGroupId: 'sg-0123456789abcdef4',
      allowAllOutbound: false,
    }
  );
}
