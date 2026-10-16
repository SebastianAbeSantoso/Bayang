import os
import re

base = "UI_UX Frontend Design"
src = os.path.join(base, "src")
imports = set()
files_list = []

for root, _, files in os.walk(src):
    for f in files:
        if f.endswith((".ts", ".tsx")):
            p = os.path.join(root, f)
            files_list.append(os.path.relpath(p, base))
            with open(p, "r", encoding="utf-8") as fp:
                for line in fp:
                    m = re.match(r'^\s*import\s+.*?from\s+[\'\"](.*?)[\'\"]', line)
                    if m:
                        imports.add(m.group(1))

print("Total TS/TSX files:", len(files_list))
print("Files:", files_list)
print("External and relative imports:")
for imp in sorted(imports):
    print(" ", imp)
