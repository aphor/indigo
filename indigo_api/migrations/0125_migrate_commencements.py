# -*- coding: utf-8 -*-
# Generated by Django 1.11.27 on 2020-01-09 14:59
from __future__ import unicode_literals

from django.db import migrations


def migrate_commencements(apps, schema_editor):
    """ Copy commencement details from works to Commencement objects
    """
    Work = apps.get_model("indigo_api", "Work")
    Commencement = apps.get_model("indigo_api", "Commencement")
    db_alias = schema_editor.connection.alias

    for w in Work.objects.using(db_alias).all():
        if w.commencing_work or w.commencement_date:
            commencement = Commencement(
                commenced_work=w,
                commencing_work=w.commencing_work,
                date=w.commencement_date,
                main=True,
                all_provisions=True,
            )
            commencement.save()


def unmigrate_commencements(apps, schema_editor):
    """ Copy commencement details from Commencement objects to works
    """
    Commencement = apps.get_model("indigo_api", "Commencement")
    db_alias = schema_editor.connection.alias

    for c in Commencement.objects.using(db_alias).filter(main=True):
        c.commenced_work.commencing_work = c.commencing_work
        c.commenced_work.commencement_date = c.date
        c.commenced_work.save()


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_api', '0124_commencement'),
    ]

    operations = [
        migrations.RunPython(migrate_commencements, unmigrate_commencements),
    ]
