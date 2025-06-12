import { getDefaultApiGatewayConfiguration } from '@orcabus/platform-cdk-constructs/api-gateway';
import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { EVENT_BUS_NAME } from '@orcabus/platform-cdk-constructs/shared-config/event-bridge';
import {
  SHARED_SECURITY_GROUP_NAME,
  VPC_LOOKUP_PROPS,
} from '@orcabus/platform-cdk-constructs/shared-config/networking';

export const getStackProps = (stage: StageName) => {
  const isDailySync = stage === 'PROD' ? true : false;

  return {
    vpcProps: VPC_LOOKUP_PROPS,
    isDailySync: isDailySync,
    lambdaSecurityGroupName: SHARED_SECURITY_GROUP_NAME,
    eventBusName: EVENT_BUS_NAME,
    apiGatewayCognitoProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'MetadataManager',
      customDomainNamePrefix: 'metadata',
    },
  };
};
