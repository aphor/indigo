# Generated by Django 2.2.12 on 2020-05-11 12:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_api', '0128_rename_badges'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflow',
            name='priority',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
