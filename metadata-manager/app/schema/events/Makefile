.PHONY: generate-event-models


generate-event-models:
	@datamodel-codegen \
		--input ./MetadataStateChange/MetadataStateChange.schema.json \
		--input-file-type jsonschema \
		--output ./metadata_state_change_model.py


test-msc:
	@check-jsonschema --schemafile MetadataStateChange/MetadataStateChange.schema.json MetadataStateChange/example/MSC__example1.json
	@check-jsonschema --schemafile MetadataStateChange/MetadataStateChange.schema.json MetadataStateChange/example/MSC__example2.json
