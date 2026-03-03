from rest_framework import serializers


class GsheetRecordsSerializer(serializers.Serializer):
    columns = serializers.ListField(
        child=serializers.CharField()
    )
    values = serializers.ListField(
        child=serializers.ListField(child=serializers.CharField())
    )


class GsheetPreviewRequestSerializer(serializers.Serializer):
    year = serializers.CharField(required=True, max_length=4, min_length=4)
    ranges = serializers.ListField(child=serializers.CharField(), required=True)


class SyncGSheetSerializer(serializers.Serializer):
    year = serializers.CharField(required=True, max_length=4, min_length=4)
    ranges = serializers.ListField(child=serializers.CharField(), required=False)


class SyncCustomCsvSerializer(serializers.Serializer):
    presigned_url = serializers.URLField(required=True)
    reason = serializers.CharField(required=False)
