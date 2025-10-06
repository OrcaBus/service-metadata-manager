.PHONY: generate-event-models


generate-event-models:
	@datamodel-codegen \
		--input ../../../../docs/events/MetadataStateChange/MetadataStateChange.schema.json \
		--input-file-type jsonschema \
		--output ./metadata_state_change_model.py


test:
	@check-jsonschema --schemafile ../../../../docs/events/MetadataStateChange/MetadataStateChange.schema.json \
		../../../../docs/events/MetadataStateChange/example/MSC__example1.json
	@check-jsonschema --schemafile ../../../../docs/events/MetadataStateChange/MetadataStateChange.schema.json \
		../../../../docs/events/MetadataStateChange/example/MSC__example2.json
