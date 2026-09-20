import os

filepath = 'c:/Users/azizi/OneDrive/Desktop/bihar news/assets/js/news.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add loading=\"lazy\" to hero-slide-img
content = content.replace('class=\"hero-slide-img\">', 'class=\"hero-slide-img\" loading=\"lazy\">')

# Add loading=\"lazy\" to spotlight-thumb
content = content.replace('class=\"spotlight-thumb\">', 'class=\"spotlight-thumb\" loading=\"lazy\">')

# Any other img tags?
content = content.replace('<img id=\"modal-img\" src=\"\" alt=\"\" class=\"modal-hero-img\">', '<img id=\"modal-img\" src=\"\" alt=\"\" class=\"modal-hero-img\" loading=\"lazy\">')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated news.js')
