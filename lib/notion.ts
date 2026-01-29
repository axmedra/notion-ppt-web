import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  DatabaseObjectResponse,
  SearchResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { NotionDatabase, NotionPage, SlideInput, SlideTable, SlideTextBlock } from "./types";

export const createNotionClient = (accessToken: string): Client => {
  return new Client({ auth: accessToken });
};

export const getUserDatabases = async (accessToken: string): Promise<NotionDatabase[]> => {
  // Use raw API call to get databases since SDK types don't support database filter
  const response = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      filter: { property: "object", value: "database" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });

  const data = await response.json() as { results: DatabaseObjectResponse[] };

  return data.results.map((db) => ({
    id: db.id,
    title: db.title.map((t) => t.plain_text).join("") || "Без названия",
    icon: db.icon?.type === "emoji" ? db.icon.emoji : undefined,
  }));
};

export const getDatabasePages = async (
  notion: Client,
  databaseId: string,
  slideTypeProperty = "Slide type"
): Promise<NotionPage[]> => {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: slideTypeProperty,
      select: { is_not_empty: true },
    },
  });

  return response.results
    .filter((item): item is PageObjectResponse => item.object === "page")
    .map((page) => {
      const titleProp = Object.values(page.properties).find((p) => p.type === "title");
      const title =
        titleProp?.type === "title"
          ? titleProp.title.map((t) => t.plain_text).join("")
          : "Без названия";

      const slideTypeProp = page.properties[slideTypeProperty];
      const slideType =
        slideTypeProp?.type === "select" ? slideTypeProp.select?.name || "" : "";

      const bankNameProp = page.properties["Bank Name"];
      let bankNames: string[] = [];
      
      if (bankNameProp?.type === "multi_select") {
        bankNames = bankNameProp.multi_select.map((s) => s.name).filter(Boolean);
      } else if (bankNameProp?.type === "select" && bankNameProp.select?.name) {
        bankNames = [bankNameProp.select.name];
      } else if (bankNameProp?.type === "rich_text") {
        const text = bankNameProp.rich_text.map((t) => t.plain_text).join("");
        if (text.trim()) {
          bankNames = [text.trim()];
        }
      }

      // Парсим User Task
      const userTaskProp = page.properties["User Task"];
      let userTask = "";
      if (userTaskProp?.type === "rich_text") {
        userTask = userTaskProp.rich_text.map((t) => t.plain_text).join("");
      } else if (userTaskProp?.type === "title") {
        userTask = userTaskProp.title.map((t) => t.plain_text).join("");
      } else if (userTaskProp?.type === "select" && userTaskProp.select?.name) {
        userTask = userTaskProp.select.name;
      }

      return { id: page.id, title, slideType, userTask, bankNames };
    });
};

export const getPageBlocks = async (
  notion: Client,
  blockId: string
): Promise<BlockObjectResponse[]> => {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
};

const notionRichTextToPlainText = (
  richText: Array<{ plain_text: string }>
): string => {
  return richText.map((t) => t.plain_text).join("");
};

const getImageUrlFromBlock = (
  block: BlockObjectResponse
): { url: string; filenameHint?: string } | null => {
  if (block.type === "image") {
    const image = block.image;
    if (image.type === "external") {
      return { url: image.external.url, filenameHint: "image" };
    }
    return { url: image.file.url, filenameHint: "image" };
  }
  return null;
};

const blocksToTextBlocks = (blocks: BlockObjectResponse[]): SlideTextBlock[] => {
  const textBlocks: SlideTextBlock[] = [];

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const text = notionRichTextToPlainText(block.paragraph.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "paragraph", text });
    } else if (block.type === "heading_1") {
      const text = notionRichTextToPlainText(block.heading_1.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "heading_1", text });
    } else if (block.type === "heading_2") {
      const text = notionRichTextToPlainText(block.heading_2.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "heading_2", text });
    } else if (block.type === "heading_3") {
      const text = notionRichTextToPlainText(block.heading_3.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "heading_3", text });
    } else if (block.type === "bulleted_list_item") {
      const text = notionRichTextToPlainText(block.bulleted_list_item.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "bulleted_list_item", text });
    } else if (block.type === "numbered_list_item") {
      const text = notionRichTextToPlainText(block.numbered_list_item.rich_text);
      if (!text.trim()) continue;
      textBlocks.push({ type: "numbered_list_item", text });
    }
  }

  return textBlocks;
};

const tableBlockToTable = async (
  notion: Client,
  tableBlockId: string
): Promise<SlideTable> => {
  const rowBlocks = await getPageBlocks(notion, tableBlockId);
  const rows: string[][] = [];

  for (const rowBlock of rowBlocks) {
    if (rowBlock.type !== "table_row") continue;
    const cells = rowBlock.table_row.cells.map((cellRichText) =>
      notionRichTextToPlainText(cellRichText).trim()
    );
    rows.push(cells);
  }

  return { rows };
};

export const pageToSlideInput = async (
  notion: Client,
  pageId: string
): Promise<SlideInput> => {
  const page = (await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  const blocks = await getPageBlocks(notion, pageId);

  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  const title =
    titleProp?.type === "title"
      ? titleProp.title.map((t) => t.plain_text).join("")
      : "Без названия";

  const slideTypeProp = page.properties["Slide type"];
  const slideType =
    slideTypeProp?.type === "select"
      ? slideTypeProp.select?.name || ""
      : slideTypeProp?.type === "multi_select"
      ? slideTypeProp.multi_select.map((s) => s.name).sort().join("+")
      : "";

  // Парсим Bank Name - может быть multi-select, select или rich_text
  const bankNameKey = Object.keys(page.properties).find(
    (k) => k.toLowerCase() === "bank name"
  );
  const bankNameProp = bankNameKey ? page.properties[bankNameKey] : undefined;
  let bankNames: string[] = [];
  
  if (bankNameProp?.type === "multi_select") {
    bankNames = bankNameProp.multi_select.map((s) => s.name).filter(Boolean);
  } else if (bankNameProp?.type === "select" && bankNameProp.select?.name) {
    bankNames = [bankNameProp.select.name];
  } else if (bankNameProp?.type === "rich_text") {
    const text = bankNameProp.rich_text.map((t) => t.plain_text).join("");
    if (text.trim()) {
      bankNames = [text.trim()];
    }
  }

  // Парсим User Task
  const userTaskKey = Object.keys(page.properties).find(
    (k) => k.toLowerCase() === "user task"
  );
  const userTaskProp = userTaskKey ? page.properties[userTaskKey] : undefined;
  let userTask = "";
  
  if (userTaskProp?.type === "rich_text") {
    userTask = userTaskProp.rich_text.map((t) => t.plain_text).join("");
  } else if (userTaskProp?.type === "title") {
    userTask = userTaskProp.title.map((t) => t.plain_text).join("");
  } else if (userTaskProp?.type === "select" && userTaskProp.select?.name) {
    userTask = userTaskProp.select.name;
  }

  const imagesFromBlocks = blocks
    .map((b) => getImageUrlFromBlock(b))
    .filter(Boolean) as { url: string; filenameHint?: string }[];

  const tables: SlideTable[] = [];
  for (const block of blocks) {
    if (block.type !== "table") continue;
    tables.push(await tableBlockToTable(notion, block.id));
  }

  return {
    id: page.id,
    slideType,
    title,
    userTask,
    bankNames,
    textBlocks: blocksToTextBlocks(blocks),
    tables,
    images: imagesFromBlocks,
  };
};

export const downloadImage = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  return response.arrayBuffer();
};
