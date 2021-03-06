# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2018-10-04 14:44
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_app', '0018_rename_locality_table'),
    ]

    # This needs to be a state-only operation because the database model was
    # renamed, and no longer exists according to Django.
    state_operations = [
        migrations.DeleteModel(
            name='Locality',
        ),
    ]

    operations = [
        # After this state operation, the Django DB state should match the
        # actual database structure.
        migrations.SeparateDatabaseAndState(state_operations=state_operations)
    ]
