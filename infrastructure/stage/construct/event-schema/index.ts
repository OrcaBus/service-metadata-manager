import { EVENT_SCHEMA_REGISTRY_NAME } from '@orcabus/platform-cdk-constructs/shared-config/event-bridge';
import { CfnSchema } from 'aws-cdk-lib/aws-eventschemas';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { join } from 'path';

export class EventSchemaConstruct extends Construct {
  private readonly SCHEMA_REGISTRY_NAME = 'orcabus.metadatamanager';

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.constructSchema({
      name: `${this.SCHEMA_REGISTRY_NAME}@MetadataStateChange`,
      schemaPath: '../../../../docs/events/MetadataStateChange/MetadataStateChange.schema.json',
      description: 'State change event for lab metadata changes',
    });
  }

  private constructSchema = (props: {
    /**
     * The schema name
     */
    name: string;
    /**
     * The path to the schema JSON file relative to this file
     */
    schemaPath: string;
    /**
     * Optional description for the schema
     */
    description?: string;
  }) => {
    return new CfnSchema(this, `EventSchema${props.name}`, {
      registryName: EVENT_SCHEMA_REGISTRY_NAME,
      type: 'JSONSchemaDraft4',
      content: readFileSync(join(__dirname, props.schemaPath), 'utf-8'),
      description: props.description,
      schemaName: props.name,
    });
  };
}
