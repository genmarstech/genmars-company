from django.db import migrations

# The services on the website, with their starting prices in KES.
SERVICES = [
    ('custom_software', 'custom-software', 'Custom software',
     'Systems built around how your business already works: web apps, portals, dashboards and APIs.',
     ['Web apps, portals & dashboards', 'APIs & M-Pesa integrations', 'Role-based access & reporting', 'Training and handover'],
     '8–16 weeks', 150000, 'once'),
    ('website', 'websites', 'Website',
     'A fast, professional website that tells customers what you do and makes it easy to reach you.',
     ['Copy & structure', 'Responsive design', 'CMS you can edit', 'SEO & analytics setup'],
     '2–5 weeks', 20000, 'once'),
    ('ecommerce', 'e-commerce', 'Online shop',
     'An online shop that takes M-Pesa and card payments, keeps track of stock and tells you about every order.',
     ['Product catalogue & stock', 'M-Pesa & card checkout', 'Order & delivery tracking', 'Sales reports'],
     '4–8 weeks', 90000, 'once'),
    ('automation', 'automation', 'Business automation',
     'Replace spreadsheets, paper forms and manual approvals with simple tools that save hours every week.',
     ['Process mapping', 'Workflow & approvals', 'Document generation', 'Integrations with your tools'],
     '2–8 weeks', 25000, 'once'),
    ('ui_ux', 'ui-ux', 'UI/UX design',
     'Clear, easy-to-use screens for your app or website, tested with real users before any code is written.',
     ['User interviews', 'Wireframes & flows', 'High-fidelity UI', 'Design system'],
     '2–6 weeks', 15000, 'once'),
    ('cloud', 'cloud', 'Cloud & deployment',
     'Hosting, domains, business email, backups and monitoring, set up so your system stays online and secure.',
     ['Cloud setup & migration', 'CI/CD pipelines', 'Backups & monitoring', 'Security hardening'],
     '1–3 weeks', 10000, 'once'),
    ('maintenance', 'maintenance', 'Maintenance & support',
     'Monthly updates, backups, security fixes and small changes, with one point of contact.',
     ['Security & software updates', 'Daily backups', 'Uptime monitoring', 'Priority fixes'],
     'Ongoing', 5000, 'monthly'),
]


def seed(apps, schema_editor):
    ServiceOffering = apps.get_model('portal', 'ServiceOffering')
    for i, (key, slug, name, summary, includes, timeline, price, billing) in enumerate(SERVICES):
        ServiceOffering.objects.get_or_create(key=key, defaults={
            'slug': slug, 'name': name, 'summary': summary, 'includes': includes, 'timeline': timeline,
            'starting_price': price, 'billing': billing, 'deposit_percent': 0 if billing == 'monthly' else 30, 'order': i,
        })


class Migration(migrations.Migration):
    dependencies = [('portal', '0003_orders')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
