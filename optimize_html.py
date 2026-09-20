import os
import glob

def optimize_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace Google Fonts
    old_google = '<link href=\"https://fonts.googleapis.com/css2?family=Mukta:wght@500;700&family=Poppins:wght@600;700&display=swap\" rel=\"stylesheet\">'
    new_google = '''<link rel=\"preload\" href=\"https://fonts.googleapis.com/css2?family=Mukta:wght@500;700&family=Poppins:wght@600;700&display=swap\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\">
  <noscript><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Mukta:wght@500;700&family=Poppins:wght@600;700&display=swap\"></noscript>'''
    
    # Replace FontAwesome
    old_fa = '<link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css\" integrity=\"sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==\" crossorigin=\"anonymous\" referrerpolicy=\"no-referrer\">'
    new_fa = '''<link rel=\"preload\" href=\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\" integrity=\"sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==\" crossorigin=\"anonymous\" referrerpolicy=\"no-referrer\">
  <noscript><link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css\" integrity=\"sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==\" crossorigin=\"anonymous\" referrerpolicy=\"no-referrer\"></noscript>'''

    content = content.replace(old_google, new_google)
    content = content.replace(old_fa, new_fa)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for filepath in glob.glob('c:/Users/azizi/OneDrive/Desktop/bihar news/**/*.html', recursive=True):
    optimize_html(filepath)

print('Optimized HTML files.')
