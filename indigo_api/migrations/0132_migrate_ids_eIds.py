# Generated by Django 2.2.12 on 2020-05-16 12:33

import json
from reversion.models import Version

from django.contrib.contenttypes.models import ContentType
from django.db import migrations

from indigo_api.data_migrations import CrossheadingToHcontainer, UnnumberedParagraphsToHcontainer, ComponentSchedulesToAttachments, AKNeId, HrefMigration, AnnotationsMigration

from cobalt import Act


def update_xml(xml, doc=None):
    # eg: "section-1" => "sec_1"
    mappings = {}
    cobalt_doc = Act(xml)
    UnnumberedParagraphsToHcontainer().migrate_act(cobalt_doc, mappings)
    CrossheadingToHcontainer().migrate_act(cobalt_doc, mappings)
    ComponentSchedulesToAttachments().migrate_act(cobalt_doc, doc, mappings)
    AKNeId().migrate_act(cobalt_doc, mappings)
    HrefMigration().migrate_act(cobalt_doc, mappings)
    return cobalt_doc.to_xml().decode("utf-8"), mappings


def forward(apps, schema_editor):
    db_alias = schema_editor.connection.alias
    Document = apps.get_model("indigo_api", "Document")
    ct_doc = ContentType.objects.get_for_model(Document)

    for document in Document.objects.using(db_alias).all():
        xml, mappings = update_xml(document.document_xml, document)
        document.document_xml = xml
        AnnotationsMigration().migrate_act(document, mappings)
        document.save()

        # Update historical Document versions
        for version in Version.objects.filter(content_type=ct_doc.pk)\
                .filter(object_id=document.pk).using(db_alias).all():
            data = json.loads(version.serialized_data)
            xml, mappings = update_xml(data[0]['fields']['document_xml'])
            data[0]['fields']['document_xml'] = xml
            version.serialized_data = json.dumps(data)
            version.save()


class Migration(migrations.Migration):

    dependencies = [
        ('indigo_api', '0131_migrate_namespaces'),
    ]

    operations = [
        migrations.RunPython(forward),
    ]
