function spoofFonts(fp) {
  const allowedFonts = fp.fonts;
  if (!allowedFonts || allowedFonts.length === 0) return;

  const allowedSet = new Set(allowedFonts.map((f) => f.toLowerCase()));

  if (typeof document === 'undefined') return;

  if (typeof FontFaceSet !== 'undefined' && document.fonts) {
    const origCheck = FontFaceSet.prototype.check;
    document.fonts.check = function (font, text) {
      const fontFamily = extractFontFamily(font);
      if (fontFamily && !allowedSet.has(fontFamily.toLowerCase())) {
        return false;
      }
      return origCheck.call(this, font, text);
    };
  }
}

function extractFontFamily(fontStr) {
  const match = fontStr.match(
    /(?:\d+(?:px|pt|em|rem|%)\s+)?(?:['"]?)([^'",:]+)/
  );
  return match ? match[1].trim() : null;
}

module.exports = { spoofFonts };
