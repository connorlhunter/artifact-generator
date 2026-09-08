# PDF fonts

The document renderer embeds Source Sans 3 for body text and Source Code Pro for code. These files are bundled so local builds and CI use the same typography without a network request.

- [Source Sans 3](https://github.com/adobe-fonts/source-sans/tree/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e): Regular, Semibold, and Italic OpenType files.
- [Source Code Pro](https://github.com/adobe-fonts/source-code-pro/tree/803b7e23ec97ae58b6232ea76519a76d428ba268): Regular OpenType file.

Both families are distributed under the SIL Open Font License 1.1. The original license files are included alongside the fonts. Build preparation copies this directory into `dist/resources/pdf-fonts/` for compiled scripts.
