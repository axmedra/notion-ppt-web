import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotionClient, pageToSlideInput, downloadImage } from "@/lib/notion";
import { buildPresentation } from "@/lib/pptx/buildPresentation";
import { defaultTemplateBindings } from "@/lib/templateBindings";
import type { SlideInput } from "@/lib/types";

// Vercel Pro serverless config
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { templateUrl, pageIds } = body as { templateUrl: string; pageIds: string[] };

    if (!templateUrl) {
      return NextResponse.json({ error: "Template URL is required" }, { status: 400 });
    }

    if (!pageIds || pageIds.length === 0) {
      return NextResponse.json({ error: "At least one page is required" }, { status: 400 });
    }

    const notion = createNotionClient(session.accessToken);
    
    // Скачиваем шаблон из Vercel Blob
    console.log(`Скачивание шаблона: ${templateUrl.slice(0, 50)}...`);
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      return NextResponse.json({ error: "Failed to download template" }, { status: 400 });
    }
    const templateBuffer = await templateResponse.arrayBuffer();

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
