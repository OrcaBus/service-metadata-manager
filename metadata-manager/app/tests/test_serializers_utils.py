import logging

from django.test import TestCase

from app.serializers.utils import to_camel_case_key_dict

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class ToCamelCaseKeyDictTestCase(TestCase):

    def test_flat_dict(self):
        """
        python manage.py test app.tests.test_serializers_utils.ToCamelCaseKeyDictTestCase.test_flat_dict
        Keys are converted; non-dict/list values (str, bool, int, None, list of scalars) pass through unchanged.
        """
        data = {
            'orcabus_id': 'abc',
            'library_id': 'L001',
            'is_active': True,
            'tag_list': ['a', 'b'],
            'note': None,
        }
        result = to_camel_case_key_dict(data)
        logger.info(result)
        self.assertEqual(result, {
            'orcabusId': 'abc',
            'libraryId': 'L001',
            'isActive': True,
            'tagList': ['a', 'b'],
            'note': None,
        })

    def test_nested_dict_and_list_of_dicts(self):
        """
        python manage.py test app.tests.test_serializers_utils.ToCamelCaseKeyDictTestCase.test_nested_dict_and_list_of_dicts
        Mirrors LibraryDetailSerializer shape: nested dict + list of dicts (many=True relation), recursively converted.
        """
        data = {
            'library_id': 'L001',
            'sample': {
                'sample_id': 'S001',
                'external_sample_id': 'ext1',
            },
            'project_set': [
                {'project_id': 'P1', 'project_owner': 'owner1'},
            ],
        }
        result = to_camel_case_key_dict(data)
        logger.info(result)
        self.assertEqual(result, {
            'libraryId': 'L001',
            'sample': {
                'sampleId': 'S001',
                'externalSampleId': 'ext1',
            },
            'projectSet': [
                {'projectId': 'P1', 'projectOwner': 'owner1'},
            ],
        })
