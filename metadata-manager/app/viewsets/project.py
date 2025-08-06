from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.response import Response

from app.models import Project
from app.serializers.project import ProjectDetailSerializer, ProjectSerializer, ProjectHistorySerializer

from .base import BaseViewSet


class ProjectViewSet(BaseViewSet):
    serializer_class = ProjectSerializer
    search_fields = Project.get_base_fields()
    queryset = Project.objects.all()

    @extend_schema(responses=ProjectDetailSerializer(many=False))
    def retrieve(self, request, *args, **kwargs):
        self.serializer_class = ProjectDetailSerializer
        self.queryset = Project.objects.prefetch_related("contact_set").all()
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        parameters=[
            ProjectSerializer
        ],
        responses=ProjectDetailSerializer(many=True),
    )
    def list(self, request, *args, **kwargs):
        self.serializer_class = ProjectDetailSerializer
        self.queryset = Project.objects.prefetch_related("contact_set").all()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        query_params = self.request.query_params.copy()
        return Project.objects.get_by_keyword(self.queryset, **query_params)

    @extend_schema(responses=ProjectHistorySerializer(many=True), description="Retrieve the history of this model")
    @action(detail=True, methods=['get'], url_name='history', url_path='history')
    def retrieve_history(self, request, *args, **kwargs):
        return super().retrieve_history(ProjectHistorySerializer)

    @extend_schema(responses=ProjectDetailSerializer(many=False), description="Unlink contact from project", )
    @action(detail=True, methods=['delete'], url_name='remove_contact_relationship',
            url_path='contact/(?P<contact_orcabus_id>[^/]+)/relationship')
    def remove_contact_relationship(self, request, *args, **kwargs):
        self.serializer_class = ProjectDetailSerializer
        project_orcabus_id = kwargs.get('pk', None)
        contact_orcabus_id = kwargs.get('contact_orcabus_id', None)

        project = Project.objects.get(pk=project_orcabus_id)
        try:
            contact = project.contact_set.get(orcabus_id=contact_orcabus_id)
            project.contact_set.remove(contact)

            serializer = self.get_serializer(project)
            return Response(serializer.data)
        except project.contact_set.model.DoesNotExist:
            return Response({'detail': 'Contact not found.'}, status=status.HTTP_404_NOT_FOUND)
