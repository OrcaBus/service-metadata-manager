from django.core.management import BaseCommand
from app.models import Subject, Library, Sample, Individual, Project, Contact
from app.tests.utils import clear_all_data


# https://docs.djangoproject.com/en/5.0/howto/custom-management-commands/
class Command(BaseCommand):
    help = "Delete all DB data"

    def handle(self, *args, **options):
        p = Subject.objects.get(pk='01JAAGKRBCX0FESK9SZNHTG3CD')
        last_record = p.history.latest()
        previous_record = last_record.prev_record
        delta = last_record.diff_against(previous_record)

        print('helllo')
        for change in delta.changes:
            print('\n')
            print("{} changed from {} to {}".format(change.field, change.old, change.new))
            print(
                '\n'
            )

        print("Done")
