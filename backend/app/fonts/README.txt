NotoSansKannada-Regular.ttf is bundled here so PDF reports render Kannada
book titles, author names, and category names correctly instead of showing
black boxes/squares.

Source: Google Fonts' Noto Sans Kannada (SIL Open Font License 1.1),
https://github.com/google/fonts/tree/main/ofl/notosanskannada
This file is a static "Regular" (wght=400, wdth=100) instance generated from
the upstream variable font using fontTools' varLib.instancer, since reportlab
reads the default glyph outlines directly and doesn't need the variable-font
axes at runtime.

If you ever need to regenerate or replace it, any Unicode Kannada TTF/OTF
works - just keep the filename as NotoSansKannada-Regular.ttf (or update
UNICODE_FONT_NAME/the path in app/utils/pdf_generator.py to match).
