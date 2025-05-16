
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const app = express();
const port = process.env.PORT || 10000;
const upload = multer();

app.use(cors());
app.use(express.json());

const visionClient = new ImageAnnotatorClient();

app.post('/pdf/analyze', upload.single('file'), async (req, res) => {
  try {
    const imageBuffer = await sharp(req.file.buffer).resize(1000).png().toBuffer();
    const [result] = await visionClient.textDetection({ image: { content: imageBuffer } });
    const text = result.textAnnotations[0]?.description || "";

    const zahlen = Array.from(text.matchAll(/\d+(\.\d+)?/g)).map(m => parseFloat(m[0]));
    const werte = zahlen.filter(z => z > 2 && z < 2000).sort((a, b) => b - a);
    const [x1 = 10, x2 = 10, x3 = 10] = werte;

    const textLower = text.toLowerCase();
    let material = 'stahl';
    if (textLower.includes('alu') || textLower.includes('6082')) material = 'aluminium';
    else if (textLower.includes('edelstahl') || textLower.includes('1.4301')) material = 'edelstahl';
    else if (textLower.includes('messing') || textLower.includes('ms58')) material = 'messing';
    else if (textLower.includes('kupfer')) material = 'kupfer';

    const stueckzahl = parseInt(req.body.stueckzahl) || 1;
    const zielpreis = req.body.zielpreis || null;

    const dichten = {
      aluminium: 2.7,
      edelstahl: 7.9,
      stahl: 7.85,
      messing: 8.4,
      kupfer: 8.9
    };
    const kgPreise = {
      aluminium: 7,
      edelstahl: 6.5,
      stahl: 1.5,
      messing: 8,
      kupfer: 10
    };

    const volumen = (x1 * x2 * x3) / 1000;
    const gewicht = volumen * dichten[material];
    const materialkosten = gewicht * kgPreise[material];
    const laufzeit_min = gewicht * 2;
    const laufzeit_std = laufzeit_min / 60;
    const bearbeitungskosten = laufzeit_std * 35;
    const ruestkosten = 60;
    const programmierkosten = 30;
    const grundkosten = ruestkosten + programmierkosten;
    const einzelpreis_roh = (materialkosten + bearbeitungskosten + grundkosten) / stueckzahl;
    const einzelpreis_final = einzelpreis_roh * 1.15;

    res.json({
      text,
      material,
      x1, x2, x3,
      gewicht: gewicht.toFixed(2),
      laufzeit_min: laufzeit_min.toFixed(1),
      materialkosten: materialkosten.toFixed(2),
      einzelpreis_final: einzelpreis_final.toFixed(2),
      zielpreis,
      stueckzahl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler bei der Analyse' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf Port ${port}`);
});
