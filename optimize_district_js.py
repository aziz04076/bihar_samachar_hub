import os

filepath = 'c:/Users/azizi/OneDrive/Desktop/bihar news/assets/js/district-page.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('onerror=\"this.src=\\'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&auto=format&fit=crop\\'\"', 'onerror=\"this.src=\\'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&auto=format&fit=crop\\'\" loading=\"lazy\"')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated district-page.js')
