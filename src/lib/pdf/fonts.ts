import { Font } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// Путь к шрифту в src/assets/fonts
const fontPath = path.join(process.cwd(), "src/assets/fonts/Roboto-Regular.ttf");

// Читаем шрифт как Buffer и конвертируем в base64 data URL
const fontBuffer = fs.readFileSync(fontPath);
const fontBase64 = `data:font/truetype;base64,${fontBuffer.toString("base64")}`;

Font.register({
  family: "Roboto",
  src: fontBase64,
});

// Отключаем hyphenation
Font.registerHyphenationCallback((word) => [word]);
