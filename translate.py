import os
from googletrans import Translator
from pathlib import Path

translator = Translator()

def translate_file(src_path, dst_path, src_lang='zh-cn', dest_lang='en'):
    with open(src_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # 分段翻译避免长度限制
    lines = content.split('\n')
    translated_lines = []
    for line in lines:
        if line.strip() and not line.startswith('```'):
            try:
                result = translator.translate(line, src=src_lang, dest=dest_lang)
                translated_lines.append(result.text)
            except:
                translated_lines.append(line)
        else:
            translated_lines.append(line)
    with open(dst_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(translated_lines))
    print(f'Translated: {src_path} -> {dst_path}')

# 遍历 constitution 目录
for file in Path('constitution').glob('*.md'):
    if file.name not in ['identity.md']:  # 跳过已翻译的
        translate_file(file, file.with_suffix('.en.md'))