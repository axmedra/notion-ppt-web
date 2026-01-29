import JSZip from "jszip";
import type { SlideInput, TemplateBinding } from "../types";

const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const replaceTextInShape = (xml: string, shapeName: string, newText: string): string => {
  const nameAttr = `name="${shapeName}"`;
  const nameIndex = xml.indexOf(nameAttr);

  if (nameIndex === -1) {
    console.log(`     Shape "${shapeName}" не найден`);
    return xml;
  }

  const txBodyStart = xml.indexOf("<p:txBody>", nameIndex);
  if (txBodyStart === -1) return xml;

  const txBodyEnd = xml.indexOf("</p:txBody>", txBodyStart);
  if (txBodyEnd === -1) return xml;

  const nextSpStart = xml.indexOf("<p:sp>", nameIndex + nameAttr.length);
  if (nextSpStart !== -1 && nextSpStart < txBodyStart) {
    return xml;
  }

  const lines = newText.split("\n");
  const paragraphs = lines
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="ru-RU" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
    )
    .join("");

  const newTxBody = `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>`;

  const before = xml.substring(0, txBodyStart);
  const after = xml.substring(txBodyEnd + "</p:txBody>".length);

  console.log(`     Shape "${shapeName}" — текст заменён`);
  return before + newTxBody + after;
};

const removeShapePlaceholder = (xml: string, shapeName: string): string => {
  const nameAttr = `name="${shapeName}"`;
  const nameIndex = xml.indexOf(nameAttr);

  if (nameIndex === -1) {
    return xml;
  }

  // Найти начало <p:sp> или <p:sp ...>
  let spStart = xml.lastIndexOf("<p:sp>", nameIndex);
  if (spStart === -1) {
    spStart = xml.lastIndexOf("<p:sp ", nameIndex);
  }
  if (spStart === -1) {
    return xml;
  }

  // Найти конец </p:sp>
  const spEnd = xml.indexOf("</p:sp>", nameIndex);
  if (spEnd === -1) {
    return xml;
  }

  const fullSpEnd = spEnd + "</p:sp>".length;

  const before = xml.substring(0, spStart);
  const after = xml.substring(fullSpEnd);

  console.log(`     Shape "${shapeName}" — удалён (пустой плейсхолдер)`);
  return before + after;
};

const replaceImagePlaceholder = (
  xml: string,
  shapeName: string,
  relId: string
): string => {
  const nameAttr = `name="${shapeName}"`;
  const nameIndex = xml.indexOf(nameAttr);

  if (nameIndex === -1) {
    console.log(`     Shape "${shapeName}" не найден для картинки`);
    return xml;
  }

  let spStart = xml.lastIndexOf("<p:sp>", nameIndex);
  if (spStart === -1) {
    spStart = xml.lastIndexOf("<p:sp ", nameIndex);
  }
  if (spStart === -1) {
    console.log(`     Не найден <p:sp> для "${shapeName}"`);
    return xml;
  }

  const spEnd = xml.indexOf("</p:sp>", nameIndex);
  if (spEnd === -1) {
    console.log(`     Не найден </p:sp> для "${shapeName}"`);
    return xml;
  }

  const fullSpEnd = spEnd + "</p:sp>".length;
  const originalSp = xml.substring(spStart, fullSpEnd);

  const idMatch = originalSp.match(/id="(\d+)"/);
  const shapeId = idMatch ? idMatch[1] : "100";

  const idxMatch = originalSp.match(/idx="(\d+)"/);
  const idx = idxMatch ? idxMatch[1] : "";

  const creationIdMatch = originalSp.match(/<a16:creationId[^>]*id="\{([^}]+)\}"[^>]*\/>/);
  const creationIdXml = creationIdMatch
    ? `<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{${creationIdMatch[1]}}"/></a:ext></a:extLst>`
    : "";

  const picElement = `<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${shapeId}" name="${shapeName}">${creationIdXml}</p:cNvPr>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr><p:ph type="pic" sz="quarter" idx="${idx}"/></p:nvPr>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${relId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr/>
</p:pic>`;

  const before = xml.substring(0, spStart);
  const after = xml.substring(fullSpEnd);

  console.log(`     Shape "${shapeName}" — картинка вставлена (${relId}, idx=${idx})`);
  return before + picElement + after;
};

const addRelationship = (relsXml: string, relId: string, target: string): string => {
  const closingTag = "</Relationships>";
  const insertPos = relsXml.lastIndexOf(closingTag);

  if (insertPos === -1) return relsXml;

  const newRel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;

  return (
    relsXml.substring(0, insertPos) + newRel + "\n" + relsXml.substring(insertPos)
  );
};

const getNextRelId = (relsXml: string): string => {
  const matches = relsXml.matchAll(/Id="rId(\d+)"/g);
  let maxId = 0;
  for (const match of matches) {
    const id = parseInt(match[1], 10);
    if (id > maxId) maxId = id;
  }
  return `rId${maxId + 1}`;
};

const getImageExtension = (url: string): string => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes(".png")) return "png";
  if (urlLower.includes(".gif")) return "gif";
  if (urlLower.includes(".webp")) return "webp";
  return "jpeg";
};

const processOneSlide = async (
  input: SlideInput,
  binding: TemplateBinding,
  zip: JSZip,
  slideIndex: number,
  imageCounter: { value: number },
  template: { slideXml: string; relsXml: string }
): Promise<void> => {
  console.log(`\n--- Слайд ${slideIndex + 1}: "${input.title.slice(0, 50)}..." ---`);

  const outputSlideNum = slideIndex + 1;

  let slideXml = template.slideXml;
  let relsXml = template.relsXml;

  const { shapes } = binding;

  if (shapes.title && input.title.trim()) {
    slideXml = replaceTextInShape(slideXml, shapes.title, input.title.trim());
  }

  // Обработка User Task → Верхний колонтитул
  if (shapes.header && input.userTask?.trim()) {
    slideXml = replaceTextInShape(slideXml, shapes.header, input.userTask.trim());
  }
  
  // Обработка нескольких названий банков
  const bankNameShapes = [shapes.bankName1, shapes.bankName2, shapes.bankName3];
  for (let i = 0; i < input.bankNames.length && i < 3; i++) {
    const bankName = input.bankNames[i];
    const shapeName = bankNameShapes[i];
    if (shapeName && bankName?.trim()) {
      slideXml = replaceTextInShape(slideXml, shapeName, bankName.trim());
    }
  }
  
  if (shapes.body && input.textBlocks.length > 0) {
    const bodyText = input.textBlocks.map((b) => b.text.trim()).join("\n");
    if (bodyText.trim()) {
      slideXml = replaceTextInShape(slideXml, shapes.body, bodyText);
    }
  }

  const imageShapeNames = [shapes.image1, shapes.image2, shapes.image3];
  const usedImageIndices = new Set<number>();

  // Добавляем картинки в плейсхолдеры
  for (let i = 0; i < input.images.length && i < 3; i++) {
    const image = input.images[i];
    const shapeName = imageShapeNames[i];
    if (!shapeName || !image.buffer) continue;

    imageCounter.value += 1;
    const ext = getImageExtension(image.url);
    const mediaFilename = `image_notion_${imageCounter.value}.${ext}`;

    zip.file(`ppt/media/${mediaFilename}`, image.buffer);
    console.log(`     Картинка: ${mediaFilename}`);

    const relId = getNextRelId(relsXml);
    relsXml = addRelationship(relsXml, relId, `../media/${mediaFilename}`);
    slideXml = replaceImagePlaceholder(slideXml, shapeName, relId);
    usedImageIndices.add(i);
  }

  // Удаляем пустые плейсхолдеры картинок и соответствующие названия банков
  const bankNameShapesToRemove = [null, shapes.bankName2, shapes.bankName3]; // индекс 0 не удаляем
  for (let i = 0; i < imageShapeNames.length; i++) {
    const shapeName = imageShapeNames[i];
    if (shapeName && !usedImageIndices.has(i)) {
      slideXml = removeShapePlaceholder(slideXml, shapeName);
      
      // Удаляем соответствующее название банка (BankName2 для Image 2, BankName3 для Image 3)
      const bankNameShape = bankNameShapesToRemove[i];
      if (bankNameShape) {
        slideXml = removeShapePlaceholder(slideXml, bankNameShape);
      }
    }
  }

  zip.file(`ppt/slides/slide${outputSlideNum}.xml`, slideXml);
  zip.file(`ppt/slides/_rels/slide${outputSlideNum}.xml.rels`, relsXml);

  console.log(`     Сохранён: slide${outputSlideNum}.xml`);
};

const updatePresentationForMultipleSlides = (zip: JSZip, totalSlides: number): void => {
  console.log(`  Добавляю ${totalSlides - 1} новых слайдов в метаданные...`);

  let presXml = zip.file("ppt/presentation.xml")?.async("string");
  let presRelsXml = zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  let ctXml = zip.file("[Content_Types].xml")?.async("string");

  Promise.all([presXml, presRelsXml, ctXml]).then(([pres, presRels, ct]) => {
    if (!pres || !presRels || !ct) return;

    const allSldIds = [...pres.matchAll(/id="(\d+)"/g)].map((m) => parseInt(m[1], 10));
    const allRIds = [...pres.matchAll(/r:id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));

    const maxId = Math.max(...allSldIds, 256);
    const maxRId = Math.max(...allRIds, 10);

    let newSldIds = "";
    for (let i = 1; i < totalSlides; i++) {
      const newId = maxId + i;
      const newRId = maxRId + i;
      newSldIds += `<p:sldId id="${newId}" r:id="rId${newRId}"/>`;
    }
    pres = pres.replace(/<\/p:sldIdLst>/, `${newSldIds}</p:sldIdLst>`);
    zip.file("ppt/presentation.xml", pres);

    let newRels = "";
    for (let i = 1; i < totalSlides; i++) {
      const newRId = maxRId + i;
      newRels += `<Relationship Id="rId${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
    }
    presRels = presRels.replace(/<\/Relationships>/, `${newRels}</Relationships>`);
    zip.file("ppt/_rels/presentation.xml.rels", presRels);

    let newOverrides = "";
    for (let i = 1; i < totalSlides; i++) {
      const partName = `/ppt/slides/slide${i + 1}.xml`;
      if (!ct.includes(partName)) {
        newOverrides += `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        const relsPartName = `/ppt/slides/_rels/slide${i + 1}.xml.rels`;
        if (!ct.includes(relsPartName)) {
          newOverrides += `<Override PartName="${relsPartName}" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
        }
      }
    }
    if (newOverrides) {
      ct = ct.replace(/<\/Types>/, `${newOverrides}</Types>`);
      zip.file("[Content_Types].xml", ct);
    }
  });
};

export const buildPresentation = async (params: {
  templateBuffer: ArrayBuffer;
  slides: SlideInput[];
  templateBindings: Record<string, TemplateBinding>;
}): Promise<ArrayBuffer> => {
  const { templateBuffer, slides, templateBindings } = params;

  if (slides.length === 0) {
    throw new Error("Нет слайдов для экспорта.");
  }

  console.log("Распаковываю шаблон...");
  const zip = await JSZip.loadAsync(templateBuffer);

  const templateCache: Record<number, { slideXml: string; relsXml: string }> = {};
  for (const input of slides) {
    const binding = templateBindings[input.slideType];
    if (!binding) continue;
    const slideNum = binding.templateSlideNumber;
    if (!templateCache[slideNum]) {
      const slideXml = await zip.file(`ppt/slides/slide${slideNum}.xml`)?.async("string");
      const relsXml = await zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`)?.async("string");
      if (slideXml && relsXml) {
        templateCache[slideNum] = { slideXml, relsXml };
      }
    }
  }

  const imageCounter = { value: 0 };

  for (let i = 0; i < slides.length; i++) {
    const input = slides[i];
    const binding = templateBindings[input.slideType];

    if (!binding) {
      console.log(`⚠ Пропуск: нет привязки для slideType="${input.slideType}"`);
      continue;
    }

    const template = templateCache[binding.templateSlideNumber];
    if (!template) continue;

    await processOneSlide(input, binding, zip, i, imageCounter, template);
  }

  if (slides.length > 1) {
    console.log("\nОбновляю метаданные презентации...");

    let presXml = await zip.file("ppt/presentation.xml")?.async("string");
    let presRelsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
    let ctXml = await zip.file("[Content_Types].xml")?.async("string");

    if (presXml && presRelsXml && ctXml) {
      const allSldIds = [...presXml.matchAll(/id="(\d+)"/g)].map((m) => parseInt(m[1], 10));
      const allRIds = [...presXml.matchAll(/r:id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));

      const maxId = Math.max(...allSldIds, 256);
      const maxRId = Math.max(...allRIds, 10);

      let newSldIds = "";
      for (let i = 1; i < slides.length; i++) {
        const newId = maxId + i;
        const newRId = maxRId + i;
        newSldIds += `<p:sldId id="${newId}" r:id="rId${newRId}"/>`;
      }
      presXml = presXml.replace(/<\/p:sldIdLst>/, `${newSldIds}</p:sldIdLst>`);
      zip.file("ppt/presentation.xml", presXml);

      let newRels = "";
      for (let i = 1; i < slides.length; i++) {
        const newRId = maxRId + i;
        newRels += `<Relationship Id="rId${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
      }
      presRelsXml = presRelsXml.replace(/<\/Relationships>/, `${newRels}</Relationships>`);
      zip.file("ppt/_rels/presentation.xml.rels", presRelsXml);

      let newOverrides = "";
      for (let i = 1; i < slides.length; i++) {
        const partName = `/ppt/slides/slide${i + 1}.xml`;
        if (!ctXml.includes(partName)) {
          newOverrides += `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
          const relsPartName = `/ppt/slides/_rels/slide${i + 1}.xml.rels`;
          if (!ctXml.includes(relsPartName)) {
            newOverrides += `<Override PartName="${relsPartName}" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
          }
        }
      }
      if (newOverrides) {
        ctXml = ctXml.replace(/<\/Types>/, `${newOverrides}</Types>`);
        zip.file("[Content_Types].xml", ctXml);
      }
    }
  }

  console.log("\nСоздаю PPTX...");
  const result = await zip.generateAsync({ type: "arraybuffer" });

  console.log(`\n✓ Презентация создана`);
  console.log(`  Слайдов: ${slides.length}`);

  return result;
};
