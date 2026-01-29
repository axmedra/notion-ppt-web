import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotionClient, pageToSlideInput, downloadImage } from "@/lib/notion";
import { buildPresentation } from "@/lib/pptx/buildPresentation";
import { defaultTemplateBindings } from "@/lib/templateBindings";
import type { SlideInput } from "@/lib/types";

export const maxDuration = 60;

export const POST = async (request: Request) => {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const template = formData.get("template") as File | null;
    const pageIdsJson = formData.get("pageIds") as string | null;

    if (!template) {
      return NextResponse.json({ error: "Template file is required" }, { status: 400 });
    }

    if (!pageIdsJson) {
      return NextResponse.json({ error: "Page IDs are required" }, { status: 400 });
    }

    const pageIds: string[] = JSON.parse(pageIdsJson);

    if (pageIds.length === 0) {
      return NextResponse.json({ error: "At least one page is required" }, { status: 400 });
    }

    const notion = createNotionClient(session.accessToken);
    const templateBuffer = await template.arrayBuffer();

    console.log(`Обработка ${pageIds.length} страниц...`);

    const slides: SlideInput[] = [];

    for (const pageId of pageIds) {
      console.log(`Загрузка страницы: ${pageId}`);
      const slide = await pageToSlideInput(notion, pageId);

      if (!slide.slideType) {
        console.log(`  Пропуск: не заполнен Slide type`);
        continue;
      }

      for (const image of slide.images) {
        try {
          console.log(`  Скачивание картинки: ${image.url.slice(0, 50)}...`);
          image.buffer = await downloadImage(image.url);
        } catch (error) {
          console.error(`  Ошибка скачивания картинки:`, error);
        }
      }

      slides.push(slide);
    }

    if (slides.length === 0) {
      return NextResponse.json(
        { error: "No valid slides found. Make sure pages have 'Slide type' filled." },
        { status: 400 }
      );
    }

    console.log(`Генерация презентации из ${slides.length} слайдов...`);

    const pptxBuffer = await buildPresentation({
      templateBuffer,
      slides,
      templateBindings: defaultTemplateBindings,
    });

    return new NextResponse(pptxBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="presentation.pptx"`,
      },
    });
  } catch (error) {
    console.error("Error generating presentation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate presentation" },
      { status: 500 }
    );
  }
};
