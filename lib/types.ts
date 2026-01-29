export type SlideTypeName = string;

export type SlideTextBlock =
  | { type: "heading_1"; text: string }
  | { type: "heading_2"; text: string }
  | { type: "heading_3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bulleted_list_item"; text: string }
  | { type: "numbered_list_item"; text: string };

export type SlideTable = {
  rows: string[][];
};

export type SlideImage = {
  url: string;
  filenameHint?: string;
  localPath?: string;
  buffer?: ArrayBuffer;
};

export type SlideInput = {
  id: string;
  slideType: SlideTypeName;
  title: string;
  userTask: string; // User Task → Верхний колонтитул
  bankNames: string[]; // Массив названий банков (до 3)
  textBlocks: SlideTextBlock[];
  tables: SlideTable[];
  images: SlideImage[];
};

export type TemplateBinding = {
  templateSlideNumber: number;
  shapes: {
    title?: string;
    header?: string; // Верхний колонтитул (User Task)
    bankName1?: string;
    bankName2?: string;
    bankName3?: string;
    imageCaption1?: string; // Под картинкой 1
    imageCaption2?: string; // Под картинкой 2
    imageCaption3?: string; // Под картинкой 3
    body?: string;
    table?: string;
    image1?: string;
    image2?: string;
    image3?: string;
  };
};

export type NotionDatabase = {
  id: string;
  title: string;
  icon?: string;
};

export type NotionPage = {
  id: string;
  title: string;
  slideType: string;
  userTask: string;
  bankNames: string[];
};
