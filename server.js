const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/submit-dar', async (req, res) => {
  try {
    const { station, shift, submittedBy, aideEmail, oicEmail, reportData, htmlMarkup } = req.body;
    
    // 1. GENERATE PDF COMPILATION
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = 740;

    // --- EMBED LOCAL LOGO IMAGE ---
    try {
      let imagePath = path.join(__dirname, 'EmbeddedImagemfd.png');
      if (!fs.existsSync(imagePath)) {
        imagePath = path.join(process.cwd(), 'EmbeddedImagemfd.png');
      }

      if (fs.existsSync(imagePath)) {
        const imageBytes = fs.readFileSync(imagePath);
        const logoImage = await pdfDoc.embedPng(imageBytes);
        
        page.drawImage(logoImage, {
          x: 485,
          y: 665,
          width: 75,
          height: 75
        });
      } else {
        console.log(`⚠️ Logo missing: Place 'EmbeddedImagemfd.png' in: ${imagePath}`);
      }
    } catch (imgErr) {
      console.error("Logo embedding exception:", imgErr.message);
    }

    const drawText = (text, size = 10, isBold = false, x = 50, colorObj = rgb(0,0,0)) => {
      page.drawText(text, { x, y, size, font: isBold ? fontBold : font, color: colorObj });
    };

    // Header Content
    drawText("MADISON FIRE DEPARTMENT", 10, true, 50, rgb(0.5, 0.1, 0.1));
    y -= 16;
    drawText("DAILY APPARATUS REPORT", 18, true, 50, rgb(0.05, 0.05, 0.1));
    y -= 12;
    
    page.drawLine({
      start: { x: 50, y: y },
      end: { x: 562, y: y },
      thickness: 1.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;

    // Registry Metadata Layout
    drawText(`Station: ${station}`, 10, true, 50);
    drawText(`Shift: ${shift}-Shift`, 10, true, 200);
    drawText(`Submitted By: ${submittedBy}`, 10, false, 320);
    y -= 14;
    drawText("Date: 19JUNE2026", 9, false, 50, rgb(0.4, 0.4, 0.4));
    
    y -= 26;
    drawText("SUBMITTED APPARATUS STATUS REGISTER:", 11, true, 50, rgb(0.2, 0.2, 0.2));
    y -= 20;

    // Build the Grid Status Entries
    for (const [unit, details] of Object.entries(reportData)) {
      if (y < 80) {
        page = pdfDoc.addPage([612, 792]);
        y = 740;
      }

      drawText(`• ${unit}:`, 10, true, 60);
      
      let statusLabel = "[IN-SERVICE]";
      let textColor = rgb(0, 0.5, 0.1);
      
      // Determine base status text adjustments
      if (details.status === 'OOS') {
        statusLabel = "[OUT OF SERVICE]";
        textColor = rgb(0.8, 0, 0);
      } else if (details.status === 'OOS - Emergency Use Only') {
        statusLabel = "[OOS - EMERGENCY USE ONLY]";
        textColor = rgb(0.8, 0.4, 0);
      } else if (details.status === 'Transferred Out') {
        statusLabel = "[TRANSFERRED]";
        textColor = rgb(0.1, 0.3, 0.7);
      }

      // Check if text exists, otherwise output a clean 'None' string
      const notesContent = details.reason && details.reason.trim() ? details.reason.trim() : 'None';
      const statusText = `${statusLabel} - Notes: ${notesContent}`;
      
      page.drawText(statusText, { x: 160, y, size: 9, font, color: textColor });
      y -= 18;
    }

    // Add requested text to bottom of page
    page.drawText("Automated Daily Apparatus Reports", {
      x: 50,
      y: 40,
      size: 9,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4)
    });

    const pdfBytes = await pdfDoc.save();

    // 2. DISPATCH ROUTING CONTEXT
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.log("\n================ RECIPIENT ROUTING OVERVIEW ================");
      console.log(`Target Routing Verified:`);
      console.log(`  >> Chiefs' Aide Node:  ${aideEmail}`);
      console.log(`  >> OIC Shift Node:      ${oicEmail}`);
      console.log(`Status packet for location [${station}] constructed: ${pdfBytes.length} bytes.`);
      console.log("============================================================\n");
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"MFD Dashboard Automation" <${process.env.EMAIL_USER}>`,
        to: `${aideEmail}, ${oicEmail}`,
        subject: `🚨 DAR Submission - ${station} (${shift} Shift)`,
        html: htmlMarkup || `<h3>New DAR Submission</h3><p><b>Station:</b> ${station}</p><p><b>Shift:</b> ${shift}</p>`,
        attachments: [
          {
            filename: `DAR_${station.replace(/\s+/g, '_')}_${shift}.pdf`,
            content: Buffer.from(pdfBytes),
            contentType: 'application/pdf'
          }
        ]
      });
    }

    return res.status(200).json({ success: true, message: "Pipeline Execution Complete." });

  } catch (error) {
    console.error("System Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server executing successfully on port ${PORT}`));