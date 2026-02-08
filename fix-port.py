import re
with open('/tmp/01-secrets.yaml', 'r') as f:
    c = f.read()
# The issue is SMTP_PORT value - YAML parses "587" as integer
# Replace with a non-numeric approach
c = c.replace('SMTP_PORT: "587"', 'SMTP_PORT: "587"')
with open('/tmp/01-secrets.yaml', 'w') as f:
    f.write(c)
print("done")
