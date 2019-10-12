# -*- coding: utf-8 -*-
# Generated by Django 1.11.23 on 2019-10-12 12:12
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_api', '0114_migrate_work_properties'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='workproperty',
            unique_together=set([]),
        ),
        migrations.RemoveField(
            model_name='workproperty',
            name='work',
        ),
        migrations.DeleteModel(
            name='WorkProperty',
        ),
    ]
