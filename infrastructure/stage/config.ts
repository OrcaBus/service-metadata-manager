import { getDefaultApiGatewayConfiguration } from '@orcabus/platform-cdk-constructs/api-gateway';
import { StageName } from '@orcabus/platform-cdk-constructs/utils';
import { VpcLookupOptions } from 'aws-cdk-lib/aws-ec2';

export const getStackProps = (stage: StageName) => {
  const isDailySync = stage === 'PROD' ? true : false;

  // upstream infra: vpc
  const vpcName = 'main-vpc';
  const vpcStackName = 'networking';
  const vpcProps: VpcLookupOptions = {
    vpcName: vpcName,
    tags: {
      Stack: vpcStackName,
    },
  };

  const computeSecurityGroupName = 'OrcaBusSharedComputeSecurityGroup';
  const eventBusName = 'OrcaBusMain';

  return {
    vpcProps,
    isDailySync: isDailySync,
    lambdaSecurityGroupName: computeSecurityGroupName,
    eventBusName: eventBusName,
    apiGatewayCognitoProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'MetadataManager',
      customDomainNamePrefix: 'metadata',
    },
  };
};
