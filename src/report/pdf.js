import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Plain ASCII only: jsPDF's built-in fonts do not cover other characters.
const ascii = (s) => String(s ?? "").replace(/[^\x20-\x7E]/g, "?");
const GREEN = [14, 92, 88];
const SEV_COLOR = { HIGH: [168, 39, 31], MEDIUM: [154, 100, 16], INFO: [70, 96, 110] };

/** report model -> jsPDF document */
export function renderPdf(model) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 54;

  const need = (h) => { if (y + h > H - 50) { doc.addPage(); y = 54; } };
  const heading = (t) => {
    need(34);
    y += 8;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20, 33, 27).text(ascii(t), M, y);
    y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10);
  };
  const para = (t, size = 10) => {
    doc.setFontSize(size).setFont("helvetica", "normal").setTextColor(40, 48, 44);
    const ls = doc.splitTextToSize(ascii(t), W - 2 * M);
    need(ls.length * (size + 3) + 6);
    doc.text(ls, M, y);
    y += ls.length * (size + 3) + 4;
  };
  const table = (head, body, extra = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", textColor: [30, 38, 34] },
      headStyles: { fillColor: GREEN, textColor: 255 },
      ...extra,
    });
    y = doc.lastAutoTable.finalY + 14;
  };

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20, 33, 27).text(ascii(model.title), M, y);
  y += 20;
  para(`${model.tool}   |   Generated ${model.generatedAt}`, 9);

  heading("Device");
  const d = model.device;
  para(`${d.manufacturer} ${d.model}   |   Android ${d.android}   |   Security patch ${d.patch}`);
  para(`Support level: ${model.support.label}`);

  heading("Summary");
  para(model.summary.headline);
  const fc = model.summary.findingCounts;
  para(`Findings: ${fc.HIGH} high, ${fc.MEDIUM} medium, ${fc.INFO} info.`);
  para(model.disclaimer);

  heading("Findings");
  if (!model.findings.length) {
    para("No findings from the checks that ran. See the module table below for what was and was not checked.");
  } else {
    table(
      ["Level", "Item", "Why", "Proof", "Normal when"],
      model.findings.map((f) => [f.severity, ascii(f.item), ascii(f.reason), ascii(f.proof), ascii(f.normalWhen)]),
      {
        columnStyles: { 0: { cellWidth: 44, fontStyle: "bold" }, 1: { cellWidth: 90 }, 2: { cellWidth: 140 }, 3: { cellWidth: 120 } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) data.cell.styles.textColor = SEV_COLOR[data.cell.raw] || [0, 0, 0];
        },
      }
    );
  }

  heading("What was checked");
  table(["Check", "Result", "Detail"], model.modules.map((m) => [ascii(m.title), m.statusLabel, ascii(m.detail)]), {
    columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 70 } },
  });

  if (model.apps) {
    heading("Installed user apps");
    table(["Package", "Installer", "Launcher icon"], model.apps.map((a) => [ascii(a.pkg), ascii(a.installer), a.hidden === null ? "unknown" : a.hidden ? "none" : "yes"]));
  }

  heading("What this scan cannot see");
  model.cannotSee.forEach((t) => para("- " + t, 9));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(120).text(`Page ${i} of ${pages}   |   ${ascii(model.tool)}`, M, H - 24);
  }
  return doc;
}

export function downloadPdf(model, filename = "phone-scan-report.pdf") {
  renderPdf(model).save(filename);
}
