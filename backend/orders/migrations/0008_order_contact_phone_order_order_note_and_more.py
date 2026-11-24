from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0007_orderitem_size_orderitem_temperature_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="pickup_time",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Customer requested pickup timing (e.g. ASAP or In ~30 mins)",
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="order_note",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Customer instructions, pickup notes, or customization details",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="contact_phone",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Customer contact phone number for order pickup",
                max_length=30,
            ),
        ),
    ]
