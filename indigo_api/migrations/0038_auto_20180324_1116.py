# -*- coding: utf-8 -*-
# Generated by Django 1.11.8 on 2018-03-24 11:16
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_api', '0037_document_work'),
    ]

    operations = [
        migrations.AlterField(
            model_name='document',
            name='title',
            field=models.CharField(max_length=1024),
        ),
    ]